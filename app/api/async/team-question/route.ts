import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  ASYNC_EXPLORE_MEETING_ID,
  normalizeTeamQuestionText,
} from "@/lib/async/team-question";
import {
  bumpMeetingEventSeq,
  queueKindNeedsText,
  type QueueRequestKind,
} from "@/lib/meeting/moderator-queue";
import {
  getSupabaseServiceClient,
  supabaseServiceConfigErrorCode,
  supabaseServiceEnvStatus,
} from "@/lib/supabase/server";

type Body = {
  text?: string;
  sessionId?: string;
  sectionKey?: string;
  sectionLabel?: string;
  presentationPointId?: string;
  requestKind?: QueueRequestKind;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const requestKind = (body.requestKind ?? "written_question") as QueueRequestKind;
  const text = normalizeTeamQuestionText(body.text ?? "");
  if (queueKindNeedsText(requestKind) && !text) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }

  const sessionId = (body.sessionId ?? "").trim() || randomUUID();
  const supabase = getSupabaseServiceClient("async/team-question POST");
  if (!supabase) {
    const checks = supabaseServiceEnvStatus();
    return NextResponse.json({
      ok: true,
      persisted: false,
      sessionId,
      message:
        "Recibimos su mensaje. El equipo Catch lo revisará lo antes posible (almacenamiento en nube no disponible en este entorno).",
      code: supabaseServiceConfigErrorCode(checks),
    });
  }

  const row = {
    meeting_id: ASYNC_EXPLORE_MEETING_ID,
    participant_id: sessionId,
    section_key: (body.sectionKey ?? "async").slice(0, 80),
    section_label: (body.sectionLabel ?? "Exploración asincrónica").slice(0, 200),
    presentation_point_id: body.presentationPointId ?? null,
    text: text ?? null,
    status: "open" as const,
    request_kind: requestKind,
    source: "async_explore",
  };

  const { data, error } = await supabase
    .from("meeting_questions")
    .insert(row)
    .select("id, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await bumpMeetingEventSeq(supabase, ASYNC_EXPLORE_MEETING_ID);

  return NextResponse.json({
    ok: true,
    persisted: true,
    sessionId,
    questionId: data.id,
    message:
      requestKind === "oral_turn"
        ? "Solicitud de contacto registrada. El equipo Catch le responderá pronto."
        : "Pregunta enviada. El equipo Catch responderá lo antes posible.",
  });
}
