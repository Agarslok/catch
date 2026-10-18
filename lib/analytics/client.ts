"use client";

import type { InteractionEventInput, InteractionEventType, ParticipantRole } from "./types";
import { ANALYTICS_SCHEMA_VERSION } from "./types";
import { getVisitorAnalyticsAuth } from "./participant-auth";
import { buildClientEventId, getOrCreateSessionId } from "./session";

const QUEUE_KEY = "catch:analytics:pending";
const FLUSH_MS = 2000;
const BATCH_SIZE = 12;

type TrackContext = {
  meetingId: string;
  participantId: string;
  participantRole: ParticipantRole;
};

let flushTimer: ReturnType<typeof setTimeout> | null = null;
const memoryQueue: InteractionEventInput[] = [];

function loadPending(): InteractionEventInput[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as InteractionEventInput[]) : [];
  } catch {
    return [];
  }
}

function savePending(events: InteractionEventInput[]) {
  if (typeof window === "undefined") return;
  try {
    if (events.length === 0) localStorage.removeItem(QUEUE_KEY);
    else localStorage.setItem(QUEUE_KEY, JSON.stringify(events.slice(-200)));
  } catch {
    /* ignore */
  }
}

function authPayload(events?: InteractionEventInput[]) {
  const auth = getVisitorAnalyticsAuth();
  const participantId =
    auth?.participantId ?? events?.find((e) => e.participant_role === "visitor")?.participant_id;
  const participant_token = auth?.token;
  if (!participantId && !participant_token) return { headers: {} as Record<string, string> };
  return {
    headers: {
      ...(participantId ? { "x-participant-id": participantId } : {}),
      ...(participant_token ? { "x-participant-token": participant_token } : {}),
    },
    participant_token,
    participant_id: participantId,
  };
}

async function postBatch(meetingId: string, events: InteractionEventInput[]): Promise<boolean> {
  if (events.length === 0) return true;
  const { headers = {}, participant_token, participant_id } = authPayload(events);
  try {
    const res = await fetch(`/api/meeting/${meetingId}/analytics/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ events, participant_token, participant_id }),
      keepalive: true,
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function flushInteractionQueue(meetingId: string): Promise<void> {
  const pending = [...loadPending(), ...memoryQueue];
  memoryQueue.length = 0;
  if (pending.length === 0) return;

  const ok = await postBatch(meetingId, pending);
  if (ok) savePending([]);
  else savePending(pending);
}

function scheduleFlush(meetingId: string) {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushInteractionQueue(meetingId);
  }, FLUSH_MS);
}

export function enqueueInteractionEvent(
  ctx: TrackContext,
  event: Omit<
    InteractionEventInput,
    "client_event_id" | "meeting_id" | "session_id" | "participant_id" | "participant_role" | "schema_version"
  >,
): void {
  const row: InteractionEventInput = {
    client_event_id: buildClientEventId(),
    meeting_id: ctx.meetingId,
    session_id: getOrCreateSessionId(ctx.meetingId),
    participant_id: ctx.participantId,
    participant_role: ctx.participantRole,
    schema_version: ANALYTICS_SCHEMA_VERSION,
    ...event,
    metadata: event.metadata ?? {},
    timestamp: new Date().toISOString(),
  };

  memoryQueue.push(row);
  const urgent =
    row.event_type === "session.join" ||
    row.event_type === "session.leave" ||
    row.event_type === "question.asked" ||
    row.event_type === "question.answered" ||
    row.event_type === "element.clicked" ||
    row.event_type.startsWith("presentation.");
  if (memoryQueue.length >= BATCH_SIZE || urgent) {
    void flushInteractionQueue(ctx.meetingId);
  } else {
    scheduleFlush(ctx.meetingId);
  }
}

export function trackInteraction(
  ctx: TrackContext,
  eventType: InteractionEventType,
  fields: {
    chart_id?: string;
    chart_type?: string;
    element_id?: string;
    element_label?: string;
    action?: string;
    metadata?: Record<string, unknown>;
  } = {},
): void {
  enqueueInteractionEvent(ctx, {
    event_type: eventType,
    chart_id: fields.chart_id ?? null,
    chart_type: fields.chart_type ?? null,
    element_id: fields.element_id ?? null,
    element_label: fields.element_label ?? null,
    action: fields.action ?? null,
    metadata: fields.metadata,
  });
}

export function sendBeaconLeave(ctx: TrackContext): void {
  const row: InteractionEventInput = {
    client_event_id: buildClientEventId(),
    meeting_id: ctx.meetingId,
    session_id: getOrCreateSessionId(ctx.meetingId),
    participant_id: ctx.participantId,
    participant_role: ctx.participantRole,
    event_type: "session.leave",
    schema_version: ANALYTICS_SCHEMA_VERSION,
    metadata: {},
    timestamp: new Date().toISOString(),
  };
  const { participant_token, participant_id } = authPayload([row]);
  const body = JSON.stringify({ events: [row], participant_token, participant_id });
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon(
      `/api/meeting/${ctx.meetingId}/analytics/events`,
      new Blob([body], { type: "application/json" }),
    );
  } else {
    void postBatch(ctx.meetingId, [row]);
  }
}
