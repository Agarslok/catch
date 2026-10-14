import type { ChartColorRole } from "./types";

/**
 * Tokens alineados con `app/globals.css` (:root).
 * ECharts en canvas no lee CSS vars; mantener hex sincronizado manualmente.
 */
export const CHART_TOKENS = {
  primary: "#243B53",
  secondary: "#36B5D4",
  neutral: "#C9D6E2",
  positive: "#1B7A5E",
  negative: "#E0453A",
  warning: "#B8860B",
  meta: "#5B6168",
  benchmark: "#1B4F7A",
  selected: "#243B53",
  highlight: "#36B5D4",
  muted: "#C9D6E2",
  ink: "#232222",
  line: "#E6E7E8",
  soft: "#EEF5FA",
  track: "#F3F5F7",
  white: "#FFFFFF",
} as const satisfies Record<ChartColorRole | "ink" | "line" | "soft" | "track" | "white", string>;

/** Paleta cíclica para series múltiples (pie, apiladas, etc.). */
export const CHART_SERIES_PALETTE: readonly string[] = [
  CHART_TOKENS.primary,
  CHART_TOKENS.secondary,
  CHART_TOKENS.neutral,
  CHART_TOKENS.benchmark,
  CHART_TOKENS.meta,
  CHART_TOKENS.warning,
];

export function chartColor(role: ChartColorRole): string {
  return CHART_TOKENS[role];
}

export function paletteColor(index: number): string {
  return CHART_SERIES_PALETTE[index % CHART_SERIES_PALETTE.length];
}
