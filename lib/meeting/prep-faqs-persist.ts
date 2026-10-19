import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizePrepFaqs,
  prepFaqDbRows,
  prepFaqsFromDbRows,
  type PrepFaqItem,
} from "@/lib/meeting/prep-faqs";

const TABLE = "meeting_prep_faqs";

export function prepFaqsFromGlobalView(globalView: unknown): PrepFaqItem[] {
  if (!globalView || typeof globalView !== "object") return [];
  const raw = (globalView as Record<string, unknown>).prepFaqs;
  return normalizePrepFaqs(raw);
}

export function mergePrepFaqsIntoGlobalView(
  globalView: Record<string, unknown> | null | undefined,
  items: PrepFaqItem[],
): Record<string, unknown> {
  return { ...(globalView ?? {}), prepFaqs: items };
}

async function readFromDedicatedTable(
  supabase: SupabaseClient,
  meetingId: string,
): Promise<PrepFaqItem[] | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, meeting_id, sort_order, question, answer")
    .eq("meeting_id", meetingId)
    .order("sort_order", { ascending: true });
  if (error) return null;
  return prepFaqsFromDbRows((data ?? []).filter((row) => row.meeting_id === meetingId));
}

async function writeDedicatedTable(
  supabase: SupabaseClient,
  meetingId: string,
  items: PrepFaqItem[],
): Promise<boolean> {
  const { error: delError } = await supabase.from(TABLE).delete().eq("meeting_id", meetingId);
  if (delError) return false;
  if (items.length === 0) return true;
  const { error: insError } = await supabase.from(TABLE).insert(prepFaqDbRows(meetingId, items));
  return !insError;
}

export async function loadPrepFaqsForMeeting(
  supabase: SupabaseClient,
  meetingId: string,
): Promise<PrepFaqItem[]> {
  const fromTable = await readFromDedicatedTable(supabase, meetingId);
  if (fromTable && fromTable.length > 0) return fromTable;

  const { data, error } = await supabase
    .from("meeting_state")
    .select("global_view")
    .eq("meeting_id", meetingId)
    .maybeSingle();
  if (error) return fromTable ?? [];
  const fromState = prepFaqsFromGlobalView(data?.global_view);
  if (fromState.length > 0) return fromState;
  return fromTable ?? [];
}

export async function savePrepFaqsForMeeting(
  supabase: SupabaseClient,
  meetingId: string,
  items: PrepFaqItem[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: existing, error: readError } = await supabase
    .from("meeting_state")
    .select(
      "meeting_id, current_step, unlocked_step, current_point_id, presentation_status, global_view, event_seq, script, presented_charts",
    )
    .eq("meeting_id", meetingId)
    .maybeSingle();
  if (readError) {
    return { ok: false, error: readError.message };
  }

  const now = new Date().toISOString();
  const globalView = mergePrepFaqsIntoGlobalView(
    (existing?.global_view as Record<string, unknown> | null) ?? {},
    items,
  );

  if (existing) {
    const { error: updateError } = await supabase
      .from("meeting_state")
      .update({ global_view: globalView, updated_at: now })
      .eq("meeting_id", meetingId);
    if (updateError) {
      return { ok: false, error: updateError.message };
    }
  } else {
    const { error: insertError } = await supabase.from("meeting_state").upsert({
      meeting_id: meetingId,
      current_step: 0,
      unlocked_step: 0,
      global_view: globalView,
      event_seq: 0,
      updated_at: now,
    });
    if (insertError) {
      return { ok: false, error: insertError.message };
    }
  }

  await writeDedicatedTable(supabase, meetingId, items);
  return { ok: true };
}
