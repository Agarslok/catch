/** Payloads documented at https://docs.tavus.io/sections/conversational-video-interface/interactions-protocols/overview */

export function buildConversationEcho(
  conversationId: string,
  text: string,
): Record<string, unknown> {
  return {
    message_type: "conversation",
    event_type: "conversation.echo",
    conversation_id: conversationId,
    properties: {
      modality: "text",
      text,
      done: true,
    },
  };
}

export function buildConversationInterrupt(conversationId: string): Record<string, unknown> {
  return {
    message_type: "conversation",
    event_type: "conversation.interrupt",
    conversation_id: conversationId,
  };
}
