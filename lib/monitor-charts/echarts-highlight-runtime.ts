import type { ECharts } from "echarts";
import { labelsMatch } from "./chart-highlight-visual";

export type EChartsHighlightTarget = {
  category: string;
  seriesIndex?: number;
};

/**
 * Resalta una categoría en ECharts sin mutar option.data (downplay + highlight).
 * Compatible con barras, pie y series con `name` en cada dato.
 */
export function applyEChartsCategoryHighlight(
  chart: ECharts,
  target: EChartsHighlightTarget,
): { applied: boolean; reason?: string } {
  const raw = chart.getOption();
  const seriesList = raw.series;
  if (!Array.isArray(seriesList) || !seriesList.length) {
    return { applied: false, reason: "no_series" };
  }
  const seriesIndex = target.seriesIndex ?? 0;
  const series = seriesList[seriesIndex] as { data?: unknown[] } | undefined;
  if (!series?.data?.length) {
    return { applied: false, reason: "empty_series" };
  }

  let found = false;
  for (const item of series.data) {
    const name =
      typeof item === "object" && item != null && "name" in item
        ? String((item as { name?: string }).name ?? "")
        : "";
    if (labelsMatch(name, target.category)) {
      found = true;
      break;
    }
  }
  if (!found) return { applied: false, reason: "category_not_in_series" };

  chart.dispatchAction({ type: "downplay", seriesIndex });
  chart.dispatchAction({
    type: "highlight",
    seriesIndex,
    name: target.category,
  });
  return { applied: true };
}

export function clearEChartsHighlight(chart: ECharts, seriesIndex = 0): void {
  chart.dispatchAction({ type: "downplay", seriesIndex });
}
