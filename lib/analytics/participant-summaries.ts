import type { InteractionEventRow, SessionRegistryRow } from "./types";

/** Intervalo de heartbeat del visitante (monitor + React). */
export const VISITOR_HEARTBEAT_MS = 20_000;
/** Sin señal reciente: ~3 heartbeats + margen (tolerancia serverless). No equivale a `session.leave`. */
export const VISITOR_PRESENCE_STALE_MS = 65_000;

export type VisitorPresence = "connected" | "away" | "left";

export type VisitorSessionSummary = {
  participant_id: string;
  display_name: string;
  joined_at: string | null;
  left_at: string | null;
  last_seen_at: string | null;
  duration_seconds: number;
  duration_label: string;
  still_active: boolean;
  presence: VisitorPresence;
  presence_label: "Conectado" | "Desconectado";
  sections: string[];
  questions_asked: number;
  clicks: number;
  event_count: number;
  /** Votos de claridad asociados al participante (solo si el servidor los expone). */
  clarity_votes?: { section_key: string; vote: string; label: string }[];
};

/** Última señal de vida (heartbeat, join o last_seen en registry). */
export function latestVisitorPresenceAt(
  events: InteractionEventRow[],
  sessions: SessionRegistryRow[],
): string | null {
  const stamps: string[] = [];
  for (const e of events) {
    if (
      e.event_type === "session.heartbeat" ||
      e.event_type === "session.join" ||
      e.event_type === "session.leave"
    ) {
      stamps.push(e.created_at);
    }
  }
  for (const s of sessions) {
    const row = s as SessionRegistryRow & { last_seen_at?: string | null };
    if (row.last_seen_at) stamps.push(row.last_seen_at);
    if (row.left_at) stamps.push(row.left_at);
  }
  if (stamps.length === 0) return null;
  return stamps.sort().at(-1) ?? null;
}

/** Ignora `session.leave` / `left_at` si hubo join o heartbeat después (p. ej. re-render en Safari). */
export function effectiveVisitorLeftAt(
  registryLeftAt: string | null,
  ownEvents: InteractionEventRow[],
): string | null {
  const leaveStamps: string[] = [];
  if (registryLeftAt) leaveStamps.push(registryLeftAt);
  for (const e of ownEvents) {
    if (e.event_type === "session.leave") leaveStamps.push(e.created_at);
  }
  if (leaveStamps.length === 0) return null;
  const lastLeave = leaveStamps.sort().at(-1)!;
  const revived = ownEvents.some(
    (e) =>
      (e.event_type === "session.heartbeat" || e.event_type === "session.join") &&
      e.created_at > lastLeave,
  );
  return revived ? null : lastLeave;
}

export function countModeratorQuestionsByParticipant(
  rows: { participant_id: string | null }[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const id = row.participant_id;
    if (!id) continue;
    out[id] = (out[id] ?? 0) + 1;
  }
  return out;
}

export function enrichVisitorsWithModeratorQuestions(
  visitors: VisitorSessionSummary[],
  questionCounts: Record<string, number>,
  names: Record<string, string>,
): VisitorSessionSummary[] {
  const byId = new Map(visitors.map((v) => [v.participant_id, v]));
  for (const [participantId, extra] of Object.entries(questionCounts)) {
    if (extra <= 0) continue;
    const existing = byId.get(participantId);
    if (existing) {
      byId.set(participantId, {
        ...existing,
        questions_asked: existing.questions_asked + extra,
      });
      continue;
    }
    byId.set(participantId, {
      participant_id: participantId,
      display_name: names[participantId] ?? `Visitante ${participantId.slice(-4)}`,
      joined_at: null,
      left_at: null,
      last_seen_at: null,
      duration_seconds: 0,
      duration_label: "0 s",
      still_active: false,
      presence: "away",
      presence_label: "Desconectado",
      sections: [],
      questions_asked: extra,
      clicks: 0,
      event_count: 0,
    });
  }
  return [...byId.values()].sort((a, b) => (b.joined_at ?? "").localeCompare(a.joined_at ?? ""));
}

export function resolveVisitorPresence(input: {
  latestLeftAt: string | null;
  lastSeenAt: string | null;
  nowMs?: number;
  staleMs?: number;
}): VisitorPresence {
  if (input.latestLeftAt) return "left";
  const lastSeenMs = input.lastSeenAt ? Date.parse(input.lastSeenAt) : NaN;
  const now = input.nowMs ?? Date.now();
  const stale = input.staleMs ?? VISITOR_PRESENCE_STALE_MS;
  if (Number.isFinite(lastSeenMs) && now - lastSeenMs <= stale) return "connected";
  return "away";
}

export function formatDurationSeconds(totalSeconds: number): string {
  const sec = Math.max(0, Math.round(totalSeconds));
  if (sec < 60) return `${sec} s`;
  const minutes = Math.floor(sec / 60);
  const s = sec % 60;
  if (minutes < 60) return s ? `${minutes} min ${s} s` : `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${hours} h ${m} min` : `${hours} h`;
}

function metaString(meta: Record<string, unknown> | undefined, keys: string[]): string | null {
  if (!meta) return null;
  for (const key of keys) {
    const v = meta[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function sectionFromEvent(e: InteractionEventRow): string | null {
  const meta = (e.metadata ?? {}) as Record<string, unknown>;
  return metaString(meta, ["section_name", "sectionName", "section_label", "seccionNombre"]);
}

export function buildVisitorSessionSummaries(
  events: InteractionEventRow[],
  sessions: SessionRegistryRow[],
  names: Record<string, string>,
  nowMs = Date.now(),
): VisitorSessionSummary[] {
  const visitors = new Set<string>();
  for (const s of sessions) {
    if (s.participant_role === "visitor") visitors.add(s.participant_id);
  }
  for (const e of events) {
    if (e.participant_role === "visitor") visitors.add(e.participant_id);
  }

  const summaries: VisitorSessionSummary[] = [];
  for (const participantId of visitors) {
    const ownEvents = events
      .filter((e) => e.participant_id === participantId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const ownSessions = sessions
      .filter((s) => s.participant_id === participantId)
      .sort((a, b) => a.joined_at.localeCompare(b.joined_at));

    const firstEvent = ownEvents[0]?.created_at ?? null;
    const lastEvent = ownEvents[ownEvents.length - 1]?.created_at ?? null;
    const latestSession = ownSessions[ownSessions.length - 1];
    const joinedAt = ownSessions[0]?.joined_at ?? firstEvent;
    const leftAt = latestSession?.left_at ?? null;
    const effectiveLeft = effectiveVisitorLeftAt(leftAt, ownEvents);
    const lastSeen =
      latestVisitorPresenceAt(ownEvents, ownSessions) ?? lastEvent;
    const presence = resolveVisitorPresence({
      latestLeftAt: effectiveLeft,
      lastSeenAt: lastSeen,
      nowMs,
    });

    const startMs = joinedAt ? Date.parse(joinedAt) : NaN;
    const endMs = leftAt
      ? Date.parse(leftAt)
      : lastSeen
        ? Date.parse(lastSeen)
        : nowMs;
    const durationSeconds =
      Number.isFinite(startMs) && Number.isFinite(endMs)
        ? Math.max(0, Math.round((endMs - startMs) / 1000))
        : 0;

    const sectionSet: string[] = [];
    for (const e of ownEvents) {
      const name = sectionFromEvent(e);
      if (name && !sectionSet.includes(name)) sectionSet.push(name);
    }

    const displayName =
      names[participantId] ||
      ownEvents
        .map((e) => metaString((e.metadata ?? {}) as Record<string, unknown>, ["display_name"]))
        .find(Boolean) ||
      `Visitante ${participantId.slice(-4)}`;

    summaries.push({
      participant_id: participantId,
      display_name: displayName,
      joined_at: joinedAt,
      left_at: leftAt,
      last_seen_at: lastSeen,
      duration_seconds: durationSeconds,
      duration_label: formatDurationSeconds(durationSeconds),
      still_active: presence === "connected",
      presence,
      presence_label: presence === "connected" ? "Conectado" : "Desconectado",
      sections: sectionSet.slice(0, 4),
      questions_asked: ownEvents.filter((e) => e.event_type === "question.asked").length,
      clicks: ownEvents.filter((e) => e.event_type === "element.clicked").length,
      event_count: ownEvents.filter((e) => e.event_type !== "session.heartbeat").length,
    });
  }

  return summaries.sort((a, b) => (b.joined_at ?? "").localeCompare(a.joined_at ?? ""));
}
