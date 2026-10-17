import { NextResponse } from "next/server";
import { verifyPresenterToken } from "@/lib/meeting/presenter-auth";
import {
  filterScriptForVisitor,
  generateSessionScript,
  validateSessionScript,
} from "@/lib/meeting/script";
import type { SessionScript } from "@/lib/meeting/script-types";
import { publishMeetingState, readMeetingState } from "@/lib/meeting/state-server";
import {
  getSupabaseServerClient,
  getSupabaseServiceClient,
} from "@/lib/supabase/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ meetingId: string }> },
) {
  const { meetingId } = await context.params;
  const supabase = getSupabaseServerClient();
  const isPresenter = verifyPresenterToken(
    meetingId,
    request.headers.get("x-presenter-token"),
  );

  let stored: SessionScript | null = null;
  let unlocked = 0;
  if (supabase) {
    try {
      const data = await readMeetingState(supabase, meetingId);
      const raw = data?.script as SessionScript | null | undefined;
      const v = raw ? validateSessionScript(raw) : null;
      stored = v && v.ok ? v.script : null;
      unlocked = data?.unlocked_step ?? 0;
    } catch {
      stored = null;
    }
  }

  const script = stored ?? generateSessionScript(meetingId);
  return NextResponse.json({
    meetingId,
    script: isPresenter ? script : filterScriptForVisitor(script, unlocked),
    generated: !stored,
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ meetingId: string }> },
) {
  const { meetingId } = await context.params;
  const token = request.headers.get("x-presenter-token");
  if (!verifyPresenterToken(meetingId, token)) {
    return NextResponse.json({ error: "Unauthorized presenter" }, { status: 401 });
  }

  const body = (await request.json()) as { action?: string; script?: unknown };
  const generated = generateSessionScript(meetingId);
  const incoming = body.script ? validateSessionScript(body.script) : null;

  if (body.script && incoming && !incoming.ok) {
    return NextResponse.json({ error: incoming.errors }, { status: 400 });
  }

  const script = incoming && incoming.ok ? incoming.script : generated;
  const supabase = getSupabaseServiceClient() ?? getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: true, script, persisted: false });
  }

  const existing = await readMeetingState(supabase, meetingId);
  if (existing?.script && existing.current_step > 0 && body.action !== "replace") {
    return NextResponse.json(
      {
        error:
          "El guion ya está en uso. Envíe action=replace para sustituirlo de forma controlada.",
        currentPointId: existing.current_point_id,
      },
      { status: 409 },
    );
  }

  const state = await publishMeetingState(supabase, meetingId, {
    script,
    currentStep: 0,
    reset: true,
  });
  return NextResponse.json({ ok: true, script, state, persisted: true });
}
