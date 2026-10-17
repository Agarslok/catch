import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

function getSecret(): string {
  return process.env.MEETING_PRESENTER_SECRET ?? "catch-dev-presenter-secret";
}

export function createPresenterToken(meetingId: string): string {
  return createHmac("sha256", getSecret())
    .update(meetingId)
    .digest("hex")
    .slice(0, 40);
}

export function verifyPresenterToken(meetingId: string, token: string | null): boolean {
  if (!token) return false;
  const expected = createPresenterToken(meetingId);
  if (token.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function createParticipantToken(meetingId: string, participantId: string): string {
  return createHmac("sha256", getSecret())
    .update(`participant:${meetingId}:${participantId}`)
    .digest("hex")
    .slice(0, 40);
}

export function verifyParticipantToken(
  meetingId: string,
  participantId: string,
  token: string | null,
): boolean {
  if (!token || !participantId) return false;
  const expected = createParticipantToken(meetingId, participantId);
  if (token.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function randomParticipantToken(): string {
  return randomBytes(24).toString("hex");
}

export function hashParticipantToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function participantTokensMatch(token: string, tokenHash: string): boolean {
  const a = Buffer.from(hashParticipantToken(token));
  const b = Buffer.from(tokenHash);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
