import { getTavusServerConfig } from "./config";

const TAVUS_API_BASE = "https://tavusapi.com";

export type TavusCreateConversationResult = {
  conversation_id: string;
  conversation_url: string;
  status?: string;
  meeting_token?: string;
};

export class TavusApiError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string) {
    super(`Tavus API ${status}: ${body}`);
    this.status = status;
    this.body = body;
  }
}

async function tavusFetch(
  path: string,
  init: RequestInit & { method: string },
): Promise<Response> {
  const cfg = getTavusServerConfig();
  if (!cfg) {
    throw new TavusApiError(503, "Tavus is not configured on the server");
  }
  const headers = new Headers(init.headers);
  headers.set("x-api-key", cfg.apiKey);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${TAVUS_API_BASE}${path}`, { ...init, headers });
}

export async function createTavusConversation(
  options?: { conversationName?: string; conversationalContext?: string },
): Promise<TavusCreateConversationResult> {
  const cfg = getTavusServerConfig();
  if (!cfg) {
    throw new TavusApiError(503, "Missing TAVUS_API_KEY, TAVUS_REPLICA_ID, or TAVUS_PERSONA_ID");
  }

  const res = await tavusFetch("/v2/conversations", {
    method: "POST",
    body: JSON.stringify({
      face_id: cfg.faceId,
      pal_id: cfg.palId,
      conversation_name: options?.conversationName,
      conversational_context: options?.conversationalContext,
      properties: {
        languages: ["es"],
        participant_absent_timeout: 300,
        participant_left_timeout: 60,
      },
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new TavusApiError(res.status, text || res.statusText);
  }

  const data = JSON.parse(text) as TavusCreateConversationResult;
  if (!data.conversation_id || !data.conversation_url) {
    throw new TavusApiError(502, "Invalid Tavus response: missing conversation_id or conversation_url");
  }
  return data;
}

export async function endTavusConversation(conversationId: string): Promise<void> {
  const id = conversationId.trim();
  if (!id) {
    throw new TavusApiError(400, "conversation_id required");
  }

  const res = await tavusFetch(`/v2/conversations/${encodeURIComponent(id)}/end`, {
    method: "POST",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new TavusApiError(res.status, text || res.statusText);
  }
}
