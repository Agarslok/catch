/** Identificadores estables del catálogo (18 visualizaciones). */
export const VISUALIZATION_IDS = [
  "bar_horizontal",
  "column",
  "bar_grouped",
  "bar_stacked",
  "line",
  "area",
  "line_multi",
  "donut",
  "pie",
  "histogram",
  "scatter",
  "bubble",
  "kpi",
  "progress",
  "funnel",
  "heatmap",
  "treemap",
  "geo_map",
] as const;

export type VisualizationId = (typeof VISUALIZATION_IDS)[number];

export type ImplementationStatus = "implemented" | "partial" | "planned";

export type FieldKind =
  | "category"
  | "number"
  | "date"
  | "datetime"
  | "geo_region"
  | "geo_latlng"
  | "hierarchy"
  | "stage"
  | "target";

export type DataShapeHint =
  | "categories_with_values"
  | "time_series"
  | "multi_series_categories"
  | "stacked_components"
  | "single_metric"
  | "metric_with_target"
  | "numeric_distribution"
  | "xy_numeric"
  | "xy_size_numeric"
  | "grid_two_categories"
  | "hierarchy_values"
  | "geo_metric"
  | "funnel_stages";

export type AnalyticalIntent =
  | "compare_categories"
  | "compare_periods"
  | "trend_over_time"
  | "composition"
  | "distribution"
  | "correlation"
  | "intensity_grid"
  | "hierarchy_breakdown"
  | "geographic_compare"
  | "single_kpi"
  | "progress_to_goal"
  | "funnel_conversion";

export type InteractionKind =
  | "select"
  | "highlight"
  | "filter"
  | "zoom"
  | "drilldown"
  | "open_detail"
  | "tooltip";

export type CatalogEntry = {
  id: VisualizationId;
  name: string;
  description: string;
  useCases: string[];
  suitableData: DataShapeHint[];
  requiredFields: FieldKind[];
  optionalFields: FieldKind[];
  supportedInteractions: InteractionKind[];
  limitations: string[];
  accessibilityNotes: string[];
  selectionHints: string[];
  implementationStatus: ImplementationStatus;
  componentKey: RegisteredComponentKey;
};

export type DatasetFieldSpec = {
  name: string;
  kind: FieldKind;
};

export type DatasetCatalogEntry = {
  key: string;
  label: string;
  description: string;
  fields: DatasetFieldSpec[];
  /** Enlace con capítulos de presentación cuando aplica */
  presentationChartFocus?: string;
  categoryCount?: number;
  seriesCount?: number;
  hasOrderedTime?: boolean;
  hasGeo?: boolean;
  hasHierarchy?: boolean;
  hasTarget?: boolean;
  hasFunnelStages?: boolean;
};

export type DatasetSnapshot = {
  key: string;
  availableFieldKinds: Set<FieldKind>;
  categoryCount: number;
  seriesCount: number;
  hasOrderedTime: boolean;
  hasGeo: boolean;
  hasHierarchy: boolean;
  hasTarget: boolean;
  hasFunnelStages: boolean;
  numericFieldCount: number;
};

export type RecommendationInput = {
  intent: AnalyticalIntent;
  dataset: DatasetSnapshot;
  /** Preferir visualizaciones ya implementadas en la app */
  preferImplemented?: boolean;
};

export type VisualizationRecommendation = {
  visualizationId: VisualizationId;
  datasetKey: string;
  explanation: string;
  confidence: "high" | "medium" | "low";
  alternatives: VisualizationId[];
};

export type ActionScope = "global" | "local";

export const CHART_ACTION_TYPES = [
  "show_chart",
  "highlight",
  "filter",
  "zoom",
  "open_detail",
  "reset_view",
] as const;

export type ChartActionType = (typeof CHART_ACTION_TYPES)[number];

export type ShowChartAction = {
  type: "show_chart";
  scope: ActionScope;
  visualizationId: VisualizationId;
  datasetKey: string;
};

export type HighlightAction = {
  type: "highlight";
  scope: ActionScope;
  category?: string;
  seriesKey?: string;
};

export type FilterAction = {
  type: "filter";
  scope: ActionScope;
  dimension: "munFilter" | "chartKind" | "category";
  value: string;
};

export type ZoomAction = {
  type: "zoom";
  scope: ActionScope;
  startCategory?: string;
  endCategory?: string;
};

export type OpenDetailAction = {
  type: "open_detail";
  scope: ActionScope;
  entityId: string;
};

export type ResetViewAction = {
  type: "reset_view";
  scope: ActionScope;
};

export type ChartAction =
  | ShowChartAction
  | HighlightAction
  | FilterAction
  | ZoomAction
  | OpenDetailAction
  | ResetViewAction;

export type ValidatedChartAction = ChartAction;

export type ActionValidationResult =
  | { ok: true; action: ValidatedChartAction }
  | { ok: false; errors: string[] };

export type ChatStructuredResponse = {
  message: string;
  visualization: VisualizationId;
  datasetKey: string;
  action?: ValidatedChartAction;
  explanation: string;
};

/** Claves de componente permitidas (no extensible por la IA). */
export const REGISTERED_COMPONENT_KEYS = [
  "echarts.column",
  "echarts.bar_horizontal",
  "echarts.bar_grouped",
  "echarts.bar_stacked",
  "echarts.line",
  "echarts.area",
  "echarts.line_multi",
  "echarts.donut",
  "echarts.pie",
  "echarts.histogram",
  "echarts.scatter",
  "echarts.bubble",
  "echarts.kpi",
  "echarts.progress",
  "echarts.funnel",
  "echarts.heatmap",
  "echarts.treemap",
  "echarts.geo_map",
] as const;

export type RegisteredComponentKey = (typeof REGISTERED_COMPONENT_KEYS)[number];
