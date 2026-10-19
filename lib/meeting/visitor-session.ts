export type VisitorActor = { id: string; name: string };

export type VisitorRegisterAttempt = {
  participantId: string;
  displayName: string;
};

export function visitorActorStorageKey(meetingId: string): string {
  return `catch:${meetingId}:actor`;
}

export function visitorTokenStorageKey(meetingId: string): string {
  return `catch:${meetingId}:pt`;
}

export function visitorRegisterAttemptKey(meetingId: string): string {
  return `catch:${meetingId}:registerAttempt`;
}

export function readVisitorActor(meetingId: string): VisitorActor | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(visitorActorStorageKey(meetingId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VisitorActor;
    if (parsed?.id && parsed?.name?.trim()) {
      return { id: parsed.id, name: parsed.name.trim() };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function writeVisitorSession(
  meetingId: string,
  actor: VisitorActor,
  token: string,
): void {
  try {
    localStorage.setItem(visitorActorStorageKey(meetingId), JSON.stringify(actor));
    localStorage.setItem(visitorTokenStorageKey(meetingId), token);
    localStorage.removeItem(visitorRegisterAttemptKey(meetingId));
  } catch {
    /* ignore quota */
  }
}

export function readVisitorToken(meetingId: string): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(visitorTokenStorageKey(meetingId)) ?? "";
  } catch {
    return "";
  }
}

export function readRegisterAttempt(meetingId: string): VisitorRegisterAttempt | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(visitorRegisterAttemptKey(meetingId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VisitorRegisterAttempt;
    if (parsed?.participantId && parsed?.displayName) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

export function writeRegisterAttempt(meetingId: string, attempt: VisitorRegisterAttempt): void {
  try {
    localStorage.setItem(visitorRegisterAttemptKey(meetingId), JSON.stringify(attempt));
  } catch {
    /* ignore */
  }
}

export function newVisitorParticipantId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `v-${Math.random().toString(36).slice(2, 11)}-${Date.now().toString(36)}`;
}
