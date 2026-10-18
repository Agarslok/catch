import {
  buildMonitorPasos,
  type MonitorPaso,
  type MonitorPasoTipo,
} from "./monitor-pasos";
import { evaluateNarrationAdvanceGate } from "./monitor-narration-gate";
import {
  isConfirmedNarrationEnd,
  type NarrationEndSource,
} from "./presentation-recovery";
import { getPointById, specialPointId } from "./script";
import type { ScriptPoint, SessionScript } from "./script-types";

/** Duración estimada del eco Tavus para demos (sin señal de fin del proveedor). */
export function estimateNarrationDurationMs(text: string | null | undefined): number {
  const t = (text ?? "").trim();
  if (!t) return 0;
  const words = t.split(/\s+/).length;
  return Math.min(45_000, Math.max(1_200, words * 380));
}

export type SectionCloseDedup = {
  anchorStep: number;
  sectionIndex: number;
  execId: string;
};

export type SectionNarrationEndInput = {
  stepIndex: number;
  execId: string;
  currentStepIndex: number;
  runtimeExecId: string | null;
  pasos: MonitorPaso[];
  dedup: SectionCloseDedup | null;
  narrationFinished: boolean;
  endSource?: NarrationEndSource;
};

export type SectionNarrationEndDecision =
  | { kind: "ignore"; reason: string }
  | { kind: "deduped"; reason: string }
  | {
      kind: "navigate_next_slide";
      targetStep: number;
      sectionIndex: number;
      dedup: SectionCloseDedup;
    }
  | {
      kind: "navigate_hoja";
      targetStep: number;
      sectionIndex: number;
      dedup: SectionCloseDedup;
    }
  | {
      kind: "await_moderator";
      sectionIndex: number;
      atStep: number;
      dedup: SectionCloseDedup;
    };

export function sectionIndexAtPaso(paso: MonitorPaso | undefined): number | null {
  if (!paso) return null;
  if (paso.tipo === "explica" || paso.tipo === "hoja") return paso.sectionIndex;
  return null;
}

export function hojaStepForSection(sectionIndex: number, pasos = buildMonitorPasos()): number {
  return pasos.findIndex((p) => p.tipo === "hoja" && p.sectionIndex === sectionIndex);
}

export function lastExplicaStepForSection(
  sectionIndex: number,
  pasos = buildMonitorPasos(),
): number {
  let last = -1;
  pasos.forEach((p, i) => {
    if (p.tipo === "explica" && p.sectionIndex === sectionIndex) last = i;
  });
  return last;
}

export function firstStepOfNextSection(
  sectionIndex: number,
  pasos = buildMonitorPasos(),
): number | null {
  const next = sectionIndex + 1;
  const idx = pasos.findIndex((p) => p.tipo === "explica" && p.sectionIndex === next);
  return idx >= 0 ? idx : null;
}

export function isLastExplicaStep(stepIndex: number, pasos = buildMonitorPasos()): boolean {
  const paso = pasos[stepIndex];
  if (!paso || paso.tipo !== "explica") return false;
  return stepIndex === lastExplicaStepForSection(paso.sectionIndex, pasos);
}

export function evaluateMonitorNarrationEnd(
  input: SectionNarrationEndInput,
): SectionNarrationEndDecision {
  const {
    stepIndex,
    execId,
    currentStepIndex,
    runtimeExecId,
    pasos,
    dedup,
    narrationFinished,
    endSource,
  } = input;

  if (!isConfirmedNarrationEnd(endSource, narrationFinished)) {
    return {
      kind: "ignore",
      reason: endSource === "timer_estimate" ? "unconfirmed_timer" : "narration_not_finished",
    };
  }
  if (!execId || !runtimeExecId || execId !== runtimeExecId) {
    return { kind: "ignore", reason: "stale_exec_id" };
  }
  if (currentStepIndex !== stepIndex) {
    return { kind: "ignore", reason: "step_changed" };
  }

  const paso = pasos[stepIndex];
  if (!paso) return { kind: "ignore", reason: "invalid_step" };

  if (paso.tipo === "explica" && !isLastExplicaStep(stepIndex, pasos)) {
    const next = pasos[stepIndex + 1];
    if (
      next?.tipo === "explica" &&
      next.sectionIndex === paso.sectionIndex
    ) {
      if (dedup && dedup.anchorStep === stepIndex && dedup.execId === execId) {
        return { kind: "deduped", reason: "already_advanced_slide" };
      }
      return {
        kind: "navigate_next_slide",
        targetStep: stepIndex + 1,
        sectionIndex: paso.sectionIndex,
        dedup: { anchorStep: stepIndex, sectionIndex: paso.sectionIndex, execId },
      };
    }
    return { kind: "ignore", reason: "no_same_section_slide" };
  }

  if (paso.tipo === "explica" && isLastExplicaStep(stepIndex, pasos)) {
    const hoja = hojaStepForSection(paso.sectionIndex, pasos);
    if (hoja < 0) return { kind: "ignore", reason: "no_hoja" };
    if (dedup && dedup.anchorStep === stepIndex && dedup.sectionIndex === paso.sectionIndex) {
      return { kind: "deduped", reason: "already_closed" };
    }
    return {
      kind: "navigate_hoja",
      targetStep: hoja,
      sectionIndex: paso.sectionIndex,
      dedup: { anchorStep: stepIndex, sectionIndex: paso.sectionIndex, execId },
    };
  }

  if (paso.tipo === "hoja") {
    if (dedup && dedup.anchorStep === stepIndex && dedup.sectionIndex === paso.sectionIndex) {
      return { kind: "deduped", reason: "already_awaiting" };
    }
    return {
      kind: "await_moderator",
      sectionIndex: paso.sectionIndex,
      atStep: stepIndex,
      dedup: { anchorStep: stepIndex, sectionIndex: paso.sectionIndex, execId },
    };
  }

  return { kind: "ignore", reason: "not_section_boundary" };
}

export function reconcileMonitorAwaitOnNavigate(input: {
  prevStep: number;
  nextStep: number;
  pasos: MonitorPaso[];
}): { awaitingModerator: boolean; clearDedup: boolean } {
  const { prevStep, nextStep, pasos } = input;
  const prev = pasos[prevStep];
  const next = pasos[nextStep];
  const leftHoja =
    prev?.tipo === "hoja" && (next?.tipo !== "hoja" || next.sectionIndex !== prev.sectionIndex);
  if (leftHoja) {
    return { awaitingModerator: false, clearDedup: true };
  }
  const onHoja = next?.tipo === "hoja";
  return { awaitingModerator: onHoja, clearDedup: false };
}

export function continueSectionTargetStep(
  stepIndex: number,
  pasos = buildMonitorPasos(),
): number | null {
  const paso = pasos[stepIndex];
  if (!paso || paso.tipo !== "hoja") return null;
  const next = firstStepOfNextSection(paso.sectionIndex, pasos);
  if (next != null) return next;
  const cierre = pasos.findIndex((p) => p.tipo === "cierre");
  return cierre >= 0 ? cierre : null;
}

export function mayContinueSection(input: {
  stepIndex: number;
  awaitingModerator: boolean;
  role: string;
  pasos?: MonitorPaso[];
}): { ok: boolean; reason?: string; targetStep?: number } {
  const pasos = input.pasos ?? buildMonitorPasos();
  const gate = evaluateNarrationAdvanceGate({
    stepIndex: input.stepIndex,
    role: input.role === "moderador" ? "moderador" : "visitor",
    intent: "narration",
  });
  if (!input.awaitingModerator && !gate.awaitingModerator) {
    return { ok: false, reason: "not_awaiting_moderator" };
  }
  const paso = pasos[input.stepIndex];
  if (!paso || paso.tipo !== "hoja") {
    return { ok: false, reason: "not_on_section_close" };
  }
  const target = continueSectionTargetStep(input.stepIndex, pasos);
  if (target == null) return { ok: false, reason: "no_next_section" };
  return { ok: true, targetStep: target };
}

const CONTINUE_COOLDOWN_MS = 2_500;

export function shouldBlockDuplicateContinue(
  lastContinueAt: number | null,
  now = Date.now(),
): boolean {
  if (lastContinueAt == null) return false;
  return now - lastContinueAt < CONTINUE_COOLDOWN_MS;
}

// —— Session script (app React) ——

export function isLastChartPointInSection(script: SessionScript, point: ScriptPoint): boolean {
  if (point.kind !== "chart" || !point.sectionId) return false;
  const section = script.sections.find((s) => s.id === point.sectionId);
  if (!section) return false;
  const chartIds = section.pointIds.filter((id) => {
    const p = getPointById(script, id);
    return p?.kind === "chart";
  });
  const lastId = chartIds[chartIds.length - 1];
  return lastId === point.id;
}

export function scriptSectionClosureTargets(
  script: SessionScript,
  sectionId: string,
): { sheetPointId: string | null; clarityPointId: string | null } {
  return {
    sheetPointId: specialPointId(script, sectionId, "full_sheet"),
    clarityPointId: specialPointId(script, sectionId, "clarity_check"),
  };
}

export function firstPointOfNextSection(
  script: SessionScript,
  sectionId: string,
): string | null {
  const sec = script.sections.find((s) => s.id === sectionId);
  if (!sec) return null;
  const next = script.sections.find((s) => s.order === sec.order + 1);
  if (!next) return null;
  const first = next.pointIds.find((id) => {
    const p = getPointById(script, id);
    return p?.kind === "chart";
  });
  return first ?? null;
}

export type ScriptNarrationEndInput = {
  pointId: string;
  execId: string;
  currentPointId: string;
  runtimeExecId: string | null;
  script: SessionScript;
  dedupAnchorPointId: string | null;
  narrationFinished: boolean;
  endSource?: NarrationEndSource;
};

export type ScriptNarrationEndDecision =
  | { kind: "ignore"; reason: string }
  | { kind: "deduped"; reason: string }
  | { kind: "go_sheet"; pointId: string; sectionId: string }
  | { kind: "go_clarity"; pointId: string; sectionId: string; awaitingModerator: true };

export function evaluateScriptNarrationEnd(
  input: ScriptNarrationEndInput,
): ScriptNarrationEndDecision {
  const {
    pointId,
    execId,
    currentPointId,
    runtimeExecId,
    script,
    dedupAnchorPointId,
    narrationFinished,
    endSource,
  } = input;

  if (!isConfirmedNarrationEnd(endSource, narrationFinished)) {
    return {
      kind: "ignore",
      reason: endSource === "timer_estimate" ? "unconfirmed_timer" : "narration_not_finished",
    };
  }
  if (!execId || !runtimeExecId || execId !== runtimeExecId) {
    return { kind: "ignore", reason: "stale_exec_id" };
  }
  if (currentPointId !== pointId) return { kind: "ignore", reason: "point_changed" };

  const point = getPointById(script, pointId);
  if (!point?.sectionId) return { kind: "ignore", reason: "no_section" };

  const { sheetPointId, clarityPointId } = scriptSectionClosureTargets(script, point.sectionId);

  if (point.kind === "chart" && isLastChartPointInSection(script, point)) {
    if (!sheetPointId) return { kind: "ignore", reason: "no_sheet" };
    if (dedupAnchorPointId === clarityPointId || dedupAnchorPointId === sheetPointId) {
      return { kind: "deduped", reason: "already_closed" };
    }
    return { kind: "go_sheet", pointId: sheetPointId, sectionId: point.sectionId };
  }

  if (point.kind === "full_sheet" && clarityPointId) {
    if (dedupAnchorPointId === clarityPointId) {
      return { kind: "deduped", reason: "already_awaiting" };
    }
    return {
      kind: "go_clarity",
      pointId: clarityPointId,
      sectionId: point.sectionId,
      awaitingModerator: true,
    };
  }

  return { kind: "ignore", reason: "not_section_boundary" };
}

export function scriptPointAwaitingModerator(point: ScriptPoint | undefined): boolean {
  return point?.kind === "clarity_check";
}

export function scriptContinueTarget(
  script: SessionScript,
  currentPointId: string,
): { ok: boolean; reason?: string; pointId?: string } {
  const point = getPointById(script, currentPointId);
  if (
    !point ||
    !point.sectionId ||
    (point.kind !== "clarity_check" && point.kind !== "full_sheet")
  ) {
    return { ok: false, reason: "not_on_section_close" };
  }
  const nextId = firstPointOfNextSection(script, point.sectionId);
  if (!nextId) {
    const closing = getPointById(script, "closing");
    return closing
      ? { ok: true, pointId: closing.id }
      : { ok: false, reason: "no_next_section" };
  }
  return { ok: true, pointId: nextId };
}

export function stepKindAwaitingModerator(kind: MonitorPasoTipo | undefined): boolean {
  return kind === "hoja";
}
