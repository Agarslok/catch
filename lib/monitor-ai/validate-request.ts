import {
  chartBelongsToSection,
  isMonitorChartId,
  isMonitorSectionIndex,
  isMonitorSectionKey,
  sectionKeyForIndex,
} from "./catalog";
import type {
  MonitorAiChatRequestBody,
  MonitorAiErrorCode,
  MonitorAiValidatedRequest,
  MonitorChartId,
  MonitorSectionIndex,
  MonitorSectionKey,
} from "./types";
import { buildContextForProvider, MAX_CONTEXT_BLOCK_BYTES, MAX_QUESTION_LENGTH } from "./context-policy";
import { parseMonitorAiViewContext } from "./view-context";

const ALLOWED_BODY_KEYS = new Set([
  "question",
  "sectionIndex",
  "sectionKey",
  "chartId",
  "presentationStep",
  "viewContext",
  "contextBlock",
  "editionLabel",
  "participantId",
]);

const MAX_PRESENTATION_STEP = 200;

export type ValidateRequestResult =
  | { ok: true; value: Omit<MonitorAiValidatedRequest, "caller"> }
  | { ok: false; code: MonitorAiErrorCode; message?: string };

function meetingIdValid(meetingId: string): boolean {
  const t = meetingId.trim();
  if (!t || t.length > 120) return false;
  return /^[a-zA-Z0-9._-]+$/.test(t);
}

export function validateMonitorAiRequest(
  meetingId: string,
  raw: unknown,
): ValidateRequestResult {
  if (!meetingIdValid(meetingId)) {
    return { ok: false, code: "INVALID_REQUEST", message: "meetingId inválido." };
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, code: "INVALID_REQUEST", message: "Cuerpo JSON inválido." };
  }

  const body = raw as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (!ALLOWED_BODY_KEYS.has(key)) {
      return { ok: false, code: "INVALID_REQUEST", message: `Campo no permitido: ${key}` };
    }
  }

  const typed = body as MonitorAiChatRequestBody;
  const question = (typed.question ?? "").trim();
  if (!question || question.length > MAX_QUESTION_LENGTH) {
    return {
      ok: false,
      code: "INVALID_REQUEST",
      message: `La pregunta debe tener entre 1 y ${MAX_QUESTION_LENGTH} caracteres.`,
    };
  }

  let sectionIndex: MonitorSectionIndex | undefined;
  if (typed.sectionIndex !== undefined && typed.sectionIndex !== null) {
    if (!isMonitorSectionIndex(typed.sectionIndex)) {
      return { ok: false, code: "INVALID_REQUEST", message: "sectionIndex inválido." };
    }
    sectionIndex = typed.sectionIndex;
  }

  let sectionKey: MonitorSectionKey | undefined;
  if (typed.sectionKey !== undefined && typed.sectionKey !== null) {
    const sk = String(typed.sectionKey).trim();
    if (!isMonitorSectionKey(sk)) {
      return { ok: false, code: "INVALID_REQUEST", message: "sectionKey inválido." };
    }
    sectionKey = sk;
  }

  if (sectionIndex !== undefined && sectionKey !== undefined) {
    if (sectionKeyForIndex(sectionIndex) !== sectionKey) {
      return {
        ok: false,
        code: "INVALID_REQUEST",
        message: "sectionIndex y sectionKey no coinciden.",
      };
    }
  } else if (sectionIndex !== undefined) {
    sectionKey = sectionKeyForIndex(sectionIndex);
  } else if (sectionKey !== undefined) {
    const idx = MONITOR_SECTION_KEYS_INDEX(sectionKey);
    if (idx === undefined) {
      return { ok: false, code: "INVALID_REQUEST", message: "sectionKey inválido." };
    }
    sectionIndex = idx;
  }

  let chartId: MonitorChartId | null | undefined;
  if (typed.chartId !== undefined && typed.chartId !== null) {
    const cid = String(typed.chartId).trim();
    if (!isMonitorChartId(cid)) {
      return { ok: false, code: "INVALID_REQUEST", message: "chartId inválido." };
    }
    chartId = cid;
    if (sectionIndex !== undefined && !chartBelongsToSection(chartId, sectionIndex)) {
      return {
        ok: false,
        code: "INVALID_REQUEST",
        message: "chartId no pertenece a la sección indicada.",
      };
    }
  } else if (typed.chartId === null) {
    chartId = null;
  }

  if (typed.presentationStep !== undefined && typed.presentationStep !== null) {
    const step = typed.presentationStep;
    if (!Number.isInteger(step) || step < 0 || step > MAX_PRESENTATION_STEP) {
      return { ok: false, code: "INVALID_REQUEST", message: "presentationStep inválido." };
    }
  }

  const contextBlock = typed.contextBlock !== undefined ? String(typed.contextBlock) : "";
  const contextBytes = new TextEncoder().encode(contextBlock).length;
  if (contextBytes > MAX_CONTEXT_BLOCK_BYTES) {
    return { ok: false, code: "CONTEXT_TOO_LARGE" };
  }

  /** v2B: no se usa como evidencia numérica; solo metadatos de navegación en el servicio. */
  const contextForProvider = buildContextForProvider("", sectionKey);

  const editionLabel =
    typed.editionLabel !== undefined ? String(typed.editionLabel).trim().slice(0, 80) : undefined;

  let viewContext;
  if (typed.viewContext !== undefined && typed.viewContext !== null) {
    const parsed = parseMonitorAiViewContext(typed.viewContext);
    if (!parsed) {
      return { ok: false, code: "INVALID_REQUEST", message: "viewContext inválido." };
    }
    viewContext = parsed;
    if (
      presentationStepFromBody(typed) !== undefined &&
      viewContext.presentationStep !== presentationStepFromBody(typed)
    ) {
      return {
        ok: false,
        code: "INVALID_REQUEST",
        message: "viewContext.presentationStep no coincide con presentationStep.",
      };
    }
  }

  return {
    ok: true,
    value: {
      meetingId: meetingId.trim(),
      question,
      sectionIndex,
      sectionKey,
      chartId,
      presentationStep: presentationStepFromBody(typed),
      contextForProvider,
      editionLabel,
      viewContext,
    },
  };
}

function presentationStepFromBody(typed: MonitorAiChatRequestBody): number | undefined {
  if (typed.presentationStep !== undefined && typed.presentationStep !== null) {
    return typed.presentationStep;
  }
  return undefined;
}

function MONITOR_SECTION_KEYS_INDEX(key: MonitorSectionKey): MonitorSectionIndex | undefined {
  const map: Record<MonitorSectionKey, MonitorSectionIndex> = {
    muestra: 0,
    salarios: 1,
    beneficios: 2,
    indicadores: 3,
    patrones: 4,
  };
  return map[key];
}
