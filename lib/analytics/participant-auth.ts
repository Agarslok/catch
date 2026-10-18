/** Credenciales de visitante para ingestión de eventos (solo en cliente). */
let visitorAuth: { participantId: string; token: string } | null = null;

export function setVisitorAnalyticsAuth(participantId: string, token: string | null): void {
  if (!token || !participantId) {
    visitorAuth = null;
    return;
  }
  visitorAuth = { participantId, token };
}

export function getVisitorAnalyticsAuth(): { participantId: string; token: string } | null {
  return visitorAuth;
}
