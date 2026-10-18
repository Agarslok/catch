import {
  createParticipantToken,
  hashParticipantToken,
  participantTokensMatch,
  randomParticipantToken,
} from "@/lib/meeting/presenter-auth";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export type VisitorRegisterResult =
  | {
      status: 200;
      participantId: string;
      displayName: string;
      token: string;
      joinedAt: string;
    }
  | { status: 400 | 409 | 500; error: string };

export function normalizeVisitorDisplayName(raw: string): string | null {
  const name = raw.trim();
  return name.length > 0 ? name : null;
}

export function isValidVisitorParticipantId(id: string): boolean {
  const t = id.trim();
  return t.length >= 8 && t.length <= 128;
}

/** Columna display_name ausente en Postgres / caché de PostgREST. */
export function isMissingSchemaColumnError(
  error: { code?: string | null; message?: string | null } | null | undefined,
): boolean {
  if (!error) return false;
  const code = String(error.code ?? "");
  const msg = String(error.message ?? "").toLowerCase();
  return (
    code === "42703" ||
    code === "PGRST204" ||
    (msg.includes("display_name") &&
      (msg.includes("column") ||
        msg.includes("schema cache") ||
        msg.includes("could not find")))
  );
}

export async function registerMeetingVisitor(
  meetingId: string,
  displayName: string,
  participantId: string,
  existingToken: string | null,
): Promise<VisitorRegisterResult> {
  const name = normalizeVisitorDisplayName(displayName);
  if (!name) {
    return { status: 400, error: "Ingrese un nombre para continuar." };
  }
  if (!isValidVisitorParticipantId(participantId)) {
    return { status: 400, error: "Identificador de participante inválido." };
  }

  const service = getSupabaseServiceClient();
  const joinedAt = new Date().toISOString();

  if (!service) {
    return {
      status: 200,
      participantId: participantId.trim(),
      displayName: name,
      token: createParticipantToken(meetingId, participantId.trim()),
      joinedAt,
    };
  }

  const pid = participantId.trim();
  type ParticipantRow = {
    token_hash?: string | null;
    display_name?: string | null;
    created_at?: string | null;
  };
  const readWithName = await service
    .from("meeting_participants")
    .select("token_hash, display_name, created_at")
    .eq("meeting_id", meetingId)
    .eq("participant_id", pid)
    .maybeSingle();

  let row = readWithName.data as ParticipantRow | null;
  let readError = readWithName.error;
  let persistDisplayName = true;
  if (readError && isMissingSchemaColumnError(readError)) {
    persistDisplayName = false;
    const fallback = await service
      .from("meeting_participants")
      .select("token_hash, created_at")
      .eq("meeting_id", meetingId)
      .eq("participant_id", pid)
      .maybeSingle();
    row = fallback.data as ParticipantRow | null;
    readError = fallback.error;
  }

  if (readError) {
    return { status: 500, error: readError.message };
  }

  if (row?.token_hash) {
    if (existingToken && participantTokensMatch(existingToken, row.token_hash)) {
      return {
        status: 200,
        participantId: pid,
        displayName: row.display_name?.trim() || name,
        token: existingToken,
        joinedAt: (row.created_at as string) ?? joinedAt,
      };
    }
    return {
      status: 409,
      error: "Este identificador ya está registrado. Recargue la página e intente de nuevo.",
    };
  }

  const token = randomParticipantToken();
  const tokenHash = hashParticipantToken(token);
  const baseRow = {
    meeting_id: meetingId,
    participant_id: pid,
    token_hash: tokenHash,
  };
  const insertPayload: Record<string, string> = persistDisplayName
    ? { ...baseRow, display_name: name }
    : baseRow;
  let insertError = (
    await service.from("meeting_participants").insert(insertPayload)
  ).error;

  if (insertError && persistDisplayName && isMissingSchemaColumnError(insertError)) {
    persistDisplayName = false;
    insertError = (await service.from("meeting_participants").insert(baseRow)).error;
  }

  if (insertError) {
    if (insertError.code === "23505") {
      return {
        status: 409,
        error: "El registro ya existe. Intente de nuevo en unos segundos.",
      };
    }
    return { status: 500, error: insertError.message };
  }

  return {
    status: 200,
    participantId: pid,
    displayName: name,
    token,
    joinedAt,
  };
}
