import type { InteractionEventInput } from "./types";
import { INTERACTION_EVENT_TYPES } from "./types";
import { resolveParticipantFromToken } from "@/lib/meeting/participant-identity";
import { verifyParticipantToken } from "@/lib/meeting/presenter-auth";
import { isMissingSchemaColumnError } from "@/lib/meeting/visitor-register";
import { getSupabaseServiceClient, getSupabaseServerClient } from "@/lib/supabase/server";

export function isValidInteractionEvent(e: InteractionEventInput): boolean {
  return (
    Boolean(e.client_event_id) &&
    Boolean(e.meeting_id) &&
    Boolean(e.session_id) &&
    Boolean(e.participant_id) &&
    INTERACTION_EVENT_TYPES.includes(e.event_type as InteractionEventInput["event_type"])
  );
}

export type IngestAuthResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/** Visitantes deben demostrar el token emitido al registrarse. */
export async function authorizeVisitorEventBatch(
  meetingId: string,
  events: InteractionEventInput[],
  participantIdHeader: string | null,
  participantToken: string | null,
): Promise<IngestAuthResult> {
  const visitorEvents = events.filter((e) => e.participant_role === "visitor");
  if (visitorEvents.length === 0) return { ok: true };

  const token = (participantToken ?? "").trim();
  const headerId = (
    participantIdHeader ??
    visitorEvents[0]?.participant_id ??
    ""
  ).trim();
  if (!token || !headerId) {
    return { ok: false, status: 401, error: "Participant token required" };
  }

  let resolved = await resolveParticipantFromToken(meetingId, token);
  if (!resolved && verifyParticipantToken(meetingId, headerId, token)) {
    resolved = headerId;
  }
  if (!resolved || resolved !== headerId) {
    return { ok: false, status: 401, error: "Invalid participant token" };
  }

  for (const e of visitorEvents) {
    if (e.participant_id !== resolved) {
      return { ok: false, status: 403, error: "participant_id mismatch" };
    }
    if (e.meeting_id !== meetingId) {
      return { ok: false, status: 400, error: "meeting_id mismatch" };
    }
  }

  return { ok: true };
}

export async function persistInteractionEvents(
  events: InteractionEventInput[],
): Promise<{ ok: true; accepted: number } | { ok: false; error: string }> {
  const rows = events.map((e) => ({
    client_event_id: e.client_event_id,
    meeting_id: e.meeting_id,
    session_id: e.session_id,
    participant_id: e.participant_id,
    participant_role: e.participant_role,
    event_type: e.event_type,
    chart_id: e.chart_id ?? null,
    chart_type: e.chart_type ?? null,
    element_id: e.element_id ?? null,
    element_label: e.element_label ?? null,
    action: e.action ?? null,
    metadata: e.metadata ?? {},
    schema_version: e.schema_version ?? "1.0",
    created_at: e.timestamp ?? new Date().toISOString(),
  }));

  const supabase = getSupabaseServiceClient("persistInteractionEvents") ?? getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Supabase not configured" };
  }

  const { error } = await supabase.from("meeting_interaction_events").upsert(rows, {
    onConflict: "client_event_id",
    ignoreDuplicates: true,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const now = new Date().toISOString();
  for (const e of events) {
    const displayName =
      typeof e.metadata?.display_name === "string" ? e.metadata.display_name : null;
    const stamp = e.timestamp ?? now;
    if (e.event_type === "session.join") {
      const full = await supabase.from("meeting_session_registry").upsert(
        {
          session_id: e.session_id,
          meeting_id: e.meeting_id,
          participant_id: e.participant_id,
          participant_role: e.participant_role,
          joined_at: stamp,
          left_at: null,
          last_seen_at: stamp,
          display_name: displayName,
          schema_version: e.schema_version ?? "1.0",
        },
        { onConflict: "session_id" },
      );
      if (full.error) {
        await supabase.from("meeting_session_registry").upsert(
          {
            session_id: e.session_id,
            meeting_id: e.meeting_id,
            participant_id: e.participant_id,
            participant_role: e.participant_role,
            joined_at: stamp,
            left_at: null,
            schema_version: e.schema_version ?? "1.0",
          },
          { onConflict: "session_id" },
        );
      }
    } else if (e.event_type === "session.leave") {
      const left = await supabase
        .from("meeting_session_registry")
        .update({ left_at: stamp, last_seen_at: stamp })
        .eq("session_id", e.session_id);
      if (left.error) {
        await supabase
          .from("meeting_session_registry")
          .update({ left_at: stamp })
          .eq("session_id", e.session_id);
      }
    } else {
      const touch = await supabase
        .from("meeting_session_registry")
        .update({ last_seen_at: stamp })
        .eq("session_id", e.session_id);
      if (touch.error && isMissingSchemaColumnError(touch.error)) {
        /* Heartbeats siguen en meeting_interaction_events; presencia usa esos timestamps. */
      }
    }
  }

  return { ok: true, accepted: rows.length };
}
