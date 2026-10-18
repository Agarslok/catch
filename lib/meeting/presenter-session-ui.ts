import {
  presenterInPreMeetingReview,
  visitorSeesMeeting,
  type MonitorSessionPhase,
} from "./monitor-session-phase";

export const PRESENTER_HISTORY_STEPS = ["carga", "revision", "en_vivo"] as const;

export type PresenterHistoryStep = (typeof PRESENTER_HISTORY_STEPS)[number];

export type PresenterRailPanel = "templates" | "faqs" | "live";

const HISTORY_ORDER: Record<PresenterHistoryStep, number> = {
  carga: 0,
  revision: 1,
  en_vivo: 2,
};

export function isPresenterHistoryStep(v: unknown): v is PresenterHistoryStep {
  return v === "carga" || v === "revision" || v === "en_vivo";
}

/** Panel derecho: plantillas en carga, FAQs en edición, participación en vivo. */
export function presenterRailPanel(
  phase: MonitorSessionPhase,
  opts?: { generating?: boolean },
): PresenterRailPanel {
  if (opts?.generating || phase === "preparacion" || phase === "generando_informe") {
    return "templates";
  }
  if (presenterInPreMeetingReview(phase)) return "faqs";
  return "live";
}

export function historyStepFromPhase(
  phase: MonitorSessionPhase,
  opts?: { generating?: boolean },
): PresenterHistoryStep {
  if (opts?.generating || phase === "preparacion" || phase === "generando_informe") {
    return "carga";
  }
  if (presenterInPreMeetingReview(phase)) return "revision";
  return "en_vivo";
}

export function phaseFromHistoryStep(step: PresenterHistoryStep): MonitorSessionPhase {
  if (step === "carga") return "preparacion";
  if (step === "revision") return "revision_previa";
  return "reunion_activa";
}

export function nextHistoryPushes(
  current: PresenterHistoryStep | null,
  desired: PresenterHistoryStep,
): { replaceBase: PresenterHistoryStep | null; push: PresenterHistoryStep[] } {
  if (current === desired) return { replaceBase: null, push: [] };
  if (current === null) {
    if (desired === "carga") return { replaceBase: "carga", push: [] };
    if (desired === "revision") return { replaceBase: "carga", push: ["revision"] };
    return { replaceBase: "carga", push: ["revision", "en_vivo"] };
  }
  if (HISTORY_ORDER[desired] <= HISTORY_ORDER[current]) {
    return { replaceBase: null, push: [] };
  }
  const push: PresenterHistoryStep[] = [];
  for (const step of PRESENTER_HISTORY_STEPS) {
    if (HISTORY_ORDER[step] > HISTORY_ORDER[current] && HISTORY_ORDER[step] <= HISTORY_ORDER[desired]) {
      push.push(step);
    }
  }
  return { replaceBase: null, push };
}

export function applyPresenterHistoryPop(
  popped: unknown,
  currentPhase: MonitorSessionPhase,
): {
  applied: boolean;
  phase: MonitorSessionPhase;
  abortGeneration: boolean;
  visitorWaiting: boolean;
} {
  if (!isPresenterHistoryStep(popped)) {
    return {
      applied: false,
      phase: currentPhase,
      abortGeneration: false,
      visitorWaiting: !visitorSeesMeeting(currentPhase),
    };
  }
  const phase = phaseFromHistoryStep(popped);
  return {
    applied: phase !== currentPhase || popped === "carga",
    phase,
    abortGeneration: popped === "carga",
    visitorWaiting: !visitorSeesMeeting(phase),
  };
}
