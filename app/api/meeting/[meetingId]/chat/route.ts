import { NextResponse } from "next/server";

type Body = {
  text?: string;
  chartFocus?: string;
  actorId?: string;
  actorName?: string;
};

const DEMO_DEPT = [
  ["Comercial", 5.8],
  ["Operaciones", 4.2],
  ["Administración", 3.1],
] as const;

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

  const lower = text.toLowerCase();
  let reply: string;
  let hasMeetingEvent = false;

  if (lower.includes("rotación") || lower.includes("rotacion") || lower.includes("departamento")) {
    reply = `Tu gráfica actual es «${body.chartFocus ?? "turnover"}»; Comercial presenta la mayor tasa de rotación con 5.8% (serie demo por departamento).`;
    hasMeetingEvent = true;
  } else {
    reply = `Puedo ayudarte con rotación, ausentismo o desglose por departamento. Tu gráfica enfocada ahora es «${body.chartFocus ?? "general"}» (demo). Prueba: «¿Qué departamento tiene mayor rotación?»`;
  }

  return NextResponse.json({
    meetingId,
    question: text,
    answer: reply,
    interpreter: "demo",
    hasChartAction: false,
    hasMeetingEvent,
    demoDepartments: DEMO_DEPT,
    actorId: body.actorId ?? "visitor",
    actorName: body.actorName ?? "Visitante",
  });
}
