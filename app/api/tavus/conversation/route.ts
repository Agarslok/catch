import { NextResponse } from "next/server";
import { verifyPresenterToken } from "@/lib/meeting/presenter-auth";
import {
  readMonitorTavusSession,
  writeMonitorTavusSession,
} from "@/lib/meeting/tavus-viewer-session";
import { formatUnknownError } from "@/lib/http/api-error";
import {
  createTavusConversation,
  endTavusConversation,
  TavusApiError,
} from "@/lib/tavus/client";
import { tavusIsConfigured } from "@/lib/tavus/config";
import {
  getSupabaseServerClient,
  getSupabaseServiceClient,
} from "@/lib/supabase/server";

export async function GET() {
  return NextResponse.json({ configured: tavusIsConfigured() });
}

export async function POST(request: Request) {
  if (!tavusIsConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        error:
          "Tavus no está configurado. Define TAVUS_API_KEY, TAVUS_REPLICA_ID y TAVUS_PERSONA_ID en el servidor.",
      },
      { status: 503 },
    );
  }

  let body: {
    meetingId?: string;
    conversationName?: string;
    forceNew?: boolean;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  const forceNew = body.forceNew === true;

  const meetingId = body.meetingId?.trim();
  if (!meetingId) {
    return NextResponse.json({ error: "meetingId required" }, { status: 400 });
  }
  const token = request.headers.get("x-presenter-token");
  if (!verifyPresenterToken(meetingId, token)) {
    return NextResponse.json({ error: "Unauthorized presenter" }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient() ?? getSupabaseServerClient();

  try {
    if (supabase && !forceNew) {
      const existing = await readMonitorTavusSession(supabase, meetingId);
      if (existing?.status === "active" && existing.conversationUrl) {
        return NextResponse.json({
          configured: true,
          conversationId: existing.conversationId ?? null,
          conversationUrl: existing.conversationUrl,
          meetingToken: existing.meetingToken,
          status: "active",
          reused: true,
        });
      }
    }

    if (supabase && forceNew) {
      const existing = await readMonitorTavusSession(supabase, meetingId);
      if (existing?.conversationId) {
        try {
          await endTavusConversation(existing.conversationId);
        } catch {
          /* sala ya cerrada en Tavus */
        }
      }
      await writeMonitorTavusSession(supabase, meetingId, {
        status: "ended",
        conversationUrl: "",
        meetingToken: null,
        updatedAt: new Date().toISOString(),
      });
    }

    const created = await createTavusConversation({
      conversationName: body.conversationName ?? (meetingId ? `catch-${meetingId}` : undefined),
      conversationalContext:
        "Eres Frida, avatar de Catch. Hablas en español. El texto que recibes por echo ya fue generado por el asistente de la presentación; léelo con naturalidad sin inventar datos nuevos.",
    });

    if (supabase) {
      await writeMonitorTavusSession(supabase, meetingId, {
        status: "active",
        conversationId: created.conversation_id,
        conversationUrl: created.conversation_url,
        meetingToken: created.meeting_token ?? null,
        updatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      configured: true,
      conversationId: created.conversation_id,
      conversationUrl: created.conversation_url,
      meetingToken: created.meeting_token ?? null,
      status: created.status ?? "active",
    });
  } catch (e) {
    if (e instanceof TavusApiError) {
      const status = e.status >= 400 && e.status < 600 ? e.status : 502;
      return NextResponse.json({ error: e.message }, { status });
    }
    const message = formatUnknownError(e, "Tavus request failed");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
