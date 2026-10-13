import { createClient } from "@supabase/supabase-js";

export type SupabaseHealth = {
  configured: boolean;
  ok: boolean;
  meetingStateReadable: boolean;
  meetingActivityWritable: boolean;
  error?: string;
};

export async function checkSupabaseHealth(): Promise<SupabaseHealth> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return {
      configured: false,
      ok: false,
      meetingStateReadable: false,
      meetingActivityWritable: false,
      error: "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    };
  }

  const supabase = createClient(url, key);
  const testMeeting = "__health_check__";

  const { error: readError } = await supabase
    .from("meeting_state")
    .select("meeting_id")
    .eq("meeting_id", testMeeting)
    .maybeSingle();

  if (readError) {
    return {
      configured: true,
      ok: false,
      meetingStateReadable: false,
      meetingActivityWritable: false,
      error: readError.message,
    };
  }

  const { error: insertError } = await supabase.from("meeting_activity").insert({
    meeting_id: testMeeting,
    event_type: "CHART_VIEWED",
    actor_id: "health",
    actor_name: "Health Check",
    scope: "local",
    payload: { probe: true },
  });

  if (insertError) {
    return {
      configured: true,
      ok: false,
      meetingStateReadable: true,
      meetingActivityWritable: false,
      error: insertError.message,
    };
  }

  const { error: upsertError } = await supabase.from("meeting_state").upsert({
    meeting_id: testMeeting,
    current_step: 0,
    unlocked_step: 0,
    updated_at: new Date().toISOString(),
  });

  if (upsertError) {
    return {
      configured: true,
      ok: false,
      meetingStateReadable: true,
      meetingActivityWritable: true,
      error: upsertError.message,
    };
  }

  return {
    configured: true,
    ok: true,
    meetingStateReadable: true,
    meetingActivityWritable: true,
  };
}
