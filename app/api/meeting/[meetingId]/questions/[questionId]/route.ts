import { NextResponse } from "next/server";
import { bumpMeetingEventSeq } from "@/lib/meeting/moderator-queue";
import { verifyPresenterToken } from "@/lib/meeting/presenter-auth";
import type { MeetingQuestionStatus } from "@/lib/meeting/session-types";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

type PatchBody = {
  answerText?: string;
  status?: MeetingQuestionStatus;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ meetingId: string; questionId: string }> },
) {
  const { meetingId, questionId } = await context.params;
  const token = request.headers.get("x-presenter-token");
  if (!verifyPresenterToken(meetingId, token)) {
    return NextResponse.json({ error: "Unauthorized presenter" }, { status: 401 });
  }

  const body = (await request.json()) as PatchBody;
  const answerText = (body.answerText ?? "").trim();
  const status = body.status;

  if (status === "dismissed") {
    const supabase = getSupabaseServiceClient();
    if (!supabase) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY required" }, { status: 503 });
    }
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("meeting_questions")
      .update({
        status: "dismissed",
        dismissed_at: now,
      })
      .eq("meeting_id", meetingId)
      .eq("id", questionId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    await bumpMeetingEventSeq(supabase, meetingId);
    return NextResponse.json({ ok: true, question: data });
  }

  if (status === "answered" && !answerText) {
    const supabase = getSupabaseServiceClient();
    if (!supabase) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY required" }, { status: 503 });
    }
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("meeting_questions")
      .update({
        status: "answered",
        answered_at: now,
      })
      .eq("meeting_id", meetingId)
      .eq("id", questionId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    await bumpMeetingEventSeq(supabase, meetingId);
    return NextResponse.json({ ok: true, question: data });
  }

  if (!answerText) {
    return NextResponse.json({ error: "answerText or status required" }, { status: 400 });
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY required" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("meeting_questions")
    .update({
      status: "answered",
      answer_text: answerText.slice(0, 2000),
      answered_at: new Date().toISOString(),
    })
    .eq("meeting_id", meetingId)
    .eq("id", questionId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await bumpMeetingEventSeq(supabase, meetingId);
  return NextResponse.json({ ok: true, question: data });
}
