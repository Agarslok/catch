import { NextResponse } from "next/server";
import { verifyPresenterToken } from "@/lib/meeting/presenter-auth";
import { filterScriptForVisitor, generateSessionScript, validateSessionScript } from "@/lib/meeting/script";
import type { SessionScript } from "@/lib/meeting/script-types";
import { publishMeetingState, readMeetingState } from "@/lib/meeting/state-server";
import type { PublishStateInput } from "@/lib/meeting/session-types";
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
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  const data = await readMeetingState(supabase, meetingId);
  const isPresenter = verifyPresenterToken(
    meetingId,
    request.headers.get("x-presenter-token"),
  );
  const stored = data?.script as SessionScript | null | undefined;
  const validated = stored ? validateSessionScript(stored) : null;
  const script =
    validated && validated.ok ? validated.script : generateSessionScript(meetingId);
  const unlocked = data?.unlocked_step ?? 0;
  const publicScript = isPresenter ? script : filterScriptForVisitor(script, unlocked);

  return NextResponse.json({
    meetingId,
    state: data
      ? {
          ...data,
          script: publicScript,
        }
      : { script: publicScript, current_step: 0, unlocked_step: 0 },
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

  const supabase = getSupabaseServiceClient() ?? getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const body = (await request.json()) as PublishStateInput;
  try {
    const state = await publishMeetingState(supabase, meetingId, body);
    return NextResponse.json({ ok: true, state });
  } catch (e) {
    const message = e instanceof Error ? e.message : "state update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
