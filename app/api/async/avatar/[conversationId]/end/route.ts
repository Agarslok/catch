import { NextResponse } from "next/server";
import { endTavusConversation, TavusApiError } from "@/lib/tavus/client";
import { tavusIsConfigured } from "@/lib/tavus/config";

/** Cierra solo la conversación Tavus. No actualiza sesiones de reunión. */
export async function POST(
  _request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  if (!tavusIsConfigured()) {
    return NextResponse.json({ error: "Tavus not configured" }, { status: 503 });
  }
  const { conversationId } = await context.params;
  try {
    await endTavusConversation(conversationId);
    return NextResponse.json({ ok: true, detached: true });
  } catch (e) {
    const message = e instanceof TavusApiError ? e.message : "No se pudo cerrar la conversación";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
