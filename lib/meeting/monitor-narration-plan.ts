import { MONITOR_CHART_UI } from "@/lib/monitor-ai/chart-metadata";
import {
  enumerateHighlightElements,
  resolveMonitorHighlightProbe,
} from "@/lib/monitor-ai/highlight-elements";
import type { MonitorChartElementRef, MonitorChartId } from "@/lib/monitor-ai/types";
import { getChartSpeakParagraph } from "@/lib/monitor-data/chart-speak-text";
import {
  buildNarrationCueSegments,
  type NarrationCueSegment,
} from "./monitor-narration-cues";
import { getDemoClientId } from "@/lib/monitor-data/dataset";
import {
  buildMonitorPasos,
  chartIdsForSection,
  type MonitorPaso,
  type MonitorPasoTipo,
} from "./monitor-pasos";

export type MonitorNarrationHighlightInput = {
  chartId: MonitorChartId;
  category?: string;
  seriesKey?: string;
  datasetIndex?: number;
  index?: number;
};

export type MonitorNarrationPlan = {
  stepIndex: number;
  stepKind: MonitorPasoTipo;
  speakText: string | null;
  highlightRef: MonitorChartElementRef | null;
  /** Contexto primero; el highlight vive en un segmento posterior. */
  segments: NarrationCueSegment[];
  blockAdvance: boolean;
};

/** Equivalente a textoNarracion(p) en monitor-en-vivo-catch.html (barra / avatar). */
export function monitorBarNarrationText(paso: MonitorPaso): string | null {
  switch (paso.tipo) {
    case "inicio":
      return "Hola, soy el avatar de Catch. Le acompaño durante la presentación.";
    case "explica": {
      const ui = MONITOR_CHART_UI[paso.chartId];
      return `${ui.title}: ${ui.subtitle.toLowerCase()}. Toque cualquier dato para ver de dónde sale.`;
    }
    case "hoja":
      return "Hoja completa: gráficos en tamaño resumido. «Ver más detalles» abre la explicación de cada uno. Confirme si esta sección quedó clara.";
    case "cierre":
      return "Gracias. Aquí están las respuestas a las preguntas de la sala.";
    default:
      return null;
  }
}

function speakTextForPaso(paso: MonitorPaso): string | null {
  if (paso.tipo === "explica") {
    const body = getChartSpeakParagraph(paso.chartId);
    if (body) return body;
  }
  return monitorBarNarrationText(paso);
}

/** Resaltado por defecto del punto explica: empresa demo si existe en la gráfica, si no el primer elemento real. */
export function defaultHighlightInputForPaso(
  paso: MonitorPaso,
): MonitorNarrationHighlightInput | undefined {
  if (paso.tipo !== "explica") return undefined;
  const els = enumerateHighlightElements(paso.chartId);
  if (!els.length) return undefined;
  const demo = getDemoClientId();
  const pick = els.find((e) => e.category === demo) ?? els[0];
  return {
    chartId: pick.chartId,
    category: pick.category,
    seriesKey: pick.seriesKey,
    datasetIndex: pick.datasetIndex,
    index: pick.index,
  };
}

function resolveHighlightForPaso(
  paso: MonitorPaso,
  input?: MonitorNarrationHighlightInput,
): MonitorChartElementRef | null {
  const resolvedInput = input ?? defaultHighlightInputForPaso(paso);
  if (!resolvedInput?.chartId) return null;
  if (paso.tipo === "explica") {
    if (resolvedInput.chartId !== paso.chartId) return null;
  } else if (paso.tipo === "hoja") {
    if (!chartIdsForSection(paso.sectionIndex).includes(resolvedInput.chartId)) return null;
  } else {
    return null;
  }

  const probe = {
    category: resolvedInput.category,
    seriesKey: resolvedInput.seriesKey,
    datasetIndex: resolvedInput.datasetIndex,
    index: resolvedInput.index,
  };
  const resolved = resolveMonitorHighlightProbe(resolvedInput.chartId, probe);
  return resolved.ok ? resolved.target : null;
}

const EMPTY_PLAN: MonitorNarrationPlan = {
  stepIndex: -1,
  stepKind: "inicio",
  speakText: null,
  highlightRef: null,
  segments: [],
  blockAdvance: false,
};

/**
 * Plan de narración para un índice de PASOS (sin efectos secundarios).
 * No publica estado, no llama a IA ni al DOM.
 */
export function planMonitorNarration(
  stepIndex: number,
  options?: { highlight?: MonitorNarrationHighlightInput },
): MonitorNarrationPlan {
  const pasos = buildMonitorPasos();
  if (stepIndex < 0 || stepIndex >= pasos.length) {
    return { ...EMPTY_PLAN, stepIndex };
  }
  const paso = pasos[stepIndex];
  const speakText = speakTextForPaso(paso);
  const highlightRef = resolveHighlightForPaso(paso, options?.highlight);
  return {
    stepIndex,
    stepKind: paso.tipo,
    speakText,
    highlightRef,
    segments: buildNarrationCueSegments(speakText, highlightRef ? [highlightRef] : []),
    blockAdvance: paso.tipo === "hoja",
  };
}

/** Snapshot para el shell del monitor: un plan por índice, sin efectos secundarios. */
export function snapshotMonitorNarrationPlans(): MonitorNarrationPlan[] {
  return buildMonitorPasos().map((_, i) => planMonitorNarration(i));
}
