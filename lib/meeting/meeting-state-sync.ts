import type { MeetingGlobalView } from "./session-types";

export type MeetingStateRowLike = {
  event_seq?: number;
  current_step?: number;
  unlocked_step?: number;
  current_point_id?: string | null;
  presentation_status?: string;
  global_view?: MeetingGlobalView;
};

/** Índice monotónico en `meeting_state.event_seq` (reutilizado por Realtime y GET). */
export function shouldApplyMeetingStateRow(
  appliedSeq: number,
  row: MeetingStateRowLike,
): boolean {
  const seq = row.event_seq;
  if (typeof seq !== "number" || !Number.isFinite(seq)) return true;
  if (appliedSeq < 0) return true;
  return seq > appliedSeq;
}

export function nextAppliedEventSeq(
  appliedSeq: number,
  row: MeetingStateRowLike,
): number {
  const seq = row.event_seq;
  if (typeof seq === "number" && Number.isFinite(seq)) {
    return Math.max(appliedSeq, seq);
  }
  return appliedSeq;
}

/** Ordena filas pendientes recibidas antes de completar la hidratación inicial. */
export function sortMeetingStateRowsBySeq(rows: MeetingStateRowLike[]): MeetingStateRowLike[] {
  return [...rows].sort((a, b) => (a.event_seq ?? 0) - (b.event_seq ?? 0));
}

/**
 * Fusiona `global_view` remoto: el servidor envía el objeto completo persistido;
 * las claves explícitas `null` en el patch de publicación ya quedaron resueltas en servidor.
 */
export function mergeIncomingGlobalView(
  current: MeetingGlobalView,
  incoming: MeetingGlobalView | undefined,
): MeetingGlobalView {
  if (!incoming) return current;
  return {
    ...current,
    ...incoming,
    highlight:
      incoming.highlight !== undefined ? incoming.highlight : current.highlight,
  };
}

/** Resaltado del monitor HTML (solo metadatos, sin media). */
export function readMonitorHighlightFromGlobalView(
  globalView: MeetingGlobalView | Record<string, unknown> | undefined,
): unknown {
  if (!globalView || typeof globalView !== "object") return undefined;
  return (globalView as Record<string, unknown>).monitorHighlight;
}

export function readSectionAwaitFromGlobalView(
  globalView: MeetingGlobalView | undefined,
): {
  awaitingModerator: boolean;
  sectionId: string | null;
  sectionLabel: string | null;
} {
  if (!globalView) {
    return { awaitingModerator: false, sectionId: null, sectionLabel: null };
  }
  return {
    awaitingModerator: globalView.awaitingModerator === true,
    sectionId: globalView.sectionAwaitSectionId ?? null,
    sectionLabel: globalView.sectionAwaitSectionLabel ?? null,
  };
}
