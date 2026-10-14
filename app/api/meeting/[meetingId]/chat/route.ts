import { NextResponse } from "next/server";
import { buildStructuredChatResponse } from "@/lib/visualization/chat";

type Body = {
  text?: string;
  chartFocus?: string;
  actorId?: string;
  actorName?: string;
  datasetKey?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ meetingId: string }> },
) {
  const { meetingId } = await context.params;
  const body = (await request.json()) as Body;
  const text = (body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }

  const structured = buildStructuredChatResponse({
    question: text,
    chartFocus: body.chartFocus,
    datasetKey: body.datasetKey,
  });

  return NextResponse.json({
    meetingId,
    question: text,
    answer: structured.message,
    message: structured.message,
    visualization: structured.visualization,
    datasetKey: structured.datasetKey,
    action: structured.action ?? null,
    explanation: structured.explanation,
    componentKey: structured.componentKey,
    implementationStatus: structured.implementationStatus,
    datasetContext: structured.datasetContext,
    interpreter: structured.legacy.interpreter,
    hasChartAction: structured.legacy.hasChartAction,
    hasMeetingEvent: structured.legacy.hasMeetingEvent,
    actorId: body.actorId ?? "visitor",
    actorName: body.actorName ?? "Visitante",
  });
}
