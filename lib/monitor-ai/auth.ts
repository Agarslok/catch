import { resolveParticipantFromToken } from "@/lib/meeting/participant-identity";
import {
  verifyParticipantToken,
  verifyPresenterToken,
} from "@/lib/meeting/presenter-auth";
import type { MonitorAiCallerRole, MonitorAiErrorCode } from "./types";

export type MonitorAiAuthResult =
  | {
      ok: true;
      caller: { role: MonitorAiCallerRole; participantId?: string };
    }
  | { ok: false; code: MonitorAiErrorCode };

/**
 * Presentador: header x-presenter-token (mismo patrón que /api/monitor/.../state).
 * Visitante: header x-participant-token + participantId en cuerpo (mismo patrón que cola).
 */
export async function authorizeMonitorAiChat(
  meetingId: string,
  request: Request,
  participantIdFromBody: string | undefined,
): Promise<MonitorAiAuthResult> {
  const presenterToken = request.headers.get("x-presenter-token");
  if (verifyPresenterToken(meetingId, presenterToken)) {
    return { ok: true, caller: { role: "moderador" } };
  }

  const participantToken = request.headers.get("x-participant-token");
  if (!participantToken?.trim()) {
    return { ok: false, code: "UNAUTHORIZED" };
  }

  let participantId = await resolveParticipantFromToken(meetingId, participantToken);
  const pidBody = (participantIdFromBody ?? "").trim();

  if (
    !participantId &&
    pidBody &&
    verifyParticipantToken(meetingId, pidBody, participantToken)
  ) {
    participantId = pidBody;
  }

  if (!participantId) {
    return { ok: false, code: "UNAUTHORIZED" };
  }

  if (pidBody && pidBody !== participantId) {
    return { ok: false, code: "FORBIDDEN" };
  }

  return { ok: true, caller: { role: "visitor", participantId } };
}
