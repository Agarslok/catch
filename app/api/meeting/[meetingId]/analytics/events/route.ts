import { NextResponse } from "next/server";
import type { InteractionEventInput } from "@/lib/analytics/types";
import { INTERACTION_EVENT_TYPES } from "@/lib/analytics/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type Body = { events?: InteractionEventInput[] };

function isValidEvent(e: InteractionEventInput): boolean {
  return (
    Boolean(e.client_event_id) &&
    Boolean(e.meeting_id) &&
    Boolean(e.session_id) &&
    Boolean(e.participant_id) &&
    INTERACTION_EVENT_TYPES.includes(e.event_type as InteractionEventInput["event_type"])
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ meetingId: string }> },
) {
  const { meetingId } = await context.params;
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const events = (body.events ?? []).filter(isValidEvent);
  if (events.length === 0) {
    return NextResponse.json({ error: "No valid events" }, { status: 400 });
  }

  for (const e of events) {
    if (e.meeting_id !== meetingId) {
      return NextResponse.json({ error: "meeting_id mismatch" }, { status: 400 });
    }
  }

  const rows = events.map((e) => ({
    client_event_id: e.client_event_id,
    meeting_id: e.meeting_id,
    session_id: e.session_id,
    participant_id: e.participant_id,
    participant_role: e.participant_role,
    event_type: e.event_type,
    chart_id: e.chart_id ?? null,
    chart_type: e.chart_type ?? null,
    element_id: e.element_id ?? null,
    element_label: e.element_label ?? null,
    action: e.action ?? null,
    metadata: e.metadata ?? {},
    schema_version: e.schema_version ?? "1.0",
    created_at: e.timestamp ?? new Date().toISOString(),
  }));

  const { error } = await supabase.from("meeting_interaction_events").upsert(rows, {
    onConflict: "client_event_id",
    ignoreDuplicates: true,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  for (const e of events) {
    if (e.event_type === "session.join") {
      await supabase.from("meeting_session_registry").upsert(
        {
          session_id: e.session_id,
          meeting_id: e.meeting_id,
          participant_id: e.participant_id,
          participant_role: e.participant_role,
          joined_at: e.timestamp ?? new Date().toISOString(),
          left_at: null,
          schema_version: e.schema_version ?? "1.0",
        },
        { onConflict: "session_id" },
      );
    }
    if (e.event_type === "session.leave") {
      await supabase
        .from("meeting_session_registry")
        .update({ left_at: e.timestamp ?? new Date().toISOString() })
        .eq("session_id", e.session_id);
    }
  }

  return NextResponse.json({ ok: true, accepted: rows.length });
}
