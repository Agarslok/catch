import { NextResponse } from "next/server";
import {
  bumpMeetingEventSeq,
  QUEUE_REQUEST_KINDS,
  queueKindNeedsText,
  type QueueRequestKind,
} from "@/lib/meeting/moderator-queue";
import { resolveParticipantFromToken } from "@/lib/meeting/participant-identity";
import {
  verifyParticipantToken,
  verifyPresenterToken,
} from "@/lib/meeting/presenter-auth";
import type { MeetingQueueRequestKind } from "@/lib/meeting/session-types";
import {
  getSupabaseServiceClient,
  supabaseServiceConfigErrorCode,
  supabaseServiceEnvStatus,
} from "@/lib/supabase/server";

function serviceClientUnavailableResponse(route: string) {
  const checks = supabaseServiceEnvStatus();
  const code = supabaseServiceConfigErrorCode(checks);
  return NextResponse.json(
    {
      error: "Supabase service client unavailable",
      code,
      checks,
      route,
    },
    { status: 503 },
  );
}

type PostBody = {
  text?: string;
  participantId?: string;
  participantToken?: string;
  sectionKey?: string;
  sectionLabel?: string;
  presentationPointId?: string;
  requestKind?: MeetingQueueRequestKind;
  source?: string;
  idempotencyKey?: string;
};

const KINDS = new Set<string>(QUEUE_REQUEST_KINDS);

export async function POST(
  request: Request,
  context: { params: Promise<{ meetingId: string }> },
) {
  const { meetingId } = await context.params;
  const body = (await request.json()) as PostBody;
  const requestKind = (body.requestKind ?? "written_question") as QueueRequestKind;
  if (!KINDS.has(requestKind)) {
    return NextResponse.json({ error: "invalid requestKind" }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  if (queueKindNeedsText(requestKind) && !text) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }

  let participantId = await resolveParticipantFromToken(
    meetingId,
    body.participantToken ?? null,
  );
  const pidBody = (body.participantId ?? "").trim();
  if (
    !participantId &&
    pidBody &&
    body.participantToken &&
    verifyParticipantToken(meetingId, pidBody, body.participantToken)
  ) {
    participantId = pidBody;
  }
  if (!participantId) {
    return NextResponse.json({ error: "Invalid participant token" }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient("meeting/questions POST");
  if (!supabase) {
    return serviceClientUnavailableResponse("meeting/questions POST");
  }

  const idempotencyKey = (body.idempotencyKey ?? "").trim() || null;
  if (idempotencyKey) {
    const { data: existing } = await supabase
      .from("meeting_questions")
      .select(
        "id, created_at, text, status, answer_text, section_label, presentation_point_id, request_kind, source, participant_id, dismissed_at",
      )
      .eq("meeting_id", meetingId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ ok: true, question: existing, duplicate: true });
    }
  }

  const row = {
    meeting_id: meetingId,
    participant_id: participantId,
    section_key: body.sectionKey ?? "general",
    section_label: body.sectionLabel ?? "General",
    presentation_point_id: body.presentationPointId ?? null,
    text: text ? text.slice(0, 600) : null,
    status: "open" as const,
    request_kind: requestKind,
    source: (body.source ?? "participant").slice(0, 80),
    idempotency_key: idempotencyKey,
  };

  const { data, error } = await supabase
    .from("meeting_questions")
    .insert(row)
    .select(
      "id, created_at, text, status, answer_text, section_label, presentation_point_id, request_kind, source, participant_id, dismissed_at",
    )
    .single();

  if (error) {
    if (error.code === "23505" && idempotencyKey) {
      const { data: existing } = await supabase
        .from("meeting_questions")
        .select(
          "id, created_at, text, status, answer_text, section_label, presentation_point_id, request_kind, source, participant_id, dismissed_at",
        )
        .eq("meeting_id", meetingId)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (existing) {
        return NextResponse.json({ ok: true, question: existing, duplicate: true });
      }
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await bumpMeetingEventSeq(supabase, meetingId);
  return NextResponse.json({ ok: true, question: data });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ meetingId: string }> },
) {
  const { meetingId } = await context.params;
  const presenterToken = request.headers.get("x-presenter-token");
  const participantToken = request.headers.get("x-participant-token");

  const asPresenter = verifyPresenterToken(meetingId, presenterToken);
  const ownerId = asPresenter
    ? null
    : await resolveParticipantFromToken(meetingId, participantToken);

  if (!asPresenter && !ownerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient("meeting/questions GET");
  if (!supabase) {
    return serviceClientUnavailableResponse("meeting/questions GET");
  }

  let query = supabase
    .from("meeting_questions")
    .select("*")
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (!asPresenter && ownerId) {
    query = query.eq("participant_id", ownerId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []).map((row) => {
    if (asPresenter) return row;
    return {
      id: row.id,
      meeting_id: row.meeting_id,
      participant_id: row.participant_id,
      section_key: row.section_key,
      section_label: row.section_label,
      presentation_point_id: row.presentation_point_id,
      request_kind: row.request_kind,
      source: row.source,
      text: row.text,
      status: row.status,
      answer_text: row.answer_text,
      created_at: row.created_at,
      answered_at: row.answered_at,
      dismissed_at: row.dismissed_at,
    };
  });

  return NextResponse.json({
    meetingId,
    questions: rows,
    scope: asPresenter ? "moderator" : "self",
  });
}
