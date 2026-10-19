import type { InteractionEventType } from "./types";

/** Mapeo de toques del monitor HTML a tipos de analítica. `justificacion` no es un clic. */
export function monitorTouchEventType(tipo: string): InteractionEventType {
  if (tipo === "ia") return "question.asked";
  if (tipo === "grafico") return "element.clicked";
  if (tipo === "filtro") return "filter.changed";
  if (tipo === "seccion") return "presentation.section_selected";
  if (tipo === "explorar") return "explore.started";
  if (tipo === "vista") return "chart_type.changed";
  return "detail.opened";
}

export function chartElementClickFields(input: {
  chartId: string;
  category: string;
  chartTitle?: string;
  sectionIndex?: number | null;
  sectionName?: string | null;
}) {
  const chartId = String(input.chartId || "").trim();
  const category = String(input.category || "").trim();
  return {
    event_type: "element.clicked" as const,
    chart_id: chartId,
    element_id: category || chartId,
    element_label: category || input.chartTitle || chartId,
    metadata: {
      category: category || null,
      chart_title: input.chartTitle ?? null,
      section_name: input.sectionName ?? null,
      section_index: input.sectionIndex ?? null,
    },
  };
}

export function totalElementClicks(eventTypes: string[]): number {
  return eventTypes.filter((t) => t === "element.clicked").length;
}
