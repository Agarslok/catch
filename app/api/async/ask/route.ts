import { NextResponse } from "next/server";
import { runAsyncReportAsk } from "@/lib/async/ask";
import { monitorAiErrorResponse } from "@/lib/monitor-ai/errors";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const err = monitorAiErrorResponse("INVALID_REQUEST", "JSON inválido.");
    return NextResponse.json(err.body, { status: err.status });
  }
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const result = await runAsyncReportAsk({
    question: typeof raw.question === "string" ? raw.question : "",
    chartFocus: typeof raw.chartFocus === "string" ? raw.chartFocus : undefined,
    pointTitle: typeof raw.pointTitle === "string" ? raw.pointTitle : undefined,
    narrative: typeof raw.narrative === "string" ? raw.narrative : undefined,
  });
  if (!result.ok) {
    const err = monitorAiErrorResponse(result.code, result.message);
    return NextResponse.json(err.body, { status: err.status });
  }
  return NextResponse.json({
    answer: result.answer,
    interpreter: result.interpreter,
  });
}
