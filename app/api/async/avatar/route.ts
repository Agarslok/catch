import { NextResponse } from "next/server";
import { formatUnknownError } from "@/lib/http/api-error";
import { createTavusConversation, TavusApiError } from "@/lib/tavus/client";
import { tavusConfigPresence, tavusIsConfigured } from "@/lib/tavus/config";

/** Avatar independiente: crea la conversación Tavus sin escribir una reunión. */
export async function POST(request: Request) {
  if (!tavusIsConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        error:
          "Tavus no está configurado. Define TAVUS_API_KEY, TAVUS_REPLICA_ID y TAVUS_PERSONA_ID en el servidor.",
        checks: tavusConfigPresence(),
      },
      { status: 503 },
    );
  }

  let conversationName = "catch-async";
  try {
    const body = (await request.json()) as { conversationName?: string };
    const name = body.conversationName?.trim();
    if (name) conversationName = name.slice(0, 80);
  } catch {
    /* cuerpo vacío */
  }

  try {
    const created = await createTavusConversation({
      conversationName,
      conversationalContext:
        "Eres Frida, avatar de Catch. Hablas en español. El texto que recibes por echo ya fue generado por el asistente del informe; léelo con naturalidad sin inventar datos nuevos. No hay una reunión en vivo.",
    });
    return NextResponse.json({
      configured: true,
      conversationId: created.conversation_id,
      conversationUrl: created.conversation_url,
      meetingToken: created.meeting_token ?? null,
      status: created.status ?? "active",
      reused: false,
      detached: true,
    });
  } catch (e) {
    const message =
      e instanceof TavusApiError ? e.message : formatUnknownError(e, "No se pudo crear la conversación Tavus");
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
