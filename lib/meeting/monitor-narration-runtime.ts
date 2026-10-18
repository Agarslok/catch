/**
 * Estado de ejecución de narración (Fase 6).
 * No avanza pasos: el controlador sigue siendo moverModerador + evaluateNarrationAdvanceGate.
 * El fin de una réplica Tavus sí se escucha (`replica.stopped_speaking`).
 * El avance de diapositiva lo decide section-flow, no este módulo.
 */

export type NarrationRuntimeStatus =
  | "idle"
  | "speaking"
  | "awaiting_moderator"
  | "paused"
  | "error";

export type NarrationRuntimeState = {
  execId: string | null;
  status: NarrationRuntimeStatus;
  stepIndex: number;
  echoId: string | null;
  startedAt: number | null;
  paused: boolean;
};

export const NARRATION_PROVIDER_END_SIGNAL_AVAILABLE = true;

export function emptyNarrationRuntime(): NarrationRuntimeState {
  return {
    execId: null,
    status: "idle",
    stepIndex: -1,
    echoId: null,
    startedAt: null,
    paused: false,
  };
}

export function createNarrationExecutionId(stepIndex: number, now = Date.now()): string {
  return `narr-exec-${stepIndex}-${now}`;
}

export function beginNarrationExecution(
  stepIndex: number,
  echoId: string,
  now = Date.now(),
): NarrationRuntimeState {
  return {
    execId: createNarrationExecutionId(stepIndex, now),
    status: "speaking",
    stepIndex,
    echoId,
    startedAt: now,
    paused: false,
  };
}

/** Ignora callbacks de una ejecución anterior (eco Tavus, timers futuros, etc.). */
export function isStaleNarrationCallback(
  state: NarrationRuntimeState,
  execId: string | null | undefined,
): boolean {
  if (!execId || !state.execId) return true;
  return state.execId !== execId;
}

/**
 * El monitor no debe auto-avanzar por narración hasta tener señal de fin fiable del proveedor.
 */
export function narrationMayAutoAdvance(state: NarrationRuntimeState): boolean {
  if (!state.execId || state.status === "idle") return false;
  if (NARRATION_PROVIDER_END_SIGNAL_AVAILABLE) return false;
  return false;
}

export function applyNarrationPause(state: NarrationRuntimeState): NarrationRuntimeState {
  if (state.status === "idle" && !state.execId) return state;
  return { ...state, paused: true, status: "paused" };
}

export function clearNarrationRuntime(): NarrationRuntimeState {
  return emptyNarrationRuntime();
}

export function mergeAwaitingModeratorFlag(
  state: NarrationRuntimeState,
  awaitingModerator: boolean,
): NarrationRuntimeState {
  if (!awaitingModerator) return state;
  if (state.status === "idle") {
    return { ...state, status: "awaiting_moderator" };
  }
  if (state.status === "speaking" || state.status === "paused") {
    return { ...state, status: "awaiting_moderator" };
  }
  return state;
}

export function attemptNarrationAdvance(
  state: NarrationRuntimeState,
  execId: string | null | undefined,
  awaitingModerator: boolean,
): { advanced: false; reason: string } {
  if (isStaleNarrationCallback(state, execId)) {
    return { advanced: false, reason: "stale_exec_id" };
  }
  if (state.paused || state.status === "paused") {
    return { advanced: false, reason: "paused" };
  }
  if (awaitingModerator || state.status === "awaiting_moderator") {
    return { advanced: false, reason: "awaiting_moderator" };
  }
  if (!narrationMayAutoAdvance(state)) {
    return { advanced: false, reason: "no_provider_end_signal" };
  }
  return { advanced: false, reason: "no_provider_end_signal" };
}
