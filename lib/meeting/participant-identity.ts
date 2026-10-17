import {
  createParticipantToken,
  hashParticipantToken,
  participantTokensMatch,
  randomParticipantToken,
} from "@/lib/meeting/presenter-auth";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export async function issueParticipantToken(
  meetingId: string,
  participantId: string,
  existingToken: string | null,
): Promise<{ token: string; status: number; error?: string }> {
  const service = getSupabaseServiceClient();
  if (!service) {
    return { token: createParticipantToken(meetingId, participantId), status: 200 };
  }

  const { data: row, error } = await service
    .from("meeting_participants")
    .select("token_hash")
    .eq("meeting_id", meetingId)
    .eq("participant_id", participantId)
    .maybeSingle();

  if (error) {
    return { token: "", status: 500, error: error.message };
  }

  if (row?.token_hash) {
    if (existingToken && participantTokensMatch(existingToken, row.token_hash)) {
      return { token: existingToken, status: 200 };
    }
    return { token: "", status: 401, error: "Identity already registered" };
  }

  const token = randomParticipantToken();
  const { error: insertError } = await service.from("meeting_participants").insert({
    meeting_id: meetingId,
    participant_id: participantId,
    token_hash: hashParticipantToken(token),
  });

  if (insertError) {
    return { token: "", status: 500, error: insertError.message };
  }
  return { token, status: 200 };
}

export async function resolveParticipantFromToken(
  meetingId: string,
  token: string | null,
): Promise<string | null> {
  if (!token) return null;
  const service = getSupabaseServiceClient();
  if (!service) {
    return null;
  }
  const { data } = await service
    .from("meeting_participants")
    .select("participant_id, token_hash")
    .eq("meeting_id", meetingId)
    .eq("token_hash", hashParticipantToken(token))
    .maybeSingle();
  if (!data?.participant_id) return null;
  if (!participantTokensMatch(token, data.token_hash)) return null;
  return data.participant_id;
}
