import { NextResponse } from "next/server";
import type { InteractionEventInput } from "@/lib/analytics/types";
import {
  authorizeVisitorEventBatch,
  isValidInteractionEvent,
  persistInteractionEvents,
} from "@/lib/analytics/ingest";

type Body = {
  events?: InteractionEventInput[];
  participant_token?: string;
  participant_id?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ meetingId: string }> },
) {
  const { meetingId } = await context.params;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const events = (body.events ?? []).filter(isValidInteractionEvent);
  if (events.length === 0) {
    return NextResponse.json({ error: "No valid events" }, { status: 400 });
  }

  for (const e of events) {
    if (e.meeting_id !== meetingId) {
      return NextResponse.json({ error: "meeting_id mismatch" }, { status: 400 });
    }
  }

  const token =
    request.headers.get("x-participant-token") ??
    body.participant_token ??
    null;
  const participantId =
    request.headers.get("x-participant-id") ?? body.participant_id ?? null;

  const auth = await authorizeVisitorEventBatch(meetingId, events, participantId, token);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const persisted = await persistInteractionEvents(events);
  if (!persisted.ok) {
    return NextResponse.json({ error: persisted.error }, { status: 503 });
  }

  return NextResponse.json({ ok: true, accepted: persisted.accepted });
}
