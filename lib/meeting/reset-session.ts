import type { SupabaseClient } from "@supabase/supabase-js";

/** Historial de una reunión. No incluye el informe ni meeting_prep_faqs. */
const HISTORY_TABLES = [
  "meeting_questions",
  "meeting_clarity_votes",
  "meeting_activity",
  "meeting_interaction_events",
  "meeting_session_registry",
  "meeting_participants",
] as const;

function missingRelation(error: { code?: string; message?: string }): boolean {
  const message = error.message ?? "";
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    /does not exist|schema cache/i.test(message)
  );
}

export function rpcFunctionMissing(error: { code?: string; message?: string }): boolean {
  const message = error.message ?? "";
  return (
    error.code === "PGRST202" ||
    /reset_meeting_session/i.test(message) ||
    /could not find the function/i.test(message)
  );
}

export async function resetMeetingSessionWithServiceRole(
  supabase: SupabaseClient,
  meetingId: string,
): Promise<{ sessionResetNonce: number; eventSeq: number }> {
  const { data: existing, error: readError } = await supabase
    .from("meeting_state")
    .select("global_view, event_seq")
    .eq("meeting_id", meetingId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);

  for (const table of HISTORY_TABLES) {
    const { error } = await supabase.from(table).delete().eq("meeting_id", meetingId);
    if (error && !missingRelation(error)) throw new Error(error.message);
  }

  const prev =
    existing?.global_view && typeof existing.global_view === "object"
      ? (existing.global_view as Record<string, unknown>)
      : {};
  const nonce = Date.now();
  const eventSeq = Number(existing?.event_seq ?? 0) + 1;
  const globalView = {
    prepFaqs: Array.isArray(prev.prepFaqs) ? prev.prepFaqs : [],
    monitorSessionPhase: "preparacion",
    monitorHighlight: null,
    awaitingModerator: false,
    sessionResetNonce: nonce,
  };

  const { error: writeError } = await supabase.from("meeting_state").upsert({
    meeting_id: meetingId,
    current_step: 0,
    unlocked_step: 0,
    current_point_id: null,
    script: null,
    presented_charts: [],
    presentation_status: "live",
    global_view: globalView,
    event_seq: eventSeq,
    updated_at: new Date().toISOString(),
  });
  if (writeError) throw new Error(writeError.message);

  return { sessionResetNonce: nonce, eventSeq };
}
