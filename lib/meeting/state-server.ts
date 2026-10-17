import { applyChartActionToGlobalView, mergeGlobalView } from "@/lib/meeting/global-view";
import {
  clampScriptIndex,
  generateSessionScript,
  getPointAt,
  getPointIndex,
  mergePresentedChart,
  validateSessionScript,
} from "@/lib/meeting/script";
import type { PresentedChart, SessionScript } from "@/lib/meeting/script-types";
import type {
  MeetingGlobalView,
  MeetingPresentationStatus,
  PublishStateInput,
} from "@/lib/meeting/session-types";
import { validateChartAction } from "@/lib/visualization/actions";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function readMeetingState(supabase: SupabaseClient, meetingId: string) {
  const { data, error } = await supabase
    .from("meeting_state")
    .select(
      "meeting_id, current_step, unlocked_step, current_point_id, presentation_status, global_view, event_seq, script, presented_charts, updated_at",
    )
    .eq("meeting_id", meetingId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function resolveScript(
  meetingId: string,
  stored: SessionScript | null | undefined,
  incoming?: SessionScript,
): SessionScript {
  if (incoming) {
    const v = validateSessionScript(incoming);
    if (v.ok) return v.script;
  }
  if (stored) {
    const v = validateSessionScript(stored);
    if (v.ok) return v.script;
  }
  return generateSessionScript(meetingId);
}

export async function publishMeetingState(
  supabase: SupabaseClient,
  meetingId: string,
  input: PublishStateInput,
) {
  const existing = await readMeetingState(supabase, meetingId);
  const script = resolveScript(
    meetingId,
    existing?.script as SessionScript | null,
    input.script,
  );

  let currentStep: number;
  if (input.currentPointId) {
    const idx = getPointIndex(script, input.currentPointId);
    currentStep = idx >= 0 ? idx : clampScriptIndex(script, existing?.current_step ?? 0);
  } else if (input.currentStep !== undefined) {
    currentStep = clampScriptIndex(script, input.currentStep);
  } else {
    currentStep = clampScriptIndex(script, existing?.current_step ?? 0);
  }

  const point = getPointAt(script, currentStep);
  const unlockedStep = input.reset
    ? currentStep
    : input.unlockedStep !== undefined
      ? clampScriptIndex(script, input.unlockedStep)
      : Math.max(existing?.unlocked_step ?? 0, currentStep);

  let globalView: MeetingGlobalView =
    (existing?.global_view as MeetingGlobalView) ?? {};
  if (input.globalView) {
    globalView = mergeGlobalView(globalView, input.globalView);
  }
  if (input.action) {
    const validated = validateChartAction(input.action);
    if (validated.ok && validated.action.scope === "global") {
      globalView = applyChartActionToGlobalView(globalView, validated.action);
    }
  }

  const presentationStatus: MeetingPresentationStatus =
    input.presentationStatus ??
    (existing?.presentation_status as MeetingPresentationStatus) ??
    "live";

  let presentedCharts: PresentedChart[] =
    (existing?.presented_charts as PresentedChart[] | null) ?? [];
  if (point.kind === "chart" && point.sectionId) {
    for (const ref of point.chartRefs) {
      presentedCharts = mergePresentedChart(presentedCharts, {
        key: `${point.sectionId}:${point.id}:${ref.id}`,
        meetingId,
        sectionId: point.sectionId,
        pointId: point.id,
        chartId: ref.id,
        title: point.title,
        chapterIndex: ref.chapterIndex,
        beat: ref.beat,
        order: presentedCharts.length,
      });
    }
  }

  const eventSeq = (existing?.event_seq ?? 0) + 1;

  const row = {
    meeting_id: meetingId,
    current_step: currentStep,
    unlocked_step: unlockedStep,
    current_point_id: point.id,
    presentation_status: presentationStatus,
    global_view: globalView,
    event_seq: eventSeq,
    script,
    presented_charts: presentedCharts,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("meeting_state")
    .upsert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}
