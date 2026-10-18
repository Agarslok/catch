import { NextResponse } from "next/server";
import { authorizeMonitorAiChat } from "@/lib/monitor-ai/auth";
import { monitorAiErrorResponse } from "@/lib/monitor-ai/errors";
import {
  runMonitorAiInterpret,
  validateMonitorAiInterpretRequest,
} from "@/lib/monitor-ai/interpret";

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
  if (auth.caller.role !== "moderador") {
    const err = monitorAiErrorResponse(
      "FORBIDDEN",
      "Solo el moderador puede interpretar instrucciones de presentación.",
    );
    return NextResponse.json(err.body, { status: err.status });
  }

  const validated = validateMonitorAiInterpretRequest(meetingId, body, auth.caller.role);
  if (!validated.ok) {
    const err = monitorAiErrorResponse(validated.code, validated.message);
    return NextResponse.json(err.body, { status: err.status });
  }

  const result = await runMonitorAiInterpret(validated.value);
  if (!result.ok) {
    const err = monitorAiErrorResponse(result.code, result.message);
    return NextResponse.json(err.body, { status: err.status });
  }

  return NextResponse.json(result.body);
}
