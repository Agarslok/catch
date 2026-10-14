import type { EChartsOption } from "echarts";
import { mergeChartOption } from "./options";
import { CHART_TOKENS, paletteColor } from "./tokens";

/**
 * Presets para tipos de gráfica aún no usados en la app.
 * La IA o nuevas pantallas pueden componer sobre estos esquemas.
 */

export function groupedBarPreset(
  reducedMotion: boolean,
  categories: string[],
  series: { name: string; values: number[] }[],
): EChartsOption {
  return mergeChartOption(reducedMotion, {
    tooltip: { trigger: "axis" },
    legend: { bottom: 0, textStyle: { color: CHART_TOKENS.meta } },
    grid: { left: 48, right: 16, top: 32, bottom: 56 },
    xAxis: { type: "category", data: categories },
    yAxis: { type: "value", splitLine: { lineStyle: { color: CHART_TOKENS.line } } },
    series: series.map((s, i) => ({
      type: "bar",
      name: s.name,
      emphasis: { focus: "series" },
      itemStyle: { color: paletteColor(i) },
      data: s.values,
    })),
  });
}

export function heatmapPreset(
  reducedMotion: boolean,
  xLabels: string[],
  yLabels: string[],
  data: [number, number, number][],
): EChartsOption {
  return mergeChartOption(reducedMotion, {
    tooltip: { position: "top" },
    grid: { left: 80, right: 24, top: 24, bottom: 48 },
    xAxis: { type: "category", data: xLabels, splitArea: { show: true } },
    yAxis: { type: "category", data: yLabels, splitArea: { show: true } },
    visualMap: {
      min: 0,
      max: Math.max(...data.map((d) => d[2]), 1),
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      inRange: { color: [CHART_TOKENS.soft, CHART_TOKENS.primary, CHART_TOKENS.benchmark] },
      textStyle: { color: CHART_TOKENS.meta },
    },
    series: [{ type: "heatmap", data, emphasis: { itemStyle: { shadowBlur: 6 } } }],
  });
}

export function scatterPreset(
  reducedMotion: boolean,
  points: { name?: string; x: number; y: number; size?: number }[],
): EChartsOption {
  return mergeChartOption(reducedMotion, {
    tooltip: { trigger: "item" },
    xAxis: { type: "value", splitLine: { lineStyle: { color: CHART_TOKENS.line } } },
    yAxis: { type: "value", splitLine: { lineStyle: { color: CHART_TOKENS.line } } },
    series: [
      {
        type: "scatter",
        symbolSize: (val: number[]) => Math.sqrt(val[2] ?? 1) * 4,
        data: points.map((p) => [p.x, p.y, p.size ?? 8, p.name ?? ""]),
        itemStyle: { color: CHART_TOKENS.primary, opacity: 0.85 },
        emphasis: { focus: "self", itemStyle: { color: CHART_TOKENS.secondary } },
      },
    ],
  });
}
