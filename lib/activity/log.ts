import type { ActivityEventType, ActivityScope, Actor } from "./types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export async function logMeetingActivity(input: {
  meetingId: string;
  eventType: ActivityEventType;
  actor?: Actor;
  scope?: ActivityScope;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const { error } = await supabase.from("meeting_activity").insert({
    meeting_id: input.meetingId,
    event_type: input.eventType,
    actor_id: input.actor?.id ?? null,
    actor_name: input.actor?.name ?? null,
    scope: input.scope ?? "local",
    payload: input.payload ?? {},
  });

  if (error) console.warn("[meeting_activity]", error.message);
}
