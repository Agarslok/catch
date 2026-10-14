import { validateChartAction } from "./actions";
import {
  buildDatasetSnapshot,
  datasetContextForModel,
  getDatasetEntry,
  resolveDatasetKeyFromChartFocus,
} from "./datasets";
import { getCatalogEntry } from "./catalog";
import { getRegistryEntryByVisualizationId } from "./registry";
import {
  inferIntentForDataset,
  recommendVisualization,
} from "./select";
import type {
  ChatStructuredResponse,
  ChartAction,
  VisualizationId,
} from "./types";

export type ChatRequestContext = {
  question: string;
  chartFocus?: string;
  datasetKey?: string;
  /** Respuesta textual demo o del LLM (opcional) */
  messageOverride?: string;
};

const DEMO_DEPT_TOP = { department: "Comercial", turnover_pct: 5.8 };

function pickDatasetKey(ctx: ChatRequestContext): string {
  if (ctx.datasetKey && getDatasetEntry(ctx.datasetKey)) return ctx.datasetKey;

  const fromFocus = resolveDatasetKeyFromChartFocus(ctx.chartFocus);
  if (fromFocus) return fromFocus;

  const q = ctx.question.toLowerCase();
  if (q.includes("departamento") || q.includes("rotación") || q.includes("rotacion")) {
    return "demo.departments_turnover";
  }

  return fromFocus ?? "guanajuato.turnover_bimonthly";
}

function buildDefaultMessage(
  question: string,
  visualizationId: VisualizationId,
  datasetKey: string,
): string {
  const catalog = getCatalogEntry(visualizationId);
  const dataset = getDatasetEntry(datasetKey);
  const q = question.toLowerCase();

  if (datasetKey === "demo.departments_turnover" && q.includes("departamento")) {
    return `Para comparar departamentos conviene ${catalog.name}. En la serie demo, ${DEMO_DEPT_TOP.department} registra la mayor rotación (${DEMO_DEPT_TOP.turnover_pct}%).`;
  }

  if (datasetKey === "guanajuato.turnover_municipality") {
    return `Recomiendo ${catalog.name} sobre «${dataset?.label ?? datasetKey}» para comparar municipios con los datos disponibles.`;
  }

  if (datasetKey === "guanajuato.turnover_bimonthly") {
    return `Para tu pregunta sobre «${dataset?.label ?? datasetKey}», ${catalog.name} muestra la evolución bimestral sin inventar periodos adicionales.`;
  }

  return `Visualización sugerida: ${catalog.name} (${dataset?.label ?? datasetKey}).`;
}

function suggestAction(
  visualizationId: VisualizationId,
  datasetKey: string,
  question: string,
): ChartAction | undefined {
  const q = question.toLowerCase();
  if (datasetKey === "demo.departments_turnover" && q.includes("departamento")) {
    const validated = validateChartAction({
      type: "highlight",
      scope: "local",
      category: DEMO_DEPT_TOP.department,
    });
    return validated.ok ? validated.action : undefined;
  }

  if (
    visualizationId === "bar_horizontal" &&
    datasetKey === "guanajuato.turnover_municipality"
  ) {
    return undefined;
  }

  const show = validateChartAction({
    type: "show_chart",
    scope: "local",
    visualizationId,
    datasetKey,
  });
  if (show.ok && getRegistryEntryByVisualizationId(visualizationId).implementationStatus !== "planned") {
    return show.action;
  }

  return undefined;
}

export function buildStructuredChatResponse(
  ctx: ChatRequestContext,
): ChatStructuredResponse & {
  datasetContext: Record<string, unknown> | null;
  componentKey: string;
  implementationStatus: string;
  legacy: {
    interpreter: string;
    hasChartAction: boolean;
    hasMeetingEvent: boolean;
  };
} {
  const datasetKey = pickDatasetKey(ctx);
  const snapshot = buildDatasetSnapshot(datasetKey);
  if (!snapshot) {
    const fallbackViz: VisualizationId = "column";
    return {
      message: "No hay un conjunto de datos registrado para esta consulta.",
      visualization: fallbackViz,
      datasetKey,
      explanation: "Dataset no registrado.",
      datasetContext: null,
      componentKey: getCatalogEntry(fallbackViz).componentKey,
      implementationStatus: getCatalogEntry(fallbackViz).implementationStatus,
      legacy: {
        interpreter: "deterministic",
        hasChartAction: false,
        hasMeetingEvent: false,
      },
    };
  }

  const intent = inferIntentForDataset(ctx.question, snapshot);
  const recommendation = recommendVisualization({
    intent,
    dataset: snapshot,
    preferImplemented: true,
  });

  const registry = getRegistryEntryByVisualizationId(recommendation.visualizationId);
  const action = suggestAction(
    recommendation.visualizationId,
    datasetKey,
    ctx.question,
  );

  const message =
    ctx.messageOverride ??
    buildDefaultMessage(ctx.question, recommendation.visualizationId, datasetKey);

  return {
    message,
    visualization: recommendation.visualizationId,
    datasetKey,
    action,
    explanation: recommendation.explanation,
    datasetContext: datasetContextForModel(datasetKey),
    componentKey: registry.componentKey,
    implementationStatus: registry.implementationStatus,
    legacy: {
      interpreter: "deterministic",
      hasChartAction: Boolean(action),
      hasMeetingEvent: datasetKey === "demo.departments_turnover",
    },
  };
}
