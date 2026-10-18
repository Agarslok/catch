import { NextResponse } from "next/server";
import { verifyPresenterToken } from "@/lib/meeting/presenter-auth";
import {
  readMonitorTavusSession,
  writeMonitorTavusSession,
  type MonitorTavusSession,
} from "@/lib/meeting/tavus-viewer-session";
import {
  getSupabaseServerClient,
  getSupabaseServiceClient,
} from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ meetingId: string }> },
) {
  const { meetingId } = await context.params;
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ configured: false, session: null });
  }
  try {
    const session = await readMonitorTavusSession(supabase, meetingId);
    return NextResponse.json({ configured: true, session });
  } catch (e) {
    const message = e instanceof Error ? e.message : "read failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ meetingId: string }> },
) {
  const { meetingId } = await context.params;
  const token = request.headers.get("x-presenter-token");
  if (!verifyPresenterToken(meetingId, token)) {
    return NextResponse.json({ error: "Unauthorized presenter" }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient() ?? getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  let body: {
    status?: MonitorTavusSession["status"];
    conversationUrl?: string;
    meetingToken?: string | null;
    conversationId?: string;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const status = body.status === "ended" ? "ended" : "active";
  const conversationUrl = body.conversationUrl?.trim() ?? "";
  if (status === "active" && !conversationUrl) {
    return NextResponse.json({ error: "conversationUrl required" }, { status: 400 });
  }

  const session: MonitorTavusSession = {
    status,
    conversationId: body.conversationId?.trim() || undefined,
    conversationUrl: status === "ended" ? "" : conversationUrl,
    meetingToken: body.meetingToken ?? null,
    updatedAt: new Date().toISOString(),
  };

  try {
    await writeMonitorTavusSession(supabase, meetingId, session);
    return NextResponse.json({ ok: true, session });
  } catch (e) {
    const message = e instanceof Error ? e.message : "write failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
