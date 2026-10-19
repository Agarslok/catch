/**
 * Tavus CVI (v2 API). En el dashboard Tavus:
 * - TAVUS_REPLICA_ID → Face ID (`face_id` en POST /v2/conversations)
 * - TAVUS_PERSONA_ID → PAL ID (`pal_id`)
 */
export type TavusServerConfig = {
  apiKey: string;
  faceId: string;
  palId: string;
};

export function getTavusServerConfig(): TavusServerConfig | null {
  const apiKey = process.env.TAVUS_API_KEY?.trim();
  const faceId = process.env.TAVUS_REPLICA_ID?.trim();
  const palId = process.env.TAVUS_PERSONA_ID?.trim();
  if (!apiKey || !faceId || !palId) return null;
  return { apiKey, faceId, palId };
}

export function tavusIsConfigured(): boolean {
  return getTavusServerConfig() !== null;
}

/** Diagnóstico seguro: no incluye valores de las variables. */
export function tavusConfigPresence(): {
  hasApiKey: boolean;
  hasReplicaId: boolean;
  hasPersonaId: boolean;
} {
  return {
    hasApiKey: Boolean(process.env.TAVUS_API_KEY?.trim()),
    hasReplicaId: Boolean(process.env.TAVUS_REPLICA_ID?.trim()),
    hasPersonaId: Boolean(process.env.TAVUS_PERSONA_ID?.trim()),
  };
}
