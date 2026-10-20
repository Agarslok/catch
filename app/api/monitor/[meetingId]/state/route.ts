import { NextResponse } from "next/server";
import { verifyPresenterToken } from "@/lib/meeting/presenter-auth";
import {
  isMonitorSessionPhase,
  resolveInitialMonitorSessionPhase,
} from "@/lib/meeting/monitor-session-phase";
import { readMonitorTavusSessionFromGlobalView } from "@/lib/meeting/tavus-viewer-session";
import { readMeetingState } from "@/lib/meeting/state-server";
import {
  getSupabaseServerClient,
  getSupabaseServiceClient,
} from "@/lib/supabase/server";

/** Paso global del Monitor HTML (índice en PASOS), sin validar guion de sesión. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ meetingId: string }> },
) {
  const { meetingId } = await context.params;
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ configured: false, step: 0, unlockedStep: 0 });
  }
  try {
    const data = await readMeetingState(supabase, meetingId);
    const globalView = (data?.global_view ?? {}) as Record<string, unknown>;
    const step = data?.current_step ?? 0;
    const unlockedStep = data?.unlocked_step ?? data?.current_step ?? 0;
    const sessionPhase = resolveInitialMonitorSessionPhase(
      globalView.monitorSessionPhase,
      step,
      unlockedStep,
    );
    return NextResponse.json({
      configured: true,
      step,
      unlockedStep,
      presentationStatus: data?.presentation_status ?? "live",
      sessionPhase,
      eventSeq: data?.event_seq ?? 0,
      monitorHighlight: globalView.monitorHighlight ?? null,
      monitorTavusSession: readMonitorTavusSessionFromGlobalView(globalView),
      awaitingModerator: globalView.awaitingModerator === true,
      sessionResetNonce: globalView.sessionResetNonce ?? null,
      sectionAwaitSectionId: globalView.sectionAwaitSectionId ?? null,
      sectionAwaitSectionLabel: globalView.sectionAwaitSectionLabel ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "read failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
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

  const body = (await request.json()) as {
    step?: number;
    unlockedStep?: number;
    reset?: boolean;
    highlight?: Record<string, unknown> | null;
    sessionPhase?: string;
  };
  const existing = await readMeetingState(supabase, meetingId);
  const prevGlobal = (existing?.global_view ?? {}) as Record<string, unknown>;
  const nextEventSeq = (existing?.event_seq ?? 0) + 1;

  if (body.sessionPhase !== undefined) {
    if (!isMonitorSessionPhase(body.sessionPhase)) {
      return NextResponse.json({ error: "invalid sessionPhase" }, { status: 400 });
    }
    const globalView = {
      ...prevGlobal,
      monitorSessionPhase: body.sessionPhase,
    };
    const { error: phaseError } = await supabase.from("meeting_state").upsert({
      meeting_id: meetingId,
      current_step: existing?.current_step ?? 0,
      unlocked_step: existing?.unlocked_step ?? 0,
      global_view: globalView,
      event_seq: nextEventSeq,
      updated_at: new Date().toISOString(),
    });
    if (phaseError) {
      return NextResponse.json({ error: phaseError.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, sessionPhase: body.sessionPhase });
  }

  if (body.highlight !== undefined) {
    const globalView = {
      ...prevGlobal,
      monitorHighlight: body.highlight,
    };
    const { error: hlError } = await supabase.from("meeting_state").upsert({
      meeting_id: meetingId,
      current_step: existing?.current_step ?? 0,
      unlocked_step: existing?.unlocked_step ?? 0,
      global_view: globalView,
      event_seq: nextEventSeq,
      updated_at: new Date().toISOString(),
    });
    if (hlError) {
      return NextResponse.json({ error: hlError.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, monitorHighlight: body.highlight });
  }

  const step = Math.max(0, Math.floor(body.step ?? 0));
  if (
    !body.reset &&
    existing &&
    existing.current_step === step &&
    (body.unlockedStep === undefined || existing.unlocked_step === body.unlockedStep)
  ) {
    return NextResponse.json({ ok: true, step, skipped: true });
  }
  const prevUnlocked = existing?.unlocked_step ?? 0;
  const unlockedStep = body.reset
    ? step
    : Math.max(
        prevUnlocked,
        body.unlockedStep !== undefined ? Math.floor(body.unlockedStep) : step,
      );

  const { error } = await supabase.from("meeting_state").upsert({
    meeting_id: meetingId,
    current_step: step,
    unlocked_step: unlockedStep,
    global_view: prevGlobal,
    event_seq: nextEventSeq,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, step, unlockedStep });
}
