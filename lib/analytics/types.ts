export const ANALYTICS_SCHEMA_VERSION = "1.0";

export const INTERACTION_EVENT_TYPES = [
  "session.join",
  "session.leave",
  "chart.viewed",
  "element.clicked",
  "detail.opened",
  "detail.closed",
  "filter.changed",
  "chart_type.changed",
  "explore.started",
  "explore.returned_to_presentation",
  "question.asked",
] as const;

export type InteractionEventType = (typeof INTERACTION_EVENT_TYPES)[number];

export type ParticipantRole = "presenter" | "visitor";

export type InteractionEventInput = {
  client_event_id: string;
  meeting_id: string;
  session_id: string;
  participant_id: string;
  participant_role: ParticipantRole;
  event_type: InteractionEventType;
  chart_id?: string | null;
  chart_type?: string | null;
  element_id?: string | null;
  element_label?: string | null;
  action?: string | null;
  metadata?: Record<string, unknown>;
  schema_version?: string;
  /** ISO timestamp from client; server may override with now() */
  timestamp?: string;
};

export type InteractionEventRow = Omit<InteractionEventInput, "timestamp"> & {
  id: string;
  created_at: string;
};

export type SessionRegistryRow = {
  session_id: string;
  meeting_id: string;
  participant_id: string;
  participant_role: ParticipantRole;
  joined_at: string;
  left_at: string | null;
  schema_version: string;
};
