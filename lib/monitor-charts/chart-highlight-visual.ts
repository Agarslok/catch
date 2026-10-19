import type { MonitorChartElementRef } from "@/lib/monitor-ai/types";
import type { ChartInteractionState } from "@/lib/charts/types";

export type PresentationHighlightRef = {
  chartId: string;
  category?: string;
  seriesKey?: string;
  datasetIndex?: number;
  index?: number;
};

export function normHighlightLabel(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Clave estable para deduplicar eventos Realtime / BroadcastChannel. */
export function highlightRefKey(ref: PresentationHighlightRef | null | undefined): string {
  if (!ref || !ref.chartId) return "";
  return [
    ref.chartId,
    ref.datasetIndex ?? "",
    ref.index ?? "",
    ref.seriesKey ?? "",
    ref.category ?? "",
  ].join("|");
}

export function labelsMatch(a: string | undefined, b: string | undefined): boolean {
  if (a == null || b == null) return false;
  return normHighlightLabel(a) === normHighlightLabel(b);
}

export function elementMatchesHighlight(
  highlight: PresentationHighlightRef | null | undefined,
  chartId: string,
  datasetIndex: number,
  index: number,
  category: string,
  seriesKey = "",
): boolean {
  if (!highlight || highlight.chartId !== chartId) return false;
  if (
    typeof highlight.datasetIndex === "number" &&
    typeof highlight.index === "number"
  ) {
    return highlight.datasetIndex === datasetIndex && highlight.index === index;
  }
  if (highlight.seriesKey && seriesKey && !labelsMatch(highlight.seriesKey, seriesKey)) {
    return false;
  }
  if (highlight.category != null && highlight.category !== "") {
    return labelsMatch(highlight.category, category);
  }
  return false;
}

/** Limpia resaltado al salir de la diapositiva que contiene la gráfica. */
export function shouldClearHighlightOnStepChange(
  visibleChartIds: string[],
  highlight: PresentationHighlightRef | null | undefined,
): boolean {
  if (!highlight?.chartId) return false;
  return !visibleChartIds.includes(highlight.chartId);
}

export function interactionStateForPresentation(
  category: string,
  presentationHighlight: PresentationHighlightRef | null | undefined,
  userSelectedCategory: string | null,
): ChartInteractionState {
  if (userSelectedCategory && labelsMatch(userSelectedCategory, category)) {
    return "selected";
  }
  if (
    presentationHighlight?.category &&
    labelsMatch(presentationHighlight.category, category)
  ) {
    return "highlighted";
  }
  if (userSelectedCategory && !labelsMatch(userSelectedCategory, category)) {
    return "muted";
  }
  if (
    presentationHighlight?.category &&
    !labelsMatch(presentationHighlight.category, category)
  ) {
    return "muted";
  }
  return "default";
}

export function toPresentationHighlightRef(
  target: MonitorChartElementRef,
): PresentationHighlightRef {
  return {
    chartId: target.chartId,
    category: target.category,
    seriesKey: target.seriesKey,
    datasetIndex: target.datasetIndex,
    index: target.index,
  };
}
