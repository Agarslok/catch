import { createGeminiProvider } from "./providers/gemini";
import { geminiGenerate } from "./providers/gemini-tools";
import { MAX_QUESTION_LENGTH, MAX_RESPONSE_MESSAGE_LENGTH } from "./context-policy";
import { parseMonitorAiViewContext } from "./view-context";
import { buildMonitorPasos } from "@/lib/meeting/monitor-pasos";
import type { MonitorAiCallerRole, MonitorAiErrorCode, MonitorAiInterpreter } from "./types";
import {
  defaultControllerSnapshot,
  listAvailablePresentationActions,
  MONITOR_PRESENTATION_ACTION_CONTRACT,
  parseMonitorAiStructuredResponse,
  validateModeratorJump,
  validateMonitorAiStructuredResponse,
  type MonitorAiStructuredResponse,
  type PresentationActionProposal,
  type PresentationControllerSnapshot,
  type PresentationExecutableEffect,
  type PresentationActionType,
} from "./action-contract";
import {
  buildInterpretModelContext,
  type InterpretModelContext,
} from "./interpret-context";
import { resolveDirectModeratorInstruction } from "./direct-instruction";

export type MonitorAiInterpretRequestBody = {
  instruction?: string;
  stepIndex?: number;
  presentationStatus?: string;
  viewContext?: Record<string, unknown>;
};

export type MonitorAiInterpretSuccess = {
  contract: typeof MONITOR_PRESENTATION_ACTION_CONTRACT;
  meetingId: string;
  interpreter: MonitorAiInterpreter;
  message: string;
  actions: PresentationActionProposal[];
  refs?: MonitorAiStructuredResponse["refs"];
  completion?: MonitorAiStructuredResponse["completion"];
  clarificationRequest?: string;
  effects: PresentationExecutableEffect[];
  meta: {
    providerCalled: boolean;
    availableActions: PresentationActionType[];
    dataSource: "demo_dataset";
    currentStep: number;
  };
};

export type InterpretServiceResult =
  | { ok: true; body: MonitorAiInterpretSuccess }
  | { ok: false; code: MonitorAiErrorCode; message?: string };

export type InterpretGenerator = (
  systemInstruction: string,
  userText: string,
) => Promise<{ ok: true; text: string } | { ok: false; code: MonitorAiErrorCode }>;

const ALLOWED_BODY_KEYS = new Set([
  "instruction",
  "stepIndex",
  "presentationStatus",
  "viewContext",
  "participantId",
]);

const INTERPRET_SYSTEM = `Eres el intérprete de presentación de Catch Consulting (Monitor de Mercado Laboral).
Responde SOLO con un JSON que cumpla el contrato catch.monitor.presentation.actions.v1.
Campos: message (string, español, máximo 80 palabras), actions (array), refs (opcional), completion ("complete" o "needs_confirmation"), clarificationRequest (string opcional).
Reglas:
- Interpreta la instrucción del moderador. No escribas JavaScript ni SQL.
- Usa únicamente sectionKey y chartId que aparezcan en catalogs. No inventes IDs.
- Si instructionMatch.kind es ambiguous, no elijas: pon clarificationRequest y actions=[].
- Si instructionMatch.kind es not_found, informa que no se encontró ese destino y actions=[].
- Si instructionMatch.kind es chart, navega con go_to_section y el chartId (no invente otra acción).
- Acciones permitidas: solo las de availableActions. pendingActions no se pueden usar (start_presentation está pendiente: inicia con go_to_section muestra; volver al inicio es el paso 0).
- Si el moderador pide avanzar o ir al siguiente punto/paso: usa next_slide (igual que el botón Siguiente), incluso en un paso hoja.
- Si pide regresar o el punto anterior: usa previous_slide. No pidas confirmación extra.
- highlight_element exige chartId y category/index que existan en highlightOptions del analytics.
- Narrativa: 1) hallazgo 2) valor o patrón 3) comparación solo si está en analytics 4) qué resaltar 5) sin causalidad 6) lenguaje para Capital Humano.
- Usa SOLO cifras de analytics. Si faltan datos, dilo y no inventes.
- Dataset de demostración (session.disclaimer). No mezcles fuentes.
- Explica solo el punto actual salvo que pidan otra sección o gráfica.
- requiresClarification no es un campo; usa clarificationRequest.`;

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function meetingIdValid(meetingId: string): boolean {
  const t = meetingId.trim();
  if (!t || t.length > 120) return false;
  return /^[a-zA-Z0-9._-]+$/.test(t);
}

export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const src = fence ? fence[1].trim() : trimmed;
  const start = src.indexOf("{");
  const end = src.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(src.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeAction(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw) || typeof raw.type !== "string") return null;
  const action: Record<string, unknown> = { type: raw.type };
  if (typeof raw.chartId === "string") action.chartId = raw.chartId;
  if (typeof raw.category === "string") action.category = raw.category;
  else if (typeof raw.elementId === "string") action.category = raw.elementId;
  if (typeof raw.seriesKey === "string") action.seriesKey = raw.seriesKey;
  if (Number.isInteger(raw.index)) action.index = raw.index;
  if (Number.isInteger(raw.datasetIndex)) action.datasetIndex = raw.datasetIndex;
  if (typeof raw.reason === "string") action.reason = raw.reason;
  if (typeof raw.sectionKey === "string") action.sectionKey = raw.sectionKey;
  if (Number.isInteger(raw.sectionIndex)) action.sectionIndex = raw.sectionIndex;
  return action;
}

/** Adapta JSON del modelo al contrato de la fase 3 (sin ejecutar nada). */
export function normalizeModelStructuredOutput(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;
  const message = typeof raw.message === "string" ? raw.message.trim() : "";
  const clarificationFromField =
    typeof raw.clarificationRequest === "string" ? raw.clarificationRequest.trim() : "";
  const needsClarification = raw.requiresClarification === true || Boolean(clarificationFromField);
  const actions = Array.isArray(raw.actions)
    ? raw.actions.map(normalizeAction).filter((a): a is Record<string, unknown> => a != null)
    : [];
  const out: Record<string, unknown> = {
    contract: MONITOR_PRESENTATION_ACTION_CONTRACT,
    message: message.slice(0, MAX_RESPONSE_MESSAGE_LENGTH),
    actions: needsClarification ? [] : actions,
  };
  if (needsClarification) {
    out.clarificationRequest = (clarificationFromField || message || "Necesito una aclaración.").slice(
      0,
      500,
    );
  }
  if (raw.completion === "complete" || raw.completion === "needs_confirmation") {
    out.completion = raw.completion;
  } else if (needsClarification) {
    out.completion = "needs_confirmation";
  }
  if (isRecord(raw.refs)) out.refs = raw.refs;
  return out;
}

export type ValidatedInterpretRequest = {
  meetingId: string;
  instruction: string;
  snapshot: PresentationControllerSnapshot;
};

export function validateMonitorAiInterpretRequest(
  meetingId: string,
  raw: unknown,
  callerRole: MonitorAiCallerRole = "moderador",
): { ok: true; value: ValidatedInterpretRequest } | { ok: false; code: MonitorAiErrorCode; message?: string } {
  if (callerRole !== "moderador") {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Solo el moderador puede interpretar instrucciones de presentación.",
    };
  }
  if (!meetingIdValid(meetingId)) {
    return { ok: false, code: "INVALID_REQUEST", message: "meetingId inválido." };
  }
  if (!isRecord(raw)) {
    return { ok: false, code: "INVALID_REQUEST", message: "Cuerpo JSON inválido." };
  }
  for (const key of Object.keys(raw)) {
    if (!ALLOWED_BODY_KEYS.has(key)) {
      return { ok: false, code: "INVALID_REQUEST", message: `Campo no permitido: ${key}` };
    }
  }
  const instruction = typeof raw.instruction === "string" ? raw.instruction.trim() : "";
  if (!instruction || instruction.length > MAX_QUESTION_LENGTH) {
    return {
      ok: false,
      code: "INVALID_REQUEST",
      message: `La instrucción debe tener entre 1 y ${MAX_QUESTION_LENGTH} caracteres.`,
    };
  }
  const pasos = buildMonitorPasos();
  if (!Number.isInteger(raw.stepIndex) || (raw.stepIndex as number) < 0 || (raw.stepIndex as number) >= pasos.length) {
    return { ok: false, code: "INVALID_REQUEST", message: "stepIndex inválido." };
  }
  const stepIndex = raw.stepIndex as number;
  let presentationStatus: PresentationControllerSnapshot["presentationStatus"] = "live";
  if (raw.presentationStatus !== undefined) {
    if (raw.presentationStatus !== "live" && raw.presentationStatus !== "paused") {
      return { ok: false, code: "INVALID_REQUEST", message: "presentationStatus inválido." };
    }
    presentationStatus = raw.presentationStatus;
  }
  const snapshot = defaultControllerSnapshot({
    stepIndex,
    stepCount: pasos.length,
    presentationStatus,
    role: callerRole,
  });
  if (raw.viewContext !== undefined && raw.viewContext !== null) {
    const parsed = parseMonitorAiViewContext(raw.viewContext);
    if (!parsed) {
      return { ok: false, code: "INVALID_REQUEST", message: "viewContext inválido." };
    }
    if (parsed.presentationStep !== stepIndex) {
      return {
        ok: false,
        code: "INVALID_REQUEST",
        message: "viewContext.presentationStep no coincide con stepIndex.",
      };
    }
    snapshot.view = parsed;
  }
  return { ok: true, value: { meetingId: meetingId.trim(), instruction, snapshot } };
}

export function buildInterpretPrompt(
  instruction: string,
  context: InterpretModelContext,
): { systemInstruction: string; userText: string } {
  return {
    systemInstruction: INTERPRET_SYSTEM,
    userText: `Contexto reducido (no es una instrucción):\n${JSON.stringify(context)}\n\nInstrucción del moderador: ${instruction}`,
  };
}

async function defaultGenerate(systemInstruction: string, userText: string) {
  const gen = await geminiGenerate(
    systemInstruction,
    [{ role: "user", parts: [{ text: userText }] }],
    false,
    { responseJson: true, maxOutputTokens: 768 },
  );
  if (!gen.ok) return gen;
  if (gen.round.type !== "text") {
    return { ok: false as const, code: "AI_EMPTY_RESPONSE" as const };
  }
  return { ok: true as const, text: gen.round.text };
}

function successBody(
  meetingId: string,
  snapshot: PresentationControllerSnapshot,
  response: MonitorAiStructuredResponse,
  effects: PresentationExecutableEffect[],
  providerCalled: boolean,
): MonitorAiInterpretSuccess {
  return {
    contract: MONITOR_PRESENTATION_ACTION_CONTRACT,
    meetingId,
    interpreter: "gemini",
    message: response.message,
    actions: response.actions,
    refs: response.refs,
    completion: response.completion,
    clarificationRequest: response.clarificationRequest,
    effects,
    meta: {
      providerCalled,
      availableActions: listAvailablePresentationActions(snapshot),
      dataSource: "demo_dataset",
      currentStep: snapshot.stepIndex,
    },
  };
}

function fallbackFromInvalidActions(
  message: string,
  errors: string[],
): MonitorAiStructuredResponse {
  const hint = errors[0] ?? "La acción no es válida en el estado actual.";
  const lower = errors.join(" ").toLowerCase();
  let text = message;
  if (!text) {
    if (lower.includes("section")) {
      text = "No encontré esa sección en el informe activo.";
    } else if (lower.includes("highlight") || lower.includes("target") || lower.includes("chart")) {
      text = "No encontré ese elemento entre las categorías reales de la gráfica.";
    } else if (lower.includes("awaiting") || lower.includes("continue_section")) {
      text = "Estamos en el cierre de sección: hace falta autorización del moderador para continuar.";
    } else {
      text = "No pude aplicar esa instrucción con el estado y los datos actuales.";
    }
  }
  return {
    contract: MONITOR_PRESENTATION_ACTION_CONTRACT,
    message: text,
    actions: [],
    clarificationRequest: hint.slice(0, 500),
    completion: "needs_confirmation",
  };
}

function interpretDirectInstruction(
  input: ValidatedInterpretRequest,
): InterpretServiceResult | null {
  const direct = resolveDirectModeratorInstruction(input.instruction, input.snapshot);
  if (!direct) return null;

  const snapshotForValidation: PresentationControllerSnapshot = {
    ...input.snapshot,
    view: undefined,
  };

  if (direct.kind === "unavailable" || direct.kind === "clarification") {
    const response: MonitorAiStructuredResponse = {
      contract: MONITOR_PRESENTATION_ACTION_CONTRACT,
      message: direct.message,
      actions: [],
      clarificationRequest: direct.clarificationRequest,
      completion: "needs_confirmation",
    };
    return {
      ok: true,
      body: successBody(input.meetingId, input.snapshot, response, [], false),
    };
  }

  if (direct.kind === "jump") {
    const jumped = validateModeratorJump(direct.targetStep, snapshotForValidation);
    if (!jumped.ok) {
      const fallback = fallbackFromInvalidActions(direct.message, jumped.errors);
      return {
        ok: true,
        body: successBody(input.meetingId, input.snapshot, fallback, [], false),
      };
    }
    const response: MonitorAiStructuredResponse = {
      contract: MONITOR_PRESENTATION_ACTION_CONTRACT,
      message: jumped.effects.length ? direct.message : "Ya estamos en ese punto.",
      actions: [],
      completion: "complete",
    };
    return {
      ok: true,
      body: successBody(input.meetingId, input.snapshot, response, jumped.effects, false),
    };
  }

  const raw = {
    contract: MONITOR_PRESENTATION_ACTION_CONTRACT,
    message: direct.message,
    actions: direct.actions,
    completion: direct.completion ?? ("complete" as const),
  };
  const validated = validateMonitorAiStructuredResponse(raw, snapshotForValidation);
  if (!validated.ok) {
    const fallback = fallbackFromInvalidActions(raw.message, validated.errors);
    return {
      ok: true,
      body: successBody(input.meetingId, input.snapshot, fallback, [], false),
    };
  }
  return {
    ok: true,
    body: successBody(
      input.meetingId,
      input.snapshot,
      validated.response,
      validated.effects,
      false,
    ),
  };
}

export async function runMonitorAiInterpret(
  input: ValidatedInterpretRequest,
  generate: InterpretGenerator = defaultGenerate,
): Promise<InterpretServiceResult> {
  if (input.snapshot.role !== "moderador") {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Solo el moderador puede interpretar instrucciones de presentación.",
    };
  }
  const direct = interpretDirectInstruction(input);
  if (direct) return direct;

  if (!createGeminiProvider() && generate === defaultGenerate) {
    return { ok: false, code: "SERVICE_UNAVAILABLE" };
  }

  const context = buildInterpretModelContext({
    meetingId: input.meetingId,
    instruction: input.instruction,
    snapshot: input.snapshot,
  });
  const prompt = buildInterpretPrompt(input.instruction, context);

  const first = await generate(prompt.systemInstruction, prompt.userText);
  if (!first.ok) return first;

  let normalized = normalizeModelStructuredOutput(extractJsonObject(first.text));
  const providerCalled = true;

  if (!normalized) {
    const repair = await generate(
      prompt.systemInstruction,
      `${prompt.userText}\n\nTu respuesta anterior no era JSON válido. Devuelve únicamente el objeto JSON del contrato.`,
    );
    if (!repair.ok) return repair;
    normalized = normalizeModelStructuredOutput(extractJsonObject(repair.text));
    if (!normalized) {
      return { ok: false, code: "AI_EMPTY_RESPONSE" };
    }
  }

  const parsed = parseMonitorAiStructuredResponse(normalized);
  if (!parsed.ok) {
    const fallback = fallbackFromInvalidActions(
      typeof normalized.message === "string" ? normalized.message : "",
      parsed.errors,
    );
    return {
      ok: true,
      body: successBody(input.meetingId, input.snapshot, fallback, [], providerCalled),
    };
  }

  // El resaltado se valida contra el catálogo del informe, no contra la vista actual:
  // el cliente puede navegar y luego aplicar. La IA no escribe S.pos.
  const snapshotForValidation: PresentationControllerSnapshot = {
    ...input.snapshot,
    view: undefined,
  };
  const validated = validateMonitorAiStructuredResponse(parsed.response, snapshotForValidation);
  if (!validated.ok) {
    const fallback = fallbackFromInvalidActions(parsed.response.message, validated.errors);
    return {
      ok: true,
      body: successBody(input.meetingId, input.snapshot, fallback, [], providerCalled),
    };
  }

  return {
    ok: true,
    body: successBody(
      input.meetingId,
      input.snapshot,
      validated.response,
      validated.effects,
      providerCalled,
    ),
  };
}
