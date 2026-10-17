import { NextResponse } from "next/server";
import { authorizeMonitorAiChat } from "@/lib/monitor-ai/auth";
import { monitorAiErrorResponse } from "@/lib/monitor-ai/errors";
import { runMonitorAiChat } from "@/lib/monitor-ai/service";
import { validateMonitorAiRequest } from "@/lib/monitor-ai/validate-request";

export async function POST(
  request: Request,
  context: { params: Promise<{ meetingId: string }> },
) {
  const { meetingId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const err = monitorAiErrorResponse("INVALID_REQUEST", "JSON inválido.");
    return NextResponse.json(err.body, { status: err.status });
  }

  const auth = await authorizeMonitorAiChat(
    meetingId,
    request,
    typeof body === "object" &&
      body !== null &&
      "participantId" in body &&
      typeof (body as { participantId?: unknown }).participantId === "string"
      ? (body as { participantId: string }).participantId
      : undefined,
  );
  if (!auth.ok) {
    const err = monitorAiErrorResponse(auth.code);
    return NextResponse.json(err.body, { status: err.status });
  }

  const validated = validateMonitorAiRequest(meetingId, body);
  if (!validated.ok) {
    const err = monitorAiErrorResponse(validated.code, validated.message);
    return NextResponse.json(err.body, { status: err.status });
  }

  const fullRequest = {
    ...validated.value,
    caller: auth.caller,
  };

  const result = await runMonitorAiChat(fullRequest);
  if (!result.ok) {
    const err = monitorAiErrorResponse(result.code);
    return NextResponse.json(err.body, { status: err.status });
  }

  return NextResponse.json(result.body);
}
