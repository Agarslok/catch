import { NextResponse } from "next/server";
import { aggregateMeetingInteractions } from "@/lib/analytics/aggregate";
import { buildSofiaAnalyticsPayload } from "@/lib/analytics/sofia";
import type { InteractionEventRow, SessionRegistryRow } from "@/lib/analytics/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ meetingId: string }> },
) {
  const { meetingId } = await context.params;
  const role = new URL(request.url).searchParams.get("role");
  if (role !== "presenter") {
    return NextResponse.json({ error: "Presenter role required" }, { status: 403 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { data: events, error: evErr } = await supabase
    .from("meeting_interaction_events")
    .select("*")
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: true })
    .limit(5000);

  if (evErr) {
    return NextResponse.json({ error: evErr.message }, { status: 500 });
  }

  const { data: sessions, error: sessErr } = await supabase
    .from("meeting_session_registry")
    .select("*")
    .eq("meeting_id", meetingId);

  if (sessErr) {
    return NextResponse.json({ error: sessErr.message }, { status: 500 });
  }

  const aggregated = aggregateMeetingInteractions(
    meetingId,
    (events ?? []) as InteractionEventRow[],
    (sessions ?? []) as SessionRegistryRow[],
  );

  const sofia = buildSofiaAnalyticsPayload(
    aggregated,
    (events ?? []) as InteractionEventRow[],
  );

  return NextResponse.json({
    summary: aggregated,
    sofia,
  });
}
