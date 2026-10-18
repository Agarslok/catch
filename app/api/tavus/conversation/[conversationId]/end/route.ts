import { NextResponse } from "next/server";
import { verifyPresenterToken } from "@/lib/meeting/presenter-auth";
import { writeMonitorTavusSession } from "@/lib/meeting/tavus-viewer-session";
import { endTavusConversation, TavusApiError } from "@/lib/tavus/client";
import { tavusIsConfigured } from "@/lib/tavus/config";
import {
  getSupabaseServerClient,
  getSupabaseServiceClient,
} from "@/lib/supabase/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  if (!tavusIsConfigured()) {
    return NextResponse.json({ error: "Tavus not configured" }, { status: 503 });
  }

  const { conversationId } = await context.params;
  let meetingId = "";
  try {
    const body = (await request.json()) as { meetingId?: string };
    meetingId = body.meetingId?.trim() ?? "";
  } catch {
    meetingId = "";
  }

  if (!meetingId) {
    return NextResponse.json({ error: "meetingId required" }, { status: 400 });
  }
  const token = request.headers.get("x-presenter-token");
  if (!verifyPresenterToken(meetingId, token)) {
    return NextResponse.json({ error: "Unauthorized presenter" }, { status: 401 });
  }

  try {
    await endTavusConversation(conversationId);
    const supabase = getSupabaseServiceClient() ?? getSupabaseServerClient();
    if (supabase) {
      await writeMonitorTavusSession(supabase, meetingId, {
        status: "ended",
        conversationUrl: "",
        meetingToken: null,
        updatedAt: new Date().toISOString(),
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof TavusApiError) {
      const status = e.status >= 400 && e.status < 600 ? e.status : 502;
      return NextResponse.json({ error: e.message }, { status });
    }
    const message = e instanceof Error ? e.message : "End conversation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
