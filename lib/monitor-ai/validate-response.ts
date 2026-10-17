import { MAX_RESPONSE_MESSAGE_LENGTH } from "./context-policy";
import type { MonitorAiAction, MonitorChartId } from "./types";
import { isMonitorChartId } from "./catalog";
import { resolveMonitorHighlightTarget } from "./highlight-catalog";

export function sanitizeAssistantMessage(raw: string): string {
  const trimmed = raw.trim();
  const noHtml = trimmed.replace(/<[^>]*>/g, "");
  if (noHtml.length > MAX_RESPONSE_MESSAGE_LENGTH) {
    return noHtml.slice(0, MAX_RESPONSE_MESSAGE_LENGTH).trim();
  }
  return noHtml;
}

/** Reservado para fase 2; v1 no expone acciones al cliente. */
export function parseMonitorAiAction(): MonitorAiAction | null {
  return null;
}

export function validateMonitorAiHighlightTarget(target: unknown): boolean {
  if (!target || typeof target !== "object") return false;
  const t = target as Record<string, unknown>;
  const chartId = t.chartId;
  if (typeof chartId !== "string" || !isMonitorChartId(chartId)) return false;
  const hasCategory = typeof t.category === "string" && t.category.trim().length > 0;
  const hasIndex = Number.isInteger(t.index);
  if (!hasCategory && !hasIndex) return false;
  const resolved = resolveMonitorHighlightTarget(chartId as import("./types").MonitorChartId, {
    category: typeof t.category === "string" ? t.category : undefined,
    seriesKey: typeof t.seriesKey === "string" ? t.seriesKey : undefined,
    datasetIndex: Number.isInteger(t.datasetIndex) ? (t.datasetIndex as number) : undefined,
    index: Number.isInteger(t.index) ? (t.index as number) : undefined,
  });
  return resolved !== null;
}

export type MonitorAiActionValidation =
  | { ok: true; action: MonitorAiAction }
  | { ok: false; errors: string[] };

export function validateMonitorAiAction(raw: unknown): MonitorAiActionValidation {
  if (!raw || typeof raw !== "object") {
    return { ok: false, errors: ["action must be an object"] };
  }
  const a = raw as Record<string, unknown>;
  if (a.type !== "highlight") {
    return { ok: false, errors: ["only highlight is supported"] };
  }
  const target = a.target;
  if (!validateMonitorAiHighlightTarget(target)) {
    return { ok: false, errors: ["invalid highlight target"] };
  }
  const t = target as Record<string, unknown>;
  const chartId = t.chartId as MonitorChartId;
  const resolved = resolveMonitorHighlightTarget(chartId, {
    category: typeof t.category === "string" ? t.category : undefined,
    seriesKey: typeof t.seriesKey === "string" ? t.seriesKey : undefined,
    datasetIndex: Number.isInteger(t.datasetIndex) ? (t.datasetIndex as number) : undefined,
    index: Number.isInteger(t.index) ? (t.index as number) : undefined,
  });
  if (!resolved) {
    return { ok: false, errors: ["invalid highlight target"] };
  }
  const reason =
    typeof a.reason === "string" ? a.reason.trim().slice(0, 200) : undefined;
  return {
    ok: true,
    action: {
      type: "highlight",
      target: resolved,
      reason,
    },
  };
}
