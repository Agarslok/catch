import { CHART_SERIES_PALETTE, CHART_TOKENS } from "./tokens";

const THEME_NAME = "catch-live";

let registered = false;
let registerPromise: Promise<void> | null = null;

/** Solo en el navegador; evita cargar ECharts en SSR. */
export function registerCatchChartTheme(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  if (registered) {
    return Promise.resolve();
  }
  if (!registerPromise) {
    registerPromise = import("echarts").then((echartsMod) => {
      echartsMod.registerTheme(THEME_NAME, {
        color: [...CHART_SERIES_PALETTE],
        backgroundColor: "transparent",
        textStyle: {
          fontFamily: "Nunito Sans, Helvetica Neue, system-ui, sans-serif",
          color: CHART_TOKENS.ink,
        },
        title: {
          textStyle: { color: CHART_TOKENS.ink, fontWeight: 600 },
          subtextStyle: { color: CHART_TOKENS.meta },
        },
        line: {
          itemStyle: { borderWidth: 2 },
          lineStyle: { width: 2 },
          symbolSize: 6,
          symbol: "circle",
          smooth: 0.25,
        },
        bar: {
          itemStyle: { barBorderRadius: [6, 6, 0, 0] },
          emphasis: { focus: "self" },
        },
        pie: {
          itemStyle: { borderColor: CHART_TOKENS.white, borderWidth: 2 },
        },
        categoryAxis: {
          axisLine: { lineStyle: { color: CHART_TOKENS.line } },
          axisTick: { show: false },
          axisLabel: { color: CHART_TOKENS.meta },
          splitLine: { show: false },
        },
        valueAxis: {
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: CHART_TOKENS.meta },
          splitLine: { lineStyle: { color: CHART_TOKENS.line, type: "dashed" } },
        },
      });
      registered = true;
    });
  }
  return registerPromise;
}

export const CATCH_ECHARTS_THEME = THEME_NAME;
