import type { AggregatedMeetingAnalytics } from "./aggregate";
import type { InteractionEventRow } from "./types";

export type SofiaAnalyticsPayload = AggregatedMeetingAnalytics & {
  contract: "catch.sofia.meeting_analytics";
  events_sample_limit: number;
  recent_events: InteractionEventRow[];
};

export function buildSofiaAnalyticsPayload(
  aggregated: AggregatedMeetingAnalytics,
  events: InteractionEventRow[],
  sampleLimit = 50,
): SofiaAnalyticsPayload {
  const recent = [...events]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, sampleLimit)
    .map((e) => ({
      ...e,
      metadata: sanitizeMetadataForSofia(e.metadata ?? {}),
    }));

  return {
    contract: "catch.sofia.meeting_analytics",
    events_sample_limit: sampleLimit,
    recent_events: recent,
    ...aggregated,
  };
}

function sanitizeMetadataForSofia(metadata: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...metadata };
  delete copy.question_text;
  delete copy.text;
  return copy;
}
