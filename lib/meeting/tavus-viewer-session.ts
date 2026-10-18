import type { SupabaseClient } from "@supabase/supabase-js";
import { readMeetingState } from "@/lib/meeting/state-server";

export type MonitorTavusSession = {
  status: "active" | "ended";
  conversationId?: string;
  conversationUrl: string;
  meetingToken: string | null;
  updatedAt: string;
};

const KEY = "monitorTavusSession";

export function parseMonitorTavusSession(
  raw: unknown,
): MonitorTavusSession | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.status !== "active" && o.status !== "ended") return null;
  if (typeof o.conversationUrl !== "string" || !o.conversationUrl.trim()) {
    if (o.status === "ended") {
      return {
        status: "ended",
        conversationUrl: "",
        meetingToken: null,
        updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : "",
      };
    }
    return null;
  }
  const conversationId =
    typeof o.conversationId === "string" && o.conversationId.trim()
      ? o.conversationId.trim()
      : undefined;
  return {
    status: o.status,
    conversationId,
    conversationUrl: o.conversationUrl.trim(),
    meetingToken:
      typeof o.meetingToken === "string" && o.meetingToken.trim()
        ? o.meetingToken.trim()
        : null,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : "",
  };
}

export function readMonitorTavusSessionFromGlobalView(
  globalView: Record<string, unknown> | null | undefined,
): MonitorTavusSession | null {
  if (!globalView) return null;
  return parseMonitorTavusSession(globalView[KEY]);
}

export async function readMonitorTavusSession(
  supabase: SupabaseClient,
  meetingId: string,
): Promise<MonitorTavusSession | null> {
  const row = await readMeetingState(supabase, meetingId);
  const gv = (row?.global_view ?? {}) as Record<string, unknown>;
  return readMonitorTavusSessionFromGlobalView(gv);
}

export async function writeMonitorTavusSession(
  supabase: SupabaseClient,
  meetingId: string,
  session: MonitorTavusSession | null,
): Promise<void> {
  const existing = await readMeetingState(supabase, meetingId);
  const prevGlobal = (existing?.global_view ?? {}) as Record<string, unknown>;
  const globalView = { ...prevGlobal };
  if (session) globalView[KEY] = session;
  else delete globalView[KEY];

  const { error } = await supabase.from("meeting_state").upsert({
    meeting_id: meetingId,
    current_step: existing?.current_step ?? 0,
    unlocked_step: existing?.unlocked_step ?? 0,
    global_view: globalView,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
