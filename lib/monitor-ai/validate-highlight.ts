import { highlightAllowedForView, type MonitorAiViewContext } from "./view-context";
import type { MonitorAiCallerRole, MonitorAiAction, MonitorChartElementRef } from "./types";
import type { MonitorAiHighlightStatus } from "./types";
import {
  parseChartId,
  resolveMonitorHighlightProbeDetailed,
} from "./highlight-catalog";
import type { HighlightResolveError } from "./highlight-elements";
import { validateMonitorAiAction, type MonitorAiActionValidation } from "./validate-response";

const PROPOSE_HIGHLIGHT_KEYS = new Set([
  "chartId",
  "category",
  "seriesKey",
  "datasetIndex",
  "index",
  "reason",
]);

const CLEAR_HIGHLIGHT_KEYS = new Set(["chartId", "category", "reason"]);

export function hasOnlyAllowedHighlightKeys(args: Record<string, unknown>): boolean {
  return Object.keys(args).every((k) => PROPOSE_HIGHLIGHT_KEYS.has(k));
}

export function authorizeHighlightRequest(
  meetingId: string,
  requestMeetingId: string,
  _caller: MonitorAiCallerRole, // reservado: políticas por rol en fases futuras
): { ok: true } | { ok: false; code: "FORBIDDEN" | "INVALID_REQUEST" } {
  void _caller;
  if (!meetingId || !requestMeetingId || meetingId !== requestMeetingId) {
    return { ok: false, code: "FORBIDDEN" };
  }
  return { ok: true };
}

function highlightResolveErrorMessage(reason: HighlightResolveError): string {
  switch (reason) {
    case "no_options":
      return "La gráfica no tiene elementos resaltables en esta visualización.";
    case "ambiguous":
      return "La instrucción es ambigua: hay varias coincidencias. Indique categoría y serie con más precisión.";
    case "not_found":
      return "No se encontró ese elemento en la gráfica indicada.";
    case "invalid_chart":
      return "Gráfica no válida.";
    default:
      return "No se pudo resolver el elemento a resaltar.";
  }
}

export function buildHighlightActionFromProposal(
  args: Record<string, unknown>,
  view?: MonitorAiViewContext,
): MonitorAiActionValidation {
  if (!hasOnlyAllowedHighlightKeys(args)) {
    return { ok: false, errors: ["unexpected highlight fields"] };
  }
  const chartId = parseChartId(args.chartId);
  if (!chartId) {
    return { ok: false, errors: ["invalid chartId"] };
  }
  if (view && !highlightAllowedForView(chartId, view)) {
    return {
      ok: false,
      errors: ["chart not visible on current slide (contexto desactualizado o diapositiva distinta)"],
    };
  }
  const probe = {
    category: typeof args.category === "string" ? args.category.trim() : undefined,
    seriesKey: typeof args.seriesKey === "string" ? args.seriesKey.trim() : undefined,
    datasetIndex: Number.isInteger(args.datasetIndex) ? (args.datasetIndex as number) : undefined,
    index: Number.isInteger(args.index) ? (args.index as number) : undefined,
  };
  if (probe.category === "") delete probe.category;
  if (probe.seriesKey === "") probe.seriesKey = undefined;
  if (probe.category == null && probe.index == null) {
    return { ok: false, errors: ["category or index required"] };
  }

  const resolved = resolveMonitorHighlightProbeDetailed(chartId, probe);
  if (!resolved.ok) {
    return { ok: false, errors: [highlightResolveErrorMessage(resolved.reason)] };
  }

  const reason = typeof args.reason === "string" ? args.reason.trim().slice(0, 200) : undefined;
  return validateMonitorAiAction({
    type: "highlight",
    target: resolved.target,
    reason,
  });
}

export function buildClearActionFromProposal(
  args: Record<string, unknown>,
): MonitorAiActionValidation {
  if (!Object.keys(args).every((k) => CLEAR_HIGHLIGHT_KEYS.has(k))) {
    return { ok: false, errors: ["unexpected clear highlight fields"] };
  }
  const chartId = args.chartId != null ? parseChartId(args.chartId) : undefined;
  if (args.chartId != null && !chartId) {
    return { ok: false, errors: ["invalid chartId"] };
  }
  const category =
    typeof args.category === "string" && args.category.trim()
      ? args.category.trim()
      : undefined;
  const reason = typeof args.reason === "string" ? args.reason.trim().slice(0, 200) : undefined;
  return validateMonitorAiAction({
    type: "clear_highlight",
    target: chartId || category ? { chartId, category } : undefined,
    reason,
  });
}

export function mergeHighlightAction(
  current: MonitorAiAction | null,
  next: MonitorAiAction | null,
): MonitorAiAction | null {
  if (!next) return current;
  if (next.type === "clear_highlight") return next;
  if (current?.type === "clear_highlight") return current;
  if (current) return current;
  return next;
}

export function finalizeHighlightForResponse(
  action: MonitorAiAction | null,
  view: MonitorAiViewContext | undefined,
): { action: MonitorAiAction | null; status: MonitorAiHighlightStatus } {
  if (!action) {
    return { action: null, status: null };
  }
  if (action.type === "clear_highlight") {
    return { action, status: null };
  }
  if (action.type !== "highlight") {
    return { action: null, status: null };
  }
  const chartId = action.target.chartId;
  if (!highlightAllowedForView(chartId, view)) {
    return { action: null, status: "not_visible" };
  }
  return { action, status: null };
}

export function toMonitorHighlightRef(target: MonitorChartElementRef): Record<string, unknown> {
  return {
    chartId: target.chartId,
    category: target.category,
    seriesKey: target.seriesKey ?? "",
    ...(target.datasetIndex !== undefined ? { datasetIndex: target.datasetIndex } : {}),
    ...(target.index !== undefined ? { index: target.index } : {}),
  };
}
