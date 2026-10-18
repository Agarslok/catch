import {
  isMonitorChartId,
  isMonitorSectionIndex,
  isMonitorSectionKey,
  MONITOR_SECTION_KEYS,
  sectionKeyForIndex,
} from "./catalog";
import { MAX_RESPONSE_MESSAGE_LENGTH } from "./context-policy";
import { buildHighlightActionFromProposal } from "./validate-highlight";
import { validateMonitorAiAction } from "./validate-response";
import type { MonitorAiViewContext } from "./view-context";
import type {
  MonitorAiAction,
  MonitorAiCallerRole,
  MonitorChartId,
  MonitorSectionIndex,
  MonitorSectionKey,
} from "./types";
import {
  buildMonitorPasos,
  findPasoIndexForChart,
  type MonitorPaso,
} from "@/lib/meeting/monitor-pasos";
import {
  evaluateNarrationAdvanceGate,
  type MonitorNarrationRole,
} from "@/lib/meeting/monitor-narration-gate";
import { planMonitorNarration } from "@/lib/meeting/monitor-narration-plan";
import type { MeetingPresentationStatus } from "@/lib/meeting/session-types";

/** Contrato de propuestas estructuradas (intención IA → validación → controlador). */
export const MONITOR_PRESENTATION_ACTION_CONTRACT = "catch.monitor.presentation.actions.v1";

export type PresentationActionType =
  | "start_presentation"
  | "explain_slide"
  | "highlight_element"
  | "next_slide"
  | "previous_slide"
  | "go_to_section"
  | "repeat_explanation"
  | "pause_presentation"
  | "resume_presentation"
  | "ask_for_questions"
  | "continue_section"
  | "finish_presentation";

export type PresentationActionAvailability = "available" | "pending";

export const PRESENTATION_ACTION_CATALOG: Record<
  PresentationActionType,
  { availability: PresentationActionAvailability; description: string }
> = {
  highlight_element: {
    availability: "available",
    description: "Resaltar un elemento válido de una gráfica del informe activo.",
  },
  explain_slide: {
    availability: "available",
    description: "Narrar o explicar la diapositiva o gráfica actual sin cambiar posición.",
  },
  next_slide: {
    availability: "available",
    description: "Avanzar un paso en la presentación (sujeto a permisos y bloqueo de sección).",
  },
  previous_slide: {
    availability: "available",
    description: "Retroceder un paso (solo moderador).",
  },
  go_to_section: {
    availability: "available",
    description: "Ir al inicio de una sección del informe.",
  },
  repeat_explanation: {
    availability: "available",
    description: "Repetir la explicación del paso actual.",
  },
  pause_presentation: {
    availability: "available",
    description: "Pausar la presentación en vivo.",
  },
  resume_presentation: {
    availability: "available",
    description: "Reanudar una presentación pausada.",
  },
  ask_for_questions: {
    availability: "available",
    description: "Invitar a preguntas sin cambiar la posición.",
  },
  continue_section: {
    availability: "available",
    description: "Autorizar el avance tras el cierre de sección (solo moderador en espera).",
  },
  finish_presentation: {
    availability: "available",
    description: "Ir al paso de cierre de la presentación.",
  },
  start_presentation: {
    availability: "pending",
    description: "Iniciar la presentación desde cero (pendiente de cableado al controlador).",
  },
};

const PRESENTATION_ACTION_TYPES = new Set<string>(Object.keys(PRESENTATION_ACTION_CATALOG));

export type PresentationActionRefs = {
  sectionKey?: MonitorSectionKey;
  sectionIndex?: MonitorSectionIndex;
  chartId?: MonitorChartId;
  presentationStep?: number;
};

export type PresentationActionProposal =
  | { type: "highlight_element"; chartId: string; category?: string; seriesKey?: string; index?: number; datasetIndex?: number; reason?: string }
  | { type: "explain_slide"; chartId?: string; reason?: string }
  | { type: "next_slide" }
  | { type: "previous_slide" }
  | { type: "go_to_section"; sectionKey?: string; sectionIndex?: number; chartId?: string }
  | { type: "repeat_explanation" }
  | { type: "pause_presentation" }
  | { type: "resume_presentation" }
  | { type: "ask_for_questions" }
  | { type: "continue_section" }
  | { type: "finish_presentation" }
  | { type: "start_presentation" };

export type MonitorAiStructuredResponse = {
  contract: typeof MONITOR_PRESENTATION_ACTION_CONTRACT;
  message: string;
  actions: PresentationActionProposal[];
  refs?: PresentationActionRefs;
  completion?: "complete" | "needs_confirmation";
  clarificationRequest?: string;
};

export type PresentationControllerSnapshot = {
  stepIndex: number;
  stepCount: number;
  presentationStatus: MeetingPresentationStatus;
  role: MonitorNarrationRole | MonitorAiCallerRole;
  view?: MonitorAiViewContext;
};

export type PresentationExecutableEffect =
  | { kind: "monitor_highlight"; action: MonitorAiAction }
  | { kind: "navigate"; targetStep: number }
  | { kind: "set_presentation_status"; status: MeetingPresentationStatus }
  | { kind: "narration"; intent: "explain" | "repeat" | "ask_questions" }
  | { kind: "section_continue" };

export type ValidatedPresentationAction = {
  proposal: PresentationActionProposal;
  effects: PresentationExecutableEffect[];
};

export type StructuredResponseParseResult =
  | { ok: true; response: MonitorAiStructuredResponse }
  | { ok: false; errors: string[] };

export type StructuredResponseValidationResult =
  | {
      ok: true;
      response: MonitorAiStructuredResponse;
      validatedActions: ValidatedPresentationAction[];
      effects: PresentationExecutableEffect[];
    }
  | { ok: false; errors: string[] };

function trimMessage(raw: string): string {
  const noHtml = raw.trim().replace(/<[^>]*>/g, "");
  if (noHtml.length > MAX_RESPONSE_MESSAGE_LENGTH) {
    return noHtml.slice(0, MAX_RESPONSE_MESSAGE_LENGTH).trim();
  }
  return noHtml;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function parseRefs(raw: unknown): PresentationActionRefs | undefined {
  if (!isRecord(raw)) return undefined;
  const refs: PresentationActionRefs = {};
  if (typeof raw.sectionKey === "string" && isMonitorSectionKey(raw.sectionKey)) {
    refs.sectionKey = raw.sectionKey;
  } else if (raw.sectionKey !== undefined) {
    return undefined;
  }
  if (raw.sectionIndex !== undefined) {
    const si = raw.sectionIndex;
    if (typeof si !== "number" || !isMonitorSectionIndex(si)) return undefined;
    refs.sectionIndex = si;
  }
  if (typeof raw.chartId === "string" && isMonitorChartId(raw.chartId)) {
    refs.chartId = raw.chartId;
  } else if (raw.chartId !== undefined) {
    return undefined;
  }
  if (raw.presentationStep !== undefined) {
    if (!Number.isInteger(raw.presentationStep) || (raw.presentationStep as number) < 0) {
      return undefined;
    }
    refs.presentationStep = raw.presentationStep as number;
  }
  return Object.keys(refs).length ? refs : undefined;
}

function parseProposal(raw: unknown): PresentationActionProposal | null {
  if (!isRecord(raw)) return null;
  const type = raw.type;
  if (typeof type !== "string" || !PRESENTATION_ACTION_TYPES.has(type)) return null;

  switch (type) {
    case "highlight_element": {
      if (typeof raw.chartId !== "string") return null;
      return {
        type: "highlight_element",
        chartId: raw.chartId,
        category: typeof raw.category === "string" ? raw.category : undefined,
        seriesKey: typeof raw.seriesKey === "string" ? raw.seriesKey : undefined,
        index: Number.isInteger(raw.index) ? (raw.index as number) : undefined,
        datasetIndex: Number.isInteger(raw.datasetIndex) ? (raw.datasetIndex as number) : undefined,
        reason: typeof raw.reason === "string" ? raw.reason.slice(0, 200) : undefined,
      };
    }
    case "explain_slide":
      return {
        type: "explain_slide",
        chartId: typeof raw.chartId === "string" ? raw.chartId : undefined,
        reason: typeof raw.reason === "string" ? raw.reason.slice(0, 200) : undefined,
      };
    case "next_slide":
      return { type: "next_slide" };
    case "previous_slide":
      return { type: "previous_slide" };
    case "go_to_section":
      return {
        type: "go_to_section",
        sectionKey: typeof raw.sectionKey === "string" ? raw.sectionKey : undefined,
        sectionIndex: Number.isInteger(raw.sectionIndex) ? (raw.sectionIndex as number) : undefined,
        chartId: typeof raw.chartId === "string" ? raw.chartId : undefined,
      };
    case "repeat_explanation":
      return { type: "repeat_explanation" };
    case "pause_presentation":
      return { type: "pause_presentation" };
    case "resume_presentation":
      return { type: "resume_presentation" };
    case "ask_for_questions":
      return { type: "ask_for_questions" };
    case "continue_section":
      return { type: "continue_section" };
    case "finish_presentation":
      return { type: "finish_presentation" };
    case "start_presentation":
      return { type: "start_presentation" };
    default:
      return null;
  }
}

/** Valida la forma de la respuesta estructurada (sin estado del controlador). */
export function parseMonitorAiStructuredResponse(raw: unknown): StructuredResponseParseResult {
  if (!isRecord(raw)) {
    return { ok: false, errors: ["response must be an object"] };
  }
  if (raw.contract !== MONITOR_PRESENTATION_ACTION_CONTRACT) {
    return { ok: false, errors: ["invalid or missing contract"] };
  }
  if (typeof raw.message !== "string" || !raw.message.trim()) {
    return { ok: false, errors: ["message is required"] };
  }
  const clarification =
    typeof raw.clarificationRequest === "string" ? raw.clarificationRequest.trim() : undefined;
  if (clarification && clarification.length > 500) {
    return { ok: false, errors: ["clarificationRequest too long"] };
  }
  const actions: PresentationActionProposal[] = [];
  if (raw.actions !== undefined) {
    if (!Array.isArray(raw.actions)) {
      return { ok: false, errors: ["actions must be an array"] };
    }
    for (const item of raw.actions) {
      const p = parseProposal(item);
      if (!p) return { ok: false, errors: ["invalid action proposal"] };
      actions.push(p);
    }
  }
  if (clarification && actions.length > 0) {
    return { ok: false, errors: ["clarification and actions are mutually exclusive"] };
  }
  let refs: PresentationActionRefs | undefined;
  if (raw.refs !== undefined) {
    refs = parseRefs(raw.refs);
    if (raw.refs != null && refs === undefined && Object.keys(raw.refs as object).length > 0) {
      return { ok: false, errors: ["invalid refs"] };
    }
  }
  let completion: MonitorAiStructuredResponse["completion"];
  if (raw.completion !== undefined) {
    if (raw.completion !== "complete" && raw.completion !== "needs_confirmation") {
      return { ok: false, errors: ["invalid completion"] };
    }
    completion = raw.completion;
  }
  return {
    ok: true,
    response: {
      contract: MONITOR_PRESENTATION_ACTION_CONTRACT,
      message: trimMessage(raw.message),
      actions,
      refs,
      completion,
      clarificationRequest: clarification || undefined,
    },
  };
}

function isModeratorRole(role: string): boolean {
  return role === "moderador";
}

function pasoCount(): number {
  return buildMonitorPasos().length;
}

function findSectionStartStep(sectionIndex: MonitorSectionIndex): number {
  const pasos = buildMonitorPasos();
  return pasos.findIndex(
    (p): p is Extract<MonitorPaso, { tipo: "explica" }> =>
      p.tipo === "explica" && p.sectionIndex === sectionIndex,
  );
}

function resolveSectionIndex(proposal: Extract<PresentationActionProposal, { type: "go_to_section" }>): MonitorSectionIndex | null {
  if (proposal.sectionIndex !== undefined && isMonitorSectionIndex(proposal.sectionIndex)) {
    return proposal.sectionIndex;
  }
  if (proposal.sectionKey && isMonitorSectionKey(proposal.sectionKey)) {
    const idx = MONITOR_SECTION_KEYS.indexOf(proposal.sectionKey);
    return isMonitorSectionIndex(idx) ? (idx as MonitorSectionIndex) : null;
  }
  return null;
}

function validateSingleAction(
  proposal: PresentationActionProposal,
  ctx: PresentationControllerSnapshot,
): { ok: true; effects: PresentationExecutableEffect[] } | { ok: false; errors: string[] } {
  const meta = PRESENTATION_ACTION_CATALOG[proposal.type];
  if (meta.availability === "pending") {
    return { ok: false, errors: [`${proposal.type} is not available yet`] };
  }

  const { stepIndex, stepCount, presentationStatus, role, view } = ctx;
  const moderator = isModeratorRole(role);

  switch (proposal.type) {
    case "highlight_element": {
      const built = buildHighlightActionFromProposal(
        {
          chartId: proposal.chartId,
          category: proposal.category,
          seriesKey: proposal.seriesKey,
          index: proposal.index,
          datasetIndex: proposal.datasetIndex,
          reason: proposal.reason,
        },
        view,
      );
      if (!built.ok) return built;
      const legacy = validateMonitorAiAction(built.action);
      if (!legacy.ok) return legacy;
      return { ok: true, effects: [{ kind: "monitor_highlight", action: legacy.action }] };
    }
    case "explain_slide": {
      const explainChartId =
        proposal.chartId && isMonitorChartId(proposal.chartId) ? proposal.chartId : null;
      if (proposal.chartId && !explainChartId) {
        return { ok: false, errors: ["invalid chartId for explain_slide"] };
      }
      if (explainChartId && view && !view.visibleChartIds.includes(explainChartId)) {
        return { ok: false, errors: ["chart not visible for explain_slide"] };
      }
      return { ok: true, effects: [{ kind: "narration", intent: "explain" }] };
    }
    case "next_slide": {
      if (!moderator) {
        return { ok: false, errors: ["next_slide requires moderador"] };
      }
      if (presentationStatus === "paused") {
        return { ok: false, errors: ["presentation is paused"] };
      }
      const gate = evaluateNarrationAdvanceGate({
        stepIndex,
        role: role as MonitorNarrationRole,
        intent: "moderator_control",
      });
      if (!gate.mayAdvance) {
        return { ok: false, errors: ["navigation not permitted"] };
      }
      if (stepIndex >= stepCount - 1) {
        return { ok: false, errors: ["already at last step"] };
      }
      const targetStep = stepIndex + 1;
      return { ok: true, effects: [{ kind: "navigate", targetStep }] };
    }
    case "previous_slide": {
      if (!moderator) {
        return { ok: false, errors: ["previous_slide requires moderador"] };
      }
      if (presentationStatus === "paused") {
        return { ok: false, errors: ["presentation is paused"] };
      }
      if (stepIndex <= 0) {
        return { ok: false, errors: ["already at first step"] };
      }
      const gate = evaluateNarrationAdvanceGate({
        stepIndex,
        role: role as MonitorNarrationRole,
        intent: "moderator_control",
      });
      if (!gate.mayAdvance) {
        return { ok: false, errors: ["navigation not permitted"] };
      }
      return { ok: true, effects: [{ kind: "navigate", targetStep: stepIndex - 1 }] };
    }
    case "go_to_section": {
      if (!moderator) {
        return { ok: false, errors: ["go_to_section requires moderador"] };
      }
      if (proposal.chartId) {
        if (!isMonitorChartId(proposal.chartId)) {
          return { ok: false, errors: ["invalid chartId"] };
        }
        const target = findPasoIndexForChart(proposal.chartId);
        if (target < 0) {
          return { ok: false, errors: ["chart has no presentation step"] };
        }
        const chartSection = sectionKeyForIndex(
          (buildMonitorPasos()[target] as Extract<MonitorPaso, { tipo: "explica" }>).sectionIndex,
        );
        if (proposal.sectionKey && isMonitorSectionKey(proposal.sectionKey) && proposal.sectionKey !== chartSection) {
          return { ok: false, errors: ["chart does not belong to that section"] };
        }
        if (target === stepIndex) {
          return { ok: true, effects: [] };
        }
        return { ok: true, effects: [{ kind: "navigate", targetStep: target }] };
      }
      const sectionIndex = resolveSectionIndex(proposal);
      if (sectionIndex === null) {
        return { ok: false, errors: ["invalid section reference"] };
      }
      const target = findSectionStartStep(sectionIndex);
      if (target < 0) {
        return { ok: false, errors: ["section has no steps"] };
      }
      if (target === stepIndex) {
        return { ok: true, effects: [] };
      }
      return { ok: true, effects: [{ kind: "navigate", targetStep: target }] };
    }
    case "repeat_explanation": {
      const plan = planMonitorNarration(stepIndex);
      if (!plan.speakText?.trim()) {
        return { ok: false, errors: ["no explanation available to repeat"] };
      }
      return { ok: true, effects: [{ kind: "narration", intent: "repeat" }] };
    }
    case "ask_for_questions":
      return { ok: true, effects: [{ kind: "narration", intent: "ask_questions" }] };
    case "pause_presentation": {
      if (!moderator) {
        return { ok: false, errors: ["pause_presentation requires moderador"] };
      }
      if (presentationStatus === "paused") {
        return { ok: false, errors: ["presentation already paused"] };
      }
      return { ok: true, effects: [{ kind: "set_presentation_status", status: "paused" }] };
    }
    case "resume_presentation": {
      if (!moderator) {
        return { ok: false, errors: ["resume_presentation requires moderador"] };
      }
      if (presentationStatus !== "paused") {
        return { ok: false, errors: ["presentation is not paused"] };
      }
      return { ok: true, effects: [{ kind: "set_presentation_status", status: "live" }] };
    }
    case "continue_section": {
      if (!moderator) {
        return { ok: false, errors: ["continue_section requires moderador"] };
      }
      if (presentationStatus === "paused") {
        return { ok: false, errors: ["presentation is paused"] };
      }
      const gate = evaluateNarrationAdvanceGate({
        stepIndex,
        role: role as MonitorNarrationRole,
        intent: "narration",
      });
      if (!gate.awaitingModerator) {
        return { ok: false, errors: ["not awaiting section continuation"] };
      }
      if (stepIndex >= stepCount - 1) {
        return { ok: false, errors: ["already at last step"] };
      }
      return {
        ok: true,
        effects: [
          { kind: "section_continue" },
          { kind: "navigate", targetStep: stepIndex + 1 },
        ],
      };
    }
    case "finish_presentation": {
      if (!moderator) {
        return { ok: false, errors: ["finish_presentation requires moderador"] };
      }
      const cierre = stepCount - 1;
      return { ok: true, effects: [{ kind: "navigate", targetStep: cierre }] };
    }
    default:
      return { ok: false, errors: ["unknown action"] };
  }
}

/** Valida estructura, permisos, IDs y estado del controlador; materializa efectos internos. */
export function validateMonitorAiStructuredResponse(
  raw: unknown,
  ctx: PresentationControllerSnapshot,
): StructuredResponseValidationResult {
  const parsed = parseMonitorAiStructuredResponse(raw);
  if (!parsed.ok) return parsed;

  const response = parsed.response;
  if (response.clarificationRequest) {
    return { ok: true, response, validatedActions: [], effects: [] };
  }

  const stepCount = ctx.stepCount > 0 ? ctx.stepCount : pasoCount();
  const snapshot: PresentationControllerSnapshot = { ...ctx, stepCount };

  if (response.refs?.sectionKey && response.refs.sectionIndex !== undefined) {
    const keyFromIdx = sectionKeyForIndex(response.refs.sectionIndex);
    if (keyFromIdx !== response.refs.sectionKey) {
      return { ok: false, errors: ["refs sectionKey and sectionIndex disagree"] };
    }
  }

  const validatedActions: ValidatedPresentationAction[] = [];
  const effects: PresentationExecutableEffect[] = [];

  for (const proposal of response.actions) {
    const result = validateSingleAction(proposal, snapshot);
    if (!result.ok) {
      return { ok: false, errors: result.errors.map((e) => `${proposal.type}: ${e}`) };
    }
    validatedActions.push({ proposal, effects: result.effects });
    effects.push(...result.effects);
  }

  return { ok: true, response, validatedActions, effects };
}

/** Convierte highlight_element al contrato legacy catch.monitor.ai.v1 (highlight). */
export function toLegacyMonitorAiAction(
  proposal: PresentationActionProposal,
  view?: MonitorAiViewContext,
): MonitorAiAction | null {
  if (proposal.type !== "highlight_element") return null;
  const built = buildHighlightActionFromProposal(
    {
      chartId: proposal.chartId,
      category: proposal.category,
      seriesKey: proposal.seriesKey,
      index: proposal.index,
      datasetIndex: proposal.datasetIndex,
      reason: proposal.reason,
    },
    view,
  );
  if (!built.ok) return null;
  const legacy = validateMonitorAiAction(built.action);
  return legacy.ok ? legacy.action : null;
}

export function defaultControllerSnapshot(
  overrides: Partial<PresentationControllerSnapshot> = {},
): PresentationControllerSnapshot {
  return {
    stepIndex: 0,
    stepCount: pasoCount(),
    presentationStatus: "live",
    role: "moderador",
    ...overrides,
  };
}

const ACTION_AVAILABILITY_PROBES: PresentationActionProposal[] = [
  { type: "explain_slide" },
  { type: "next_slide" },
  { type: "previous_slide" },
  { type: "go_to_section", sectionKey: "muestra" },
  { type: "repeat_explanation" },
  { type: "pause_presentation" },
  { type: "resume_presentation" },
  { type: "ask_for_questions" },
  { type: "continue_section" },
  { type: "finish_presentation" },
];

/**
 * Acciones que el controlador aceptaría ahora. El modelo no puede ampliar esta lista.
 */
export function listAvailablePresentationActions(
  ctx: PresentationControllerSnapshot,
): PresentationActionType[] {
  const stepCount = ctx.stepCount > 0 ? ctx.stepCount : pasoCount();
  const snapshot: PresentationControllerSnapshot = { ...ctx, stepCount };
  const out: PresentationActionType[] = [];
  for (const probe of ACTION_AVAILABILITY_PROBES) {
    if (PRESENTATION_ACTION_CATALOG[probe.type].availability !== "available") continue;
    if (validateSingleAction(probe, snapshot).ok) out.push(probe.type);
  }
  if (PRESENTATION_ACTION_CATALOG.highlight_element.availability === "available") {
    out.push("highlight_element");
  }
  return out;
}

export function validateModeratorJump(
  targetStep: number,
  ctx: PresentationControllerSnapshot,
): { ok: true; effects: PresentationExecutableEffect[] } | { ok: false; errors: string[] } {
  if (!isModeratorRole(ctx.role)) {
    return { ok: false, errors: ["navigation requires moderador"] };
  }
  const stepCount = ctx.stepCount > 0 ? ctx.stepCount : pasoCount();
  if (!Number.isInteger(targetStep) || targetStep < 0 || targetStep >= stepCount) {
    return { ok: false, errors: ["invalid target step"] };
  }
  if (targetStep === ctx.stepIndex) {
    return { ok: true, effects: [] };
  }
  return { ok: true, effects: [{ kind: "navigate", targetStep }] };
}

export { findPasoIndexForChart, findSectionStartStep };
