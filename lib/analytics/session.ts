import type { ParticipantRole } from "./types";

const SESSION_KEY = "catch:analytics:session";

export function getOrCreateSessionId(meetingId: string): string {
  if (typeof window === "undefined") return "server";
  const key = `${SESSION_KEY}:${meetingId}`;
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const id = `sess-${crypto.randomUUID()}`;
    sessionStorage.setItem(key, id);
    return id;
  } catch {
    return `sess-fallback-${Date.now()}`;
  }
}

export function buildClientEventId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `evt-${crypto.randomUUID()}`;
  }
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function participantRoleFromAppRole(role: "presenter" | "visitor"): ParticipantRole {
  return role;
}
