export type DataPoint = {
  id: string;
  label: string;
  value: number;
  unit: string;
};

export type InsightMode =
  | "time_series_rate"
  | "category_rate"
  | "composition_percent"
  | "composition_parts";

export type PointMetrics = {
  label: string;
  value: number;
  unit: string;
  /** Participación cuando el modo lo permite (suma conocida). */
  sharePercent?: number;
  shareDenominatorLabel?: string;
  previousLabel?: string;
  previousValue?: number;
  deltaAbsolute?: number;
  deltaPercent?: number;
  vsAverageDelta?: number;
  averageValue?: number;
  rank?: number;
  rankTotal?: number;
};

export type PointNarrative = {
  tooltipLine: string;
  tooltipHint: string;
  detailTitle: string;
  metrics: PointMetrics;
  bullets: string[];
  conclusion: string;
  sourceNote: string;
};

export type ChartElementKind = "column" | "bar_horizontal" | "pie_segment";

export type SeriesContext = {
  chartId: string;
  chartTitle: string;
  mode: InsightMode;
  elementKind: ChartElementKind;
  points: DataPoint[];
  periodLabel?: string;
};
