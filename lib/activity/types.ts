export const ACTIVITY_EVENT_TYPES = [
  "CHART_VIEWED",
  "QUESTION_ASKED",
  "CHART_SELECTED",
  "AI_HIGHLIGHT",
  "DECISION_CREATED",
  "AI_RESPONSE",
  "PRESENTATION_STEP",
] as const;

export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number];

export type ActivityScope = "global" | "local";

export type ActivityRow = {
  id: string;
  meeting_id: string;
  event_type: ActivityEventType;
  actor_id: string | null;
  actor_name: string | null;
  scope: ActivityScope;
  payload: Record<string, unknown>;
  created_at: string;
};

export type Actor = {
  id: string;
  name: string;
};
