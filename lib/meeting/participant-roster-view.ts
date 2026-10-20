import type { VisitorSessionSummary } from "@/lib/analytics/participant-summaries";
import type { MonitorSessionPhase } from "@/lib/meeting/monitor-session-phase";

/** Historial consolidado solo cuando la reunión está realmente en cierre. */
export function meetingParticipationHistoryVisible(
  phase: MonitorSessionPhase,
  atClosingStep = false,
): boolean {
  return phase === "cierre" || atClosingStep;
}

export type RosterDurationDisplay =
  | { kind: "hidden" }
  | { kind: "confirmed"; label: string }
  | { kind: "unconfirmed"; message: string };

export function rosterDurationDisplay(
  visitor: VisitorSessionSummary,
  showHistory: boolean,
): RosterDurationDisplay {
  if (!showHistory) return { kind: "hidden" };
  if (visitor.left_at) {
    return { kind: "confirmed", label: visitor.duration_label };
  }
  if (visitor.joined_at) {
    return {
      kind: "unconfirmed",
      message: "Permanencia no confirmada (sin salida registrada)",
    };
  }
  return { kind: "unconfirmed", message: "Sin registro de permanencia" };
}

export function rosterEngagementLabel(visitor: VisitorSessionSummary): string {
  const q = visitor.questions_asked;
  const c = visitor.clicks;
  return `${q} pregunta${q === 1 ? "" : "s"} · ${c} clic${c === 1 ? "" : "s"}`;
}

export function rosterPresenceLabel(
  visitor: VisitorSessionSummary,
  showHistory: boolean,
): string {
  if (!showHistory) return visitor.presence_label;
  if (visitor.left_at) return "Salida registrada";
  if (visitor.presence === "connected") return "Conectado al cierre";
  if (visitor.presence === "away") {
    return "Desconectado (sin salida registrada)";
  }
  return visitor.presence_label;
}

export function dedupeVisitorsByParticipantId(
  visitors: VisitorSessionSummary[],
): VisitorSessionSummary[] {
  const byId = new Map<string, VisitorSessionSummary>();
  for (const row of visitors) {
    if (!byId.has(row.participant_id)) {
      byId.set(row.participant_id, row);
      continue;
    }
    const prev = byId.get(row.participant_id)!;
    if ((row.joined_at ?? "") < (prev.joined_at ?? "")) {
      byId.set(row.participant_id, row);
    }
  }
  return [...byId.values()];
}
