import { planMonitorNarration, type MonitorNarrationPlan } from "./monitor-narration-plan";

export type MonitorNarrationRole = "moderador" | "cliente" | "movil" | "visitor";

export type MonitorNarrationAdvanceIntent = "narration" | "moderator_control";

export type MonitorNarrationAdvanceReason =
  | "ok"
  | "awaiting_moderator"
  | "visitor_forbidden"
  | "narration_cannot_auto_advance";

export type MonitorNarrationGate = {
  awaitingModerator: boolean;
  mayAdvance: boolean;
  reason: MonitorNarrationAdvanceReason;
  plan: MonitorNarrationPlan;
};

export type MeetingNavState = {
  pos: number;
};

export function planAwaitsModerator(plan: MonitorNarrationPlan): boolean {
  return plan.blockAdvance === true || plan.stepKind === "hoja";
}

/**
 * Fuente de verdad para el avance de narración.
 * No muta estado. El control manual del moderador es el único intent que puede autorizar.
 */
export function evaluateNarrationAdvanceGate(input: {
  stepIndex: number;
  role: MonitorNarrationRole;
  intent: MonitorNarrationAdvanceIntent;
}): MonitorNarrationGate {
  const plan = planMonitorNarration(input.stepIndex);
  const awaitingModerator = planAwaitsModerator(plan);

  if (input.role !== "moderador") {
    return {
      awaitingModerator,
      mayAdvance: false,
      reason: "visitor_forbidden",
      plan,
    };
  }

  if (input.intent === "moderator_control") {
    return { awaitingModerator, mayAdvance: true, reason: "ok", plan };
  }

  if (awaitingModerator) {
    return {
      awaitingModerator: true,
      mayAdvance: false,
      reason: "awaiting_moderator",
      plan,
    };
  }

  return {
    awaitingModerator: false,
    mayAdvance: false,
    reason: "narration_cannot_auto_advance",
    plan,
  };
}

/** Intento de avance desde narración: nunca modifica `state.pos`. */
export function applyNarrationAdvanceAttempt(
  state: MeetingNavState,
  role: MonitorNarrationRole,
): { ok: false; gate: MonitorNarrationGate; pos: number } {
  const posBefore = state.pos;
  const gate = evaluateNarrationAdvanceGate({
    stepIndex: state.pos,
    role,
    intent: "narration",
  });
  return { ok: false, gate, pos: posBefore };
}

/** Equivalente al control manual existente (Anterior/Siguiente del moderador). */
export function applyModeratorManualAdvance(
  state: MeetingNavState,
  targetPos: number,
  role: MonitorNarrationRole,
): { ok: boolean; gate: MonitorNarrationGate; pos: number } {
  const gate = evaluateNarrationAdvanceGate({
    stepIndex: state.pos,
    role,
    intent: "moderator_control",
  });
  if (!gate.mayAdvance) {
    return { ok: false, gate, pos: state.pos };
  }
  state.pos = targetPos;
  return { ok: true, gate, pos: state.pos };
}
