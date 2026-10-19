import { NextResponse } from "next/server";
import { buildVisitorSessionSummaries } from "@/lib/analytics/participant-summaries";
import { groupClarityVotesByParticipant } from "@/lib/meeting/participant-clarity";
import { dedupeVisitorsByParticipantId } from "@/lib/meeting/participant-roster-view";
import type { InteractionEventRow, SessionRegistryRow } from "@/lib/analytics/types";
import { verifyPresenterToken } from "@/lib/meeting/presenter-auth";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ meetingId: string }> },
) {
  const { meetingId } = await context.params;
  const token = request.headers.get("x-presenter-token");
  if (!verifyPresenterToken(meetingId, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient("analytics-participants");
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const [
    { data: events, error: evErr },
    { data: sessions, error: sessErr },
    { data: people, error: pplErr },
    { data: clarityRows, error: clarityErr },
  ] = await Promise.all([
    supabase
      .from("meeting_interaction_events")
      .select("*")
      .eq("meeting_id", meetingId)
      .eq("participant_role", "visitor")
      .order("created_at", { ascending: true })
      .limit(5000),
    supabase.from("meeting_session_registry").select("*").eq("meeting_id", meetingId),
    supabase
      .from("meeting_participants")
      .select("participant_id, display_name")
      .eq("meeting_id", meetingId),
    supabase
      .from("meeting_clarity_votes")
      .select("participant_id, section_key, vote")
      .eq("meeting_id", meetingId),
  ]);

  if (evErr) return NextResponse.json({ error: evErr.message }, { status: 500 });
  if (sessErr) return NextResponse.json({ error: sessErr.message }, { status: 500 });
  if (pplErr) {
    /* display_name puede faltar si la migración no se aplicó; seguimos sin nombres. */
  }
  if (clarityErr) {
    /* claridad opcional si la tabla no está disponible */
  }

  const names: Record<string, string> = {};
  for (const row of people ?? []) {
    if (row.participant_id && row.display_name) {
      names[row.participant_id as string] = String(row.display_name);
    }
  }
  for (const row of sessions ?? []) {
    if (row.participant_id && row.display_name && !names[row.participant_id as string]) {
      names[row.participant_id as string] = String(row.display_name);
    }
  }

  const clarityByParticipant = groupClarityVotesByParticipant(
    (clarityRows ?? []) as { participant_id: string; section_key: string; vote: string }[],
  );

  const visitors = dedupeVisitorsByParticipantId(
    buildVisitorSessionSummaries(
      (events ?? []) as InteractionEventRow[],
      (sessions ?? []) as SessionRegistryRow[],
      names,
    ).map((v) => ({
      ...v,
      clarity_votes: clarityByParticipant[v.participant_id] ?? [],
    })),
  );

  return NextResponse.json({ meetingId, visitors });
}
