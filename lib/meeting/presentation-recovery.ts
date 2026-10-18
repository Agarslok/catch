import { NARRATION_PROVIDER_END_SIGNAL_AVAILABLE } from "./monitor-narration-runtime";

/**
 * Recuperación de errores (Fase 10).
 * No persiste estado propio: opera sobre event_seq, execId y el lock de publicación existentes.
 */

export type NarrationEndSource = "provider" | "moderator" | "timer_estimate";

export type RecoveryKind =
  | "ai_invalid"
  | "ai_provider"
  | "data_query"
  | "chart_missing"
  | "avatar_inactive"
  | "narration_unconfirmed"
  | "stale_narration_end"
  | "advance_in_flight"
  | "paused_pending"
  | "already_applied"
  | "unauthorized";

export type RecoveryNotice = {
  kind: RecoveryKind;
  title: string;
  detail: string;
  actionHint: string;
  stayOnCurrentPoint: true;
};

export type PendingAdvance = {
  generation: number;
  targetStep: number;
  startedAt: number;
};

export type AdvanceLockState = {
  inFlight: boolean;
  generation: number;
  lastCommittedStep: number | null;
  pending: PendingAdvance | null;
};

export const MAX_AI_JSON_REPAIR_ATTEMPTS = 1;

export function emptyAdvanceLock(lastCommittedStep: number | null = null): AdvanceLockState {
  return {
    inFlight: false,
    generation: 0,
    lastCommittedStep,
    pending: null,
  };
}

/** El temporizador estimado no confirma el fin de narración (Tavus no expone eco de fin). */
export function isConfirmedNarrationEnd(
  source: NarrationEndSource | undefined,
  narrationFinished: boolean,
): boolean {
  if (!narrationFinished) return false;
  if (source === "timer_estimate") return false;
  if (source === "provider") return NARRATION_PROVIDER_END_SIGNAL_AVAILABLE;
  if (source === "moderator") return true;
  return narrationFinished;
}

export function timerExpiryIsNotNarrationEnd(): boolean {
  return !NARRATION_PROVIDER_END_SIGNAL_AVAILABLE;
}

export function beginAdvance(
  lock: AdvanceLockState,
  targetStep: number,
  now = Date.now(),
): { ok: true; lock: AdvanceLockState; generation: number } | { ok: false; reason: string } {
  if (lock.inFlight) return { ok: false, reason: "advance_in_flight" };
  if (lock.lastCommittedStep === targetStep) return { ok: false, reason: "already_applied" };
  const generation = lock.generation + 1;
  return {
    ok: true,
    generation,
    lock: {
      inFlight: true,
      generation,
      lastCommittedStep: lock.lastCommittedStep,
      pending: { generation, targetStep, startedAt: now },
    },
  };
}

export function commitAdvance(
  lock: AdvanceLockState,
  generation: number,
  committedStep: number,
): AdvanceLockState {
  if (generation !== lock.generation) return lock;
  return {
    inFlight: false,
    generation: lock.generation,
    lastCommittedStep: committedStep,
    pending: null,
  };
}

export function abortAdvance(lock: AdvanceLockState, generation: number): AdvanceLockState {
  if (generation !== lock.generation) return lock;
  return {
    inFlight: false,
    generation: lock.generation,
    lastCommittedStep: lock.lastCommittedStep,
    pending: null,
  };
}

/** Pausa: descarta la preparación pendiente para que no publique un avance incompatible. */
export function invalidatePendingOnPause(lock: AdvanceLockState): AdvanceLockState {
  return {
    inFlight: false,
    generation: lock.generation + 1,
    lastCommittedStep: lock.lastCommittedStep,
    pending: null,
  };
}

export function pendingMatchesGeneration(
  lock: AdvanceLockState,
  generation: number,
  presentationStatus: "live" | "paused",
): boolean {
  if (presentationStatus === "paused") return false;
  if (!lock.pending || lock.pending.generation !== generation) return false;
  return lock.generation === generation;
}

/**
 * Tras un POST que pudo persistir: si el estado vigente ya es el destino, no reintentar el avance.
 */
export function shouldSkipRetryAfterPersist(input: {
  persistedStep: number | undefined;
  intendedStep: number;
}): boolean {
  if (typeof input.persistedStep !== "number") return false;
  return input.persistedStep === input.intendedStep;
}

export function recoveryNotice(kind: RecoveryKind): RecoveryNotice {
  const notices: Record<RecoveryKind, Omit<RecoveryNotice, "kind" | "stayOnCurrentPoint">> = {
    ai_invalid: {
      title: "Instrucción no aplicada",
      detail: "La respuesta de la IA no era válida para el punto actual.",
      actionHint: "Sigue en este punto. Reformule la instrucción o use Anterior/Siguiente.",
    },
    ai_provider: {
      title: "El asistente no respondió",
      detail: "No hay respuesta del proveedor. No se cambió la presentación.",
      actionHint: "Puede reintentar la instrucción o avanzar de forma manual.",
    },
    data_query: {
      title: "No se obtuvieron datos",
      detail: "La consulta falló. No se muestran cifras inventadas.",
      actionHint: "Permanece en este punto. Reintente o continúe sin esa consulta.",
    },
    chart_missing: {
      title: "Gráfica no encontrada",
      detail: "Ese destino no existe en el informe activo.",
      actionHint: "Se mantiene el punto actual. Elija una gráfica del guion.",
    },
    avatar_inactive: {
      title: "El avatar no está conectado",
      detail: "La narración no se envió. El paso no cambió.",
      actionHint: "Conecte Tavus y pulse repetir, o continúe la presentación sin avatar.",
    },
    narration_unconfirmed: {
      title: "Narración sin confirmar",
      detail: "No hay señal de fin del avatar. El temporizador no cierra la sección.",
      actionHint: "Puede repetir la explicación o avanzar explícitamente con Siguiente.",
    },
    stale_narration_end: {
      title: "Señal de narración ignorada",
      detail: "Era una finalización antigua o duplicada.",
      actionHint: "La presentación no se movió. Use Siguiente si desea continuar.",
    },
    advance_in_flight: {
      title: "Avance en curso",
      detail: "Ya hay una transición de punto en marcha.",
      actionHint: "Espere a que termine. Un segundo clic no duplica el avance.",
    },
    paused_pending: {
      title: "Preparación cancelada",
      detail: "La pausa invalidó el avance que se estaba preparando.",
      actionHint: "Reanude y luego avance de nuevo si lo necesita.",
    },
    already_applied: {
      title: "El punto ya está aplicado",
      detail: "El estado persistido ya coincide con ese destino.",
      actionHint: "No se repite la transición. Continúe desde aquí.",
    },
    unauthorized: {
      title: "Acción no autorizada",
      detail: "Solo el moderador puede cambiar el punto global.",
      actionHint: "Los participantes exploran en local o vuelven a la presentación.",
    },
  };
  return { kind, stayOnCurrentPoint: true, ...notices[kind] };
}

export function mapAiErrorToRecovery(
  code: string,
): RecoveryKind {
  if (code === "AI_TIMEOUT" || code === "AI_PROVIDER_ERROR" || code === "AI_EMPTY_RESPONSE") {
    return "ai_provider";
  }
  if (code === "FORBIDDEN" || code === "UNAUTHORIZED") return "unauthorized";
  return "ai_invalid";
}
