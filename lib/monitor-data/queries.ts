import { isMonitorSectionKey } from "@/lib/monitor-ai/catalog";
import { getDemoClient, getMonitorDataset, getDatasetDisclaimer } from "./dataset";
import { mercado } from "./market";
import { compareClientToMarket, getMarketMetric, isAllowedMetric } from "./metrics";
import { sectionKpis, getSectionName } from "./sections";
import type {
  CompareClientResult,
  MetricValueResult,
  MonitorMarketFilters,
  MonitorMarketMetric,
  SectionSummaryResult,
} from "./types";
import { FILTER_ALL, PROCESO_KEYS, TAMANOS } from "./types";
import { getMonitorEmpresas } from "./dataset";

export type QueryErrorCode =
  | "INVALID_SECTION"
  | "INVALID_METRIC"
  | "INVALID_METRIC_FOR_COMPARE"
  | "INVALID_BIMESTRE_INDEX"
  | "INVALID_FILTER";

export class MonitorDataQueryError extends Error {
  constructor(
    public code: QueryErrorCode,
    message?: string,
  ) {
    super(message ?? code);
  }
}

function validateFilters(raw?: Record<string, unknown>): MonitorMarketFilters | undefined {
  if (!raw) return undefined;
  const out: MonitorMarketFilters = {};
  if (raw.tier !== undefined) {
    const tier = String(raw.tier);
    if (tier !== FILTER_ALL && tier !== "Tier 1" && tier !== "Tier 2" && tier !== "Tier 3") {
      throw new MonitorDataQueryError("INVALID_FILTER", "tier");
    }
    out.tier = tier;
  }
  if (raw.tamano !== undefined) {
    const tamano = String(raw.tamano);
    if (tamano !== FILTER_ALL && !(TAMANOS as readonly string[]).includes(tamano)) {
      throw new MonitorDataQueryError("INVALID_FILTER", "tamano");
    }
    out.tamano = tamano;
  }
  if (raw.proceso !== undefined) {
    const proceso = String(raw.proceso);
    if (proceso !== FILTER_ALL && !(PROCESO_KEYS as readonly string[]).includes(proceso)) {
      throw new MonitorDataQueryError("INVALID_FILTER", "proceso");
    }
    out.proceso = proceso;
  }
  return out;
}

export function getSectionSummary(
  sectionKey: string,
  filters?: Record<string, unknown>,
): SectionSummaryResult {
  if (!isMonitorSectionKey(sectionKey)) {
    throw new MonitorDataQueryError("INVALID_SECTION");
  }
  const f = validateFilters(filters);
  const { M, filtersApplied, filterSubsetCount } = mercado(getMonitorEmpresas(), f);
  const cli = getDemoClient();
  const datos = getMonitorDataset();
  return {
    sectionKey,
    sectionName: getSectionName(sectionKey),
    edition: datos.edicion,
    filtersApplied,
    filterSubsetCount,
    kpis: sectionKpis(sectionKey, M, cli),
  };
}

export function getMarketMetricQuery(
  metric: string,
  bimestreIndex?: number,
  filters?: Record<string, unknown>,
): MetricValueResult {
  if (!isAllowedMetric(metric)) {
    throw new MonitorDataQueryError("INVALID_METRIC");
  }
  const f = validateFilters(filters);
  try {
    return getMarketMetric(metric as MonitorMarketMetric, bimestreIndex, f);
  } catch (e) {
    if (e instanceof Error && e.message === "INVALID_BIMESTRE_INDEX") {
      throw new MonitorDataQueryError("INVALID_BIMESTRE_INDEX");
    }
    throw e;
  }
}

export function compareClientToMarketQuery(
  metric: string,
  bimestreIndex?: number,
  filters?: Record<string, unknown>,
): CompareClientResult {
  if (!isAllowedMetric(metric)) {
    throw new MonitorDataQueryError("INVALID_METRIC");
  }
  const f = validateFilters(filters);
  try {
    return compareClientToMarket(metric as MonitorMarketMetric, bimestreIndex, f);
  } catch (e) {
    if (e instanceof Error && e.message === "INVALID_BIMESTRE_INDEX") {
      throw new MonitorDataQueryError("INVALID_BIMESTRE_INDEX");
    }
    if (e instanceof Error && e.message === "INVALID_METRIC_FOR_COMPARE") {
      throw new MonitorDataQueryError("INVALID_METRIC_FOR_COMPARE");
    }
    throw e;
  }
}

export function getQuerySessionMeta() {
  const datos = getMonitorDataset();
  return {
    disclaimer: getDatasetDisclaimer(),
    edition: datos.edicion,
    bimestres: datos.bimestres,
    demoClientId: getDemoClient().id,
    empresaCount: datos.empresas.length,
  };
}
