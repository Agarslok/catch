import { getDemoClient, getMonitorDataset } from "./dataset";
import { fmt$, fmtP } from "./format";
import { mercado, ultimoBimestreIndex } from "./market";
import { mediana, promSinCeros, serieRotIndices } from "./stats";
import type {
  CompareClientResult,
  MetricValueResult,
  MonitorMarketFilters,
  MonitorMarketMetric,
  NullableNumber,
} from "./types";
import { getMonitorEmpresas } from "./dataset";

const MARKET_METRICS: MonitorMarketMetric[] = [
  "turnover_total",
  "turnover_uncontrolled",
  "turnover_controlled",
  "absenteeism",
  "median_initial_salary",
  "market_headcount",
];

const CLIENT_METRICS: MonitorMarketMetric[] = [
  "client_turnover_total",
  "client_absenteeism",
  "client_initial_salary",
];

export const ALLOWED_MARKET_METRICS = new Set<MonitorMarketMetric>([
  ...MARKET_METRICS,
  ...CLIENT_METRICS,
]);

export function isAllowedMetric(m: string): m is MonitorMarketMetric {
  return ALLOWED_MARKET_METRICS.has(m as MonitorMarketMetric);
}

function rawMarketMetric(
  M: ReturnType<typeof getMonitorEmpresas>,
  metric: MonitorMarketMetric,
  bimestreIndex: number,
): NullableNumber {
  const datos = getMonitorDataset();
  const serie = serieRotIndices(M, datos.bimestres.length);
  switch (metric) {
    case "turnover_total":
      return promSinCeros(M.map((e) => e.rot[bimestreIndex]));
    case "turnover_uncontrolled":
      return serie.nc[bimestreIndex];
    case "turnover_controlled":
      return serie.ct[bimestreIndex];
    case "absenteeism":
      return promSinCeros(M.map((e) => e.aus[bimestreIndex]));
    case "median_initial_salary":
      return mediana(M.map((e) => e.sal[0]));
    case "market_headcount":
      return M.reduce((s, e) => s + (e.op || 0) + (e.adm || 0) + (e.otro || 0), 0);
    case "client_turnover_total":
      return getDemoClient().rot[bimestreIndex] ?? null;
    case "client_absenteeism":
      return getDemoClient().aus[bimestreIndex] ?? null;
    case "client_initial_salary":
      return getDemoClient().sal[0] ?? null;
    default:
      return null;
  }
}

function formatMetric(metric: MonitorMarketMetric, value: NullableNumber): string | null {
  if (value == null) return null;
  if (metric.includes("salary")) return fmt$(value);
  if (metric === "market_headcount") return String(Math.round(value));
  return fmtP(value, metric === "turnover_total" ? 2 : 2);
}

function resolveBimestreIndex(requested?: number): number {
  const datos = getMonitorDataset();
  const max = ultimoBimestreIndex(datos);
  if (requested === undefined) return max;
  if (!Number.isInteger(requested) || requested < 0 || requested > max) {
    throw new Error("INVALID_BIMESTRE_INDEX");
  }
  return requested;
}

export function getMarketMetric(
  metric: MonitorMarketMetric,
  bimestreIndex?: number,
  filters?: MonitorMarketFilters,
): MetricValueResult {
  if (!MARKET_METRICS.includes(metric) && !CLIENT_METRICS.includes(metric)) {
    throw new Error("INVALID_METRIC");
  }
  const datos = getMonitorDataset();
  const bi = resolveBimestreIndex(bimestreIndex);
  const { M, filtersApplied, filterSubsetCount } = mercado(getMonitorEmpresas(), filters);
  const value = rawMarketMetric(M, metric, bi);
  return {
    metric,
    bimestreIndex: bi,
    bimestreLabel: datos.bimestres[bi] ?? "",
    value,
    valueFormatted: formatMetric(metric, value),
    filtersApplied,
    filterSubsetCount,
  };
}

export function compareClientToMarket(
  metric: MonitorMarketMetric,
  bimestreIndex?: number,
  filters?: MonitorMarketFilters,
): CompareClientResult {
  const compareable: MonitorMarketMetric[] = [
    "turnover_total",
    "absenteeism",
    "median_initial_salary",
  ];
  if (!compareable.includes(metric)) {
    throw new Error("INVALID_METRIC_FOR_COMPARE");
  }
  const datos = getMonitorDataset();
  const bi = resolveBimestreIndex(bimestreIndex);
  const { M, filtersApplied, filterSubsetCount } = mercado(getMonitorEmpresas(), filters);
  const cli = getDemoClient();

  let clientValue: NullableNumber = null;
  let marketValue: NullableNumber = null;
  switch (metric) {
    case "turnover_total":
      clientValue = cli.rot[bi] ?? null;
      marketValue = promSinCeros(M.map((e) => e.rot[bi]));
      break;
    case "absenteeism":
      clientValue = cli.aus[bi] ?? null;
      marketValue = promSinCeros(M.map((e) => e.aus[bi]));
      break;
    case "median_initial_salary":
      clientValue = cli.sal[0] ?? null;
      marketValue = mediana(M.map((e) => e.sal[0]));
      break;
  }

  return {
    metric,
    bimestreIndex: bi,
    bimestreLabel: datos.bimestres[bi] ?? "",
    clientValue,
    marketValue,
    clientFormatted:
      metric === "median_initial_salary"
        ? formatMetric("client_initial_salary", clientValue)
        : metric === "turnover_total"
          ? formatMetric("client_turnover_total", clientValue)
          : formatMetric("client_absenteeism", clientValue),
    marketFormatted: formatMetric(metric, marketValue),
    filtersApplied,
    filterSubsetCount,
  };
}
