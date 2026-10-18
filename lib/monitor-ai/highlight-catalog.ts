import { getDemoClientId } from "@/lib/monitor-data/dataset";
import { MONITOR_CHART_IDS } from "./catalog";
import { chartUiLabel } from "./chart-metadata";
import {
  enumerateHighlightElements,
  highlightOptionsForChart,
  resolveMonitorHighlightProbe,
  type HighlightProbe,
} from "./highlight-elements";
import type { MonitorChartElementRef, MonitorChartId } from "./types";

export type { HighlightProbe } from "./highlight-elements";

export function resolveMonitorHighlightTarget(
  chartId: MonitorChartId,
  probe: HighlightProbe,
): MonitorChartElementRef | null {
  const r = resolveMonitorHighlightProbe(chartId, probe);
  return r.ok ? r.target : null;
}

export function resolveMonitorHighlightProbeDetailed(
  chartId: MonitorChartId,
  probe: HighlightProbe,
) {
  return resolveMonitorHighlightProbe(chartId, probe);
}

export function parseChartId(value: unknown): MonitorChartId | null {
  if (typeof value !== "string") return null;
  return (MONITOR_CHART_IDS as readonly string[]).includes(value)
    ? (value as MonitorChartId)
    : null;
}

export function demoClientRotcompHighlight(): MonitorChartElementRef | null {
  return resolveMonitorHighlightTarget("rotcomp", { category: getDemoClientId() });
}

export function highlightHintsForCharts(chartIds: MonitorChartId[]): string {
  return chartIds
    .map((id) => {
      const opts = highlightOptionsForChart(id, 8);
      const label = chartUiLabel(id);
      return opts.length ? `${label}[${opts.join("; ")}]` : `${label}[sin elementos resaltables]`;
    })
    .join(" ");
}

export function chartHasHighlightCatalog(chartId: MonitorChartId): boolean {
  return enumerateHighlightElements(chartId).length > 0;
}

export function listHighlightElementsForCharts(chartIds: MonitorChartId[]) {
  const byChart: Record<string, MonitorChartElementRef[]> = {};
  chartIds.forEach((id) => {
    byChart[id] = enumerateHighlightElements(id);
  });
  return byChart;
}

export { enumerateHighlightElements } from "./highlight-elements";
