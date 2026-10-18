import { buildGeminiToolsSystemInstruction } from "./context-policy";
import { executeMonitorAiTool } from "./tools/execute";
import {
  geminiGenerate,
  MAX_TOOL_ITERATIONS,
  type GeminiModelContentPart,
} from "./providers/gemini-tools";

export { MAX_TOOL_ITERATIONS };
import { sanitizeAssistantMessage } from "./validate-response";
import {
  authorizeHighlightRequest,
  buildClearActionFromProposal,
  buildHighlightActionFromProposal,
  finalizeHighlightForResponse,
  mergeHighlightAction,
} from "./validate-highlight";
import { highlightHintsForCharts } from "./highlight-catalog";
import type {
  MonitorAiAction,
  MonitorAiErrorCode,
  MonitorAiValidatedRequest,
} from "./types";
import { MONITOR_AI_CONTRACT_VERSION } from "./types";
import type { MonitorAiChatSuccess } from "./types";

export type RunWithToolsResult =
  | { ok: true; body: MonitorAiChatSuccess }
  | { ok: false; code: MonitorAiErrorCode };

type Content = {
  role: string;
  parts: Array<
    | { text: string }
    | GeminiModelContentPart
    | { functionResponse: { name: string; response: Record<string, unknown> } }
  >;
};

function successBody(
  validated: MonitorAiValidatedRequest,
  message: string,
  action: MonitorAiAction | null,
  providerCalled: boolean,
): MonitorAiChatSuccess {
  const finalized = finalizeHighlightForResponse(action, validated.viewContext);
  return {
    contract: MONITOR_AI_CONTRACT_VERSION,
    meetingId: validated.meetingId,
    message,
    interpreter: "gemini",
    action: finalized.action,
    meta: {
      sectionKey: validated.sectionKey,
      chartId: validated.chartId ?? undefined,
      providerCalled,
      highlightStatus: finalized.status,
    },
  };
}

function adoptHighlightFromTool(
  validated: MonitorAiValidatedRequest,
  toolName: string,
  args: Record<string, unknown>,
  current: MonitorAiAction | null,
): MonitorAiAction | null {
  const auth = authorizeHighlightRequest(
    validated.meetingId,
    validated.meetingId,
    validated.caller.role,
  );
  if (!auth.ok) return current;
  if (toolName === "clear_chart_highlight") {
    const built = buildClearActionFromProposal(args);
    if (!built.ok) return current;
    return mergeHighlightAction(current, built.action);
  }
  if (toolName !== "propose_chart_highlight") return current;
  const built = buildHighlightActionFromProposal(args, validated.viewContext);
  if (!built.ok) return current;
  return mergeHighlightAction(current, built.action);
}

function navigationHint(req: MonitorAiValidatedRequest): string {
  const bits: string[] = [];
  if (req.sectionKey) bits.push(`sectionKey=${req.sectionKey}`);
  if (req.chartId) bits.push(`chartId=${req.chartId}`);
  if (req.presentationStep !== undefined) bits.push(`step=${req.presentationStep}`);
  const vc = req.viewContext;
  if (vc) {
    bits.push(`stepType=${vc.stepType}`);
    bits.push(`followPresenter=${vc.followPresenter}`);
    if (vc.primaryChartId) bits.push(`primaryChartId=${vc.primaryChartId}`);
    if (vc.chartSurface === "table") {
      bits.push("chartSurface=table (sin canvas; no proponer resaltado hasta vista Gráfico)");
    } else if (vc.chartSurface === "canvas") {
      bits.push("chartSurface=canvas");
    }
    if (vc.visibleCharts?.length) {
      bits.push(
        `visibleChartLabels=${vc.visibleCharts.map((c) => `${c.chartId}«${c.subtitle}»`).join("|")}`,
      );
    }
    if (vc.visibleChartIds.length) {
      bits.push(`visibleCharts=${vc.visibleChartIds.join("|")}`);
      bits.push(`highlightOptions=${highlightHintsForCharts(vc.visibleChartIds)}`);
    } else {
      bits.push("visibleCharts=ninguna (no proponer resaltado)");
    }
    if (vc.mountedChartIds.length) bits.push(`mountedCharts=${vc.mountedChartIds.join("|")}`);
    const ah = vc.activeHighlight;
    if (ah?.chartId) {
      bits.push(
        `activeHighlight=${ah.chartId}${ah.category ? `:${ah.category}` : ""} (resaltado actual en pantalla)`,
      );
    }
  }
  return bits.length ? `Contexto de vista del participante (no es dato numérico): ${bits.join(", ")}.` : "";
}

export async function runMonitorAiChatWithTools(
  validated: MonitorAiValidatedRequest,
): Promise<RunWithToolsResult> {
  const systemInstruction = buildGeminiToolsSystemInstruction();
  const userIntro = navigationHint(validated);
  const contents: Content[] = [
    {
      role: "user",
      parts: [
        {
          text: `${userIntro}\nPregunta del participante: ${validated.question}`,
        },
      ],
    },
  ];

  let highlightAction: MonitorAiAction | null = null;

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const gen = await geminiGenerate(systemInstruction, contents, true);
    if (!gen.ok) {
      return { ok: false, code: gen.code };
    }

    if (gen.round.type === "text") {
      const message = sanitizeAssistantMessage(gen.round.text);
      if (!message) {
        return { ok: false, code: "AI_EMPTY_RESPONSE" };
      }
      return {
        ok: true,
        body: successBody(validated, message, highlightAction, true),
      };
    }

    const { name, args, modelPart } = gen.round;
    contents.push({
      role: "model",
      parts: [modelPart],
    });

    const toolResult = executeMonitorAiTool(name, args);
    highlightAction = adoptHighlightFromTool(validated, name, args, highlightAction);
    contents.push({
      role: "user",
      parts: [
        {
          functionResponse: {
            name,
            response: toolResult.ok
              ? { result: toolResult.data }
              : { error: toolResult.error, code: toolResult.code },
          },
        },
      ],
    });
  }

  const final = await geminiGenerate(systemInstruction, contents, false);
  if (!final.ok) {
    return { ok: false, code: final.code };
  }
  if (final.round.type !== "text") {
    return { ok: false, code: "AI_EMPTY_RESPONSE" };
  }
  const message = sanitizeAssistantMessage(final.round.text);
  if (!message) {
    return { ok: false, code: "AI_EMPTY_RESPONSE" };
  }
  return {
    ok: true,
    body: successBody(validated, message, highlightAction, true),
  };
}

/** Expuesto para pruebas del bucle sin llamar a la API. */
export async function runToolLoopWithGenerator(
  question: string,
  generate: (
    contents: Content[],
    withTools: boolean,
  ) => Promise<
    | {
        ok: true;
        round:
          | { type: "text"; text: string }
          | {
              type: "function_call";
              name: string;
              args: Record<string, unknown>;
              modelPart: GeminiModelContentPart;
            };
      }
    | { ok: false; code: MonitorAiErrorCode }
  >,
): Promise<RunWithToolsResult> {
  const contents: Content[] = [{ role: "user", parts: [{ text: question }] }];
  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const gen = await generate(contents, true);
    if (!gen.ok) return { ok: false, code: gen.code };
    if (gen.round.type === "text") {
      const message = sanitizeAssistantMessage(gen.round.text);
      if (!message) return { ok: false, code: "AI_EMPTY_RESPONSE" };
      return {
        ok: true,
        body: {
          contract: MONITOR_AI_CONTRACT_VERSION,
          meetingId: "test",
          message,
          interpreter: "gemini",
          action: null,
          meta: { providerCalled: false },
        },
      };
    }
    const { name, args, modelPart } = gen.round;
    contents.push({ role: "model", parts: [modelPart] });
    const toolResult = executeMonitorAiTool(name, args);
    contents.push({
      role: "user",
      parts: [
        {
          functionResponse: {
            name,
            response: toolResult.ok
              ? { result: toolResult.data }
              : { error: toolResult.error, code: toolResult.code },
          },
        },
      ],
    });
  }
  return { ok: false, code: "AI_EMPTY_RESPONSE" };
}
