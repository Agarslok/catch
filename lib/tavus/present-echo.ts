import { buildConversationEcho, buildConversationInterrupt } from "./interactions";

export type TavusEchoSend = (
  text: string,
  echoId?: string,
) => boolean;

/** Envía conversation.echo (texto autorizado por Gemini, sin conversation.respond). */
export function sendConversationEcho(
  sendAppMessage: (payload: Record<string, unknown>, target: string) => void,
  conversationId: string,
  text: string,
  lastEchoIdRef: { current: string | null },
  echoId?: string,
): boolean {
  const trimmed = text.trim();
  if (!trimmed || !conversationId) return false;
  if (echoId && echoId === lastEchoIdRef.current) return true;

  try {
    sendAppMessage(buildConversationInterrupt(conversationId), "*");
  } catch {
    /* ignore */
  }
  try {
    sendAppMessage(buildConversationEcho(conversationId, trimmed), "*");
  } catch {
    return false;
  }
  if (echoId) lastEchoIdRef.current = echoId;
  return true;
}
