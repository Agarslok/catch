import type { SupabaseClient } from "@supabase/supabase-js";

export const QUEUE_REQUEST_KINDS = [
  "written_question",
  "assistant_to_presenter",
  "ai_escalation",
  "oral_turn",
  "clarity_doubt",
] as const;

export type QueueRequestKind = (typeof QUEUE_REQUEST_KINDS)[number];

export type QueueItemStatus = "open" | "answered" | "dismissed";

export async function bumpMeetingEventSeq(
  supabase: SupabaseClient,
  meetingId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("meeting_state")
    .select("event_seq")
    .eq("meeting_id", meetingId)
    .maybeSingle();

  if (!data) {
    await supabase.from("meeting_state").upsert({
      meeting_id: meetingId,
      current_step: 0,
      unlocked_step: 0,
      event_seq: 1,
      updated_at: now,
    });
    return;
  }

  const next = (data.event_seq ?? 0) + 1;
  await supabase
    .from("meeting_state")
    .update({ event_seq: next, updated_at: now })
    .eq("meeting_id", meetingId);
}

export function queueKindNeedsText(kind: QueueRequestKind): boolean {
  return kind !== "oral_turn" && kind !== "clarity_doubt";
}
