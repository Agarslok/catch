import { highlightAllowedForView, type MonitorAiViewContext } from "./view-context";
import type { MonitorAiCallerRole, MonitorAiAction, MonitorChartElementRef } from "./types";
import type { MonitorAiHighlightStatus } from "./types";
import { resolveMonitorHighlightTarget, parseChartId } from "./highlight-catalog";
import { validateMonitorAiAction, type MonitorAiActionValidation } from "./validate-response";

const PROPOSE_HIGHLIGHT_KEYS = new Set([
  "chartId",
  "category",
  "seriesKey",
  "datasetIndex",
  "index",
  "reason",
]);

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

export function buildHighlightActionFromProposal(
  args: Record<string, unknown>,
): MonitorAiActionValidation {
  if (!hasOnlyAllowedHighlightKeys(args)) {
    return { ok: false, errors: ["unexpected highlight fields"] };
  }
  const chartId = parseChartId(args.chartId);
  if (!chartId) {
    return { ok: false, errors: ["invalid chartId"] };
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

  const target = resolveMonitorHighlightTarget(chartId, probe);
  if (!target) {
    return { ok: false, errors: ["element not found in chart"] };
  }

  const reason = typeof args.reason === "string" ? args.reason.trim().slice(0, 200) : undefined;
  return validateMonitorAiAction({
    type: "highlight",
    target,
    reason,
  });
}

export function mergeHighlightAction(
  current: MonitorAiAction | null,
  next: MonitorAiAction | null,
): MonitorAiAction | null {
  if (!next) return current;
  if (current) return current;
  return next;
}

export function finalizeHighlightForResponse(
  action: MonitorAiAction | null,
  view: MonitorAiViewContext | undefined,
): { action: MonitorAiAction | null; status: MonitorAiHighlightStatus } {
  if (!action || action.type !== "highlight") {
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
