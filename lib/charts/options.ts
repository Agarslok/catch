import type { EChartsOption } from "echarts";
import { chartAnimationOption } from "./motion";
import { CHART_SERIES_PALETTE, CHART_TOKENS } from "./tokens";
import type { ChartInteractionState } from "./types";
import { axisTooltipFormatter, itemTooltipFormatter } from "./tooltip";

export type BarItemStyleInput = {
  interaction: ChartInteractionState;
  /** Color base cuando interaction es default */
  fill?: string;
};

const BAR_RADIUS_TOP: [number, number, number, number] = [8, 8, 0, 0];
const BAR_RADIUS_END: [number, number, number, number] = [0, 6, 6, 0];

export function barItemStyle(input: BarItemStyleInput): {
  color: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius: [number, number, number, number];
  opacity?: number;
} {
  const base = input.fill ?? CHART_TOKENS.neutral;
  switch (input.interaction) {
    case "selected":
      return {
        color: CHART_TOKENS.primary,
        borderColor: CHART_TOKENS.selected,
        borderWidth: 2,
        borderRadius: BAR_RADIUS_TOP,
      };
    case "highlighted":
      return {
        color: CHART_TOKENS.primary,
        borderRadius: BAR_RADIUS_TOP,
      };
    case "muted":
      return {
        color: CHART_TOKENS.muted,
        opacity: 0.55,
        borderRadius: BAR_RADIUS_TOP,
      };
    case "hover":
      return {
        color: CHART_TOKENS.secondary,
        borderRadius: BAR_RADIUS_TOP,
      };
    default:
      return {
        color: base,
        borderRadius: BAR_RADIUS_TOP,
      };
  }
}

export function horizontalBarItemStyle(
  input: BarItemStyleInput,
): ReturnType<typeof barItemStyle> {
  const style = barItemStyle(input);
  return { ...style, borderRadius: BAR_RADIUS_END };
}

export function mergeChartOption(
  reducedMotion: boolean,
  partial: EChartsOption,
): EChartsOption {
  return {
    ...chartBaseOption(reducedMotion),
    ...partial,
    tooltip: {
      ...chartBaseOption(reducedMotion).tooltip,
      ...(partial.tooltip ?? {}),
    },
  };
}

export function chartBaseOption(reducedMotion: boolean): EChartsOption {
  return {
    ...chartAnimationOption(reducedMotion),
    color: [...CHART_SERIES_PALETTE],
    textStyle: {
      fontFamily: "Nunito Sans, Helvetica Neue, system-ui, sans-serif",
      color: CHART_TOKENS.ink,
    },
    tooltip: {
      confine: true,
      borderWidth: 1,
      borderColor: CHART_TOKENS.line,
      backgroundColor: CHART_TOKENS.white,
      textStyle: { color: CHART_TOKENS.ink, fontSize: 13 },
      extraCssText: "box-shadow: 0 4px 14px rgba(35,34,34,0.08); border-radius: 8px;",
    },
    axisPointer: {
      type: "shadow",
      shadowStyle: { color: "rgba(39, 120, 177, 0.08)" },
    },
  };
}

export function cartesianGrid(overrides?: EChartsOption["grid"]): EChartsOption["grid"] {
  return {
    left: 40,
    right: 16,
    top: 24,
    bottom: 48,
    containLabel: false,
    ...overrides,
  };
}

export function valueAxisPercent(max?: number): EChartsOption["yAxis"] {
  return {
    type: "value",
    max,
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { lineStyle: { color: CHART_TOKENS.line, type: "dashed" } },
    axisLabel: { color: CHART_TOKENS.meta, formatter: "{value}%" },
  };
}

export function categoryAxis(
  data: string[],
  overrides?: Record<string, unknown>,
): EChartsOption["xAxis"] {
  return {
    type: "category",
    data,
    axisLine: { lineStyle: { color: CHART_TOKENS.line } },
    axisTick: { show: false },
    axisLabel: { color: CHART_TOKENS.meta, interval: 0, rotate: data.length > 6 ? 24 : 0 },
    ...overrides,
  };
}

export function axisPercentTooltip(period?: string): EChartsOption["tooltip"] {
  return {
    trigger: "axis",
    formatter: axisTooltipFormatter("%", period),
  };
}

export function itemPercentTooltip(period?: string): EChartsOption["tooltip"] {
  return {
    trigger: "item",
    formatter: itemTooltipFormatter("%", period),
  };
}

export function pieEmphasis(): { scale: boolean; scaleSize: number } {
  return { scale: true, scaleSize: 6 };
}

export function pieSeriesBase(opts: {
    radius: string | [string, string];
    data: { name: string; value: number; itemStyle?: { color: string } }[];
    labelFormatter?: string;
    donut?: boolean;
  },
): EChartsOption {
  return {
    tooltip: itemPercentTooltip(),
    legend: {
      type: "scroll",
      bottom: 0,
      textStyle: { color: CHART_TOKENS.meta },
      pageIconColor: CHART_TOKENS.primary,
      pageTextStyle: { color: CHART_TOKENS.meta },
    },
    series: [
      {
        type: "pie",
        radius: opts.radius,
        avoidLabelOverlap: true,
        minAngle: opts.donut ? 4 : 2,
        itemStyle: {
          borderColor: CHART_TOKENS.white,
          borderWidth: 2,
        },
        label: {
          color: CHART_TOKENS.ink,
          formatter: opts.labelFormatter ?? "{b}",
        },
        emphasis: {
          ...pieEmphasis(),
          itemStyle: {
            shadowBlur: 8,
            shadowColor: "rgba(27, 79, 122, 0.15)",
          },
        },
        animationType: "scale",
        animationEasing: "cubicOut",
        data: opts.data,
      },
    ],
  };
}

/** Líneas — continuidad temporal (futuras series temporales). */
export function lineSeriesOption(
  reducedMotion: boolean,
  partial: EChartsOption,
): EChartsOption {
  return mergeChartOption(reducedMotion, {
    ...partial,
    series: (partial.series as EChartsOption["series"]) ?? [
      {
        type: "line",
        smooth: 0.25,
        symbol: "circle",
        symbolSize: 6,
        lineStyle: { width: 2, color: CHART_TOKENS.primary },
        itemStyle: { color: CHART_TOKENS.primary, borderColor: CHART_TOKENS.white, borderWidth: 2 },
        emphasis: {
          focus: "series",
          lineStyle: { width: 3 },
          itemStyle: { color: CHART_TOKENS.secondary },
        },
      },
    ],
  });
}

export function statusOverlayGraphic(
  status: "loading" | "empty" | "error",
): EChartsOption["graphic"] {
  const text =
    status === "loading"
      ? "Cargando…"
      : status === "empty"
        ? "Sin datos para mostrar"
        : "No se pudo cargar la gráfica";
  return [
    {
      type: "text",
      left: "center",
      top: "middle",
      style: {
        text,
        fill: CHART_TOKENS.meta,
        fontSize: 14,
        fontWeight: 500,
      },
    },
  ];
}
