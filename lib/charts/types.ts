/** Roles semánticos de color (el significado depende de la métrica en cada gráfica). */
export type ChartColorRole =
  | "primary"
  | "secondary"
  | "neutral"
  | "positive"
  | "negative"
  | "warning"
  | "meta"
  | "benchmark"
  | "selected"
  | "highlight"
  | "muted";

/** Tono de métrica para elegir semántica cuando aplique; si no, usar neutros. */
export type ChartMetricTone = "neutral" | "turnover" | "hiring" | "tenure";

export type ChartInteractionState =
  | "default"
  | "hover"
  | "selected"
  | "highlighted"
  | "muted";

export type ChartPanelStatus = "ready" | "loading" | "empty" | "error";

export type AxisTooltipParams = {
  category: string;
  value: number;
  unit?: string;
  period?: string;
  comparisonLabel?: string;
  comparisonValue?: number;
};

export type ItemTooltipParams = {
  name: string;
  value: number;
  unit?: string;
  sharePercent?: number;
  period?: string;
};
