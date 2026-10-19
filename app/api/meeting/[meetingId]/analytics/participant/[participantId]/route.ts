import { NextResponse } from "next/server";
import { verifyPresenterToken } from "@/lib/meeting/presenter-auth";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ meetingId: string; participantId: string }> },
) {
  const { meetingId, participantId } = await context.params;
  const token = request.headers.get("x-presenter-token");
  if (!verifyPresenterToken(meetingId, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient("analytics-participant-history");
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const limit = Math.min(
    500,
    Math.max(1, Number(new URL(request.url).searchParams.get("limit") ?? 200)),
  );

  const { data, error } = await supabase
    .from("meeting_interaction_events")
    .select(
      "id, client_event_id, event_type, chart_id, element_id, element_label, action, metadata, created_at",
    )
    .eq("meeting_id", meetingId)
    .eq("participant_id", participantId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    meetingId,
    participantId,
    events: data ?? [],
  });
}
