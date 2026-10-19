import { NextResponse } from "next/server";
import { loadPrepFaqsForMeeting, savePrepFaqsForMeeting } from "@/lib/meeting/prep-faqs-persist";
import { prepFaqsFromPutBody } from "@/lib/meeting/prep-faqs";
import { verifyPresenterToken } from "@/lib/meeting/presenter-auth";
import {
  getSupabaseServerClient,
  getSupabaseServiceClient,
  supabaseServiceConfigErrorCode,
  supabaseServiceEnvStatus,
} from "@/lib/supabase/server";

function serviceClientUnavailableResponse(route: string) {
  const checks = supabaseServiceEnvStatus();
  const code = supabaseServiceConfigErrorCode(checks);
  return NextResponse.json(
    {
      error: "Supabase service client unavailable",
      code,
      checks,
      route,
    },
    { status: 503 },
  );
}

function meetingClient(context: string) {
  return getSupabaseServiceClient(context) ?? getSupabaseServerClient();
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ meetingId: string }> },
) {
  const { meetingId } = await context.params;
  const supabase = meetingClient("meeting/prep-faqs GET");
  if (!supabase) {
    return serviceClientUnavailableResponse("meeting/prep-faqs GET");
  }

  try {
    const items = await loadPrepFaqsForMeeting(supabase, meetingId);
    return NextResponse.json({ meetingId, items });
  } catch (e) {
    const message = e instanceof Error ? e.message : "prep-faqs read failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ meetingId: string }> },
) {
  const { meetingId } = await context.params;
  const token = request.headers.get("x-presenter-token");
  if (!verifyPresenterToken(meetingId, token)) {
    return NextResponse.json({ error: "Unauthorized presenter" }, { status: 401 });
  }

  const supabase = meetingClient("meeting/prep-faqs PUT");
  if (!supabase) {
    return serviceClientUnavailableResponse("meeting/prep-faqs PUT");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const items = prepFaqsFromPutBody(meetingId, body);
  const saved = await savePrepFaqsForMeeting(supabase, meetingId, items);
  if (!saved.ok) {
    return NextResponse.json({ error: saved.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, meetingId, items });
}
