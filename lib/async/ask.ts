import { CHAPTERS, D1, D2, MU } from "@/lib/data/guanajuato-2026";
import {
  buildGeminiPrompt,
  MAX_QUESTION_LENGTH,
} from "@/lib/monitor-ai/context-policy";
import { geminiGenerate } from "@/lib/monitor-ai/providers/gemini-tools";
import type { MonitorAiErrorCode } from "@/lib/monitor-ai/types";
import { sanitizeAssistantMessage } from "@/lib/monitor-ai/validate-response";
import {
  datasetContextForModel,
  resolveDatasetKeyFromChartFocus,
} from "@/lib/visualization/datasets";

export type AsyncAskInput = {
  question?: string;
  chartFocus?: string;
  pointTitle?: string;
  narrative?: string;
};

export type AsyncAskResult =
  | { ok: true; answer: string; interpreter: "gemini" }
  | { ok: false; code: MonitorAiErrorCode; message?: string };

type GenerateFn = typeof geminiGenerate;

function seriesForChart(chartFocus?: string): unknown {
  if (chartFocus === "turnover_bimonthly") {
    return { label: "Rotación bimestral 2025 (%)", rows: D1 };
  }
  if (chartFocus === "turnover_municipality") {
    return {
      label: "Municipio, controlada, no controlada, total (%)",
      rows: MU,
    };
  }
  if (chartFocus === "turnover_tenure") {
    return { label: "Bajas por antigüedad (%)", rows: D2 };
  }
  return null;
}

/** Contexto del informe vigente (mismos módulos que las gráficas). Sin estado de reunión. */
export function buildAsyncReportContext(input: AsyncAskInput): Record<string, unknown> {
  const focus = input.chartFocus?.trim() || undefined;
  const chapter = CHAPTERS.find((c) => c.chartFocus === focus) ?? null;
  const datasetKey = resolveDatasetKeyFromChartFocus(focus);
  return {
    source: "informe_empaquetado",
    pointTitle: input.pointTitle?.trim() || null,
    narrative: input.narrative?.trim() || null,
    chapter: chapter
      ? {
          title: chapter.t,
          headline: chapter.headline,
          big: chapter.big,
          sub: chapter.sub,
          stat1: { value: chapter.s1v, label: chapter.s1l },
          stat2: { value: chapter.s2v, label: chapter.s2l },
          captionA: chapter.capA,
          captionB: chapter.capB,
        }
      : null,
    dataset: datasetKey ? datasetContextForModel(datasetKey) : null,
    series: seriesForChart(focus),
  };
}

export async function runAsyncReportAsk(
  input: AsyncAskInput,
  generate: GenerateFn = geminiGenerate,
): Promise<AsyncAskResult> {
  const question = (input.question ?? "").trim();
  if (!question || question.length > MAX_QUESTION_LENGTH) {
    return {
      ok: false,
      code: "INVALID_REQUEST",
      message: `La pregunta debe tener entre 1 y ${MAX_QUESTION_LENGTH} caracteres.`,
    };
  }

  const context = JSON.stringify(buildAsyncReportContext(input));
  const prompt = buildGeminiPrompt(question, context);
  const gen = await generate(
    prompt.systemInstruction,
    [{ role: "user", parts: [{ text: prompt.userText }] }],
    false,
    { maxOutputTokens: 512 },
  );
  if (!gen.ok) return { ok: false, code: gen.code };
  if (gen.round.type !== "text") {
    return { ok: false, code: "AI_EMPTY_RESPONSE" };
  }
  const answer = sanitizeAssistantMessage(gen.round.text);
  if (!answer) return { ok: false, code: "AI_EMPTY_RESPONSE" };
  return { ok: true, answer, interpreter: "gemini" };
}
