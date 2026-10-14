import { CHAPTERS, D1, D2, MU } from "@/lib/data/guanajuato-2026";
import type { DatasetCatalogEntry, DatasetSnapshot, FieldKind } from "./types";

export const DATASET_CATALOG: Record<string, DatasetCatalogEntry> = {
  "guanajuato.turnover_bimonthly": {
    key: "guanajuato.turnover_bimonthly",
    label: "Rotación bimestral total",
    description: "Serie bimestral 2025 + Ene–Feb 2026 (%).",
    presentationChartFocus: "turnover_bimonthly",
    fields: [
      { name: "period", kind: "category" },
      { name: "turnover_pct", kind: "number" },
    ],
    categoryCount: D1.length + 1,
    seriesCount: 1,
    hasOrderedTime: true,
  },
  "guanajuato.turnover_municipality": {
    key: "guanajuato.turnover_municipality",
    label: "Rotación por municipio",
    description: "Rotación % por municipio (controlada, no controlada, total).",
    presentationChartFocus: "turnover_municipality",
    fields: [
      { name: "municipality", kind: "category" },
      { name: "turnover_controlled", kind: "number" },
      { name: "turnover_uncontrolled", kind: "number" },
      { name: "turnover_total", kind: "number" },
    ],
    categoryCount: MU.length,
    seriesCount: 3,
    hasGeo: false,
  },
  "guanajuato.tenure_breakdown": {
    key: "guanajuato.tenure_breakdown",
    label: "Bajas por antigüedad",
    description: "% del total de bajas por bucket de antigüedad.",
    presentationChartFocus: "turnover_tenure",
    fields: [
      { name: "tenure_bucket", kind: "category" },
      { name: "share_pct", kind: "number" },
    ],
    categoryCount: D2.length,
    seriesCount: 1,
  },
  "guanajuato.hiring_mix": {
    key: "guanajuato.hiring_mix",
    label: "Mix de contrataciones",
    description: "Proporción reposición vs posiciones nuevas (demo bimestre).",
    presentationChartFocus: "hiring_mix",
    fields: [
      { name: "hiring_type", kind: "category" },
      { name: "share_pct", kind: "number" },
    ],
    categoryCount: 2,
    seriesCount: 1,
  },
  "demo.departments_turnover": {
    key: "demo.departments_turnover",
    label: "Rotación por departamento (demo)",
    description: "Serie demo usada en respuestas de chat.",
    fields: [
      { name: "department", kind: "category" },
      { name: "turnover_pct", kind: "number" },
    ],
    categoryCount: 3,
    seriesCount: 1,
  },
};

const CHART_FOCUS_TO_DATASET: Record<string, string> = {};
for (const entry of Object.values(DATASET_CATALOG)) {
  if (entry.presentationChartFocus) {
    CHART_FOCUS_TO_DATASET[entry.presentationChartFocus] = entry.key;
  }
}

export function resolveDatasetKeyFromChartFocus(chartFocus?: string): string | null {
  if (!chartFocus) return null;
  return CHART_FOCUS_TO_DATASET[chartFocus] ?? null;
}

export function getDatasetEntry(key: string): DatasetCatalogEntry | null {
  return DATASET_CATALOG[key] ?? null;
}

export function buildDatasetSnapshot(key: string): DatasetSnapshot | null {
  const entry = getDatasetEntry(key);
  if (!entry) return null;

  const kinds = new Set<FieldKind>(entry.fields.map((f) => f.kind));
  const numericFieldCount = entry.fields.filter((f) => f.kind === "number").length;

  return {
    key: entry.key,
    availableFieldKinds: kinds,
    categoryCount: entry.categoryCount ?? 0,
    seriesCount: entry.seriesCount ?? 1,
    hasOrderedTime: Boolean(entry.hasOrderedTime),
    hasGeo: Boolean(entry.hasGeo),
    hasHierarchy: Boolean(entry.hasHierarchy),
    hasTarget: Boolean(entry.hasTarget),
    hasFunnelStages: Boolean(entry.hasFunnelStages),
    numericFieldCount,
  };
}

/** Contexto mínimo para el chat (sin volcar tablas completas). */
export function datasetContextForModel(key: string): Record<string, unknown> | null {
  const entry = getDatasetEntry(key);
  const snapshot = buildDatasetSnapshot(key);
  if (!entry || !snapshot) return null;

  const chapter = CHAPTERS.find((c) => c.chartFocus === entry.presentationChartFocus);

  return {
    datasetKey: key,
    label: entry.label,
    description: entry.description,
    fieldNames: entry.fields.map((f) => f.name),
    categoryCount: snapshot.categoryCount,
    seriesCount: snapshot.seriesCount,
    hasOrderedTime: snapshot.hasOrderedTime,
    hasGeo: snapshot.hasGeo,
    presentationHeadline: chapter?.headline,
    presentationChartFocus: entry.presentationChartFocus,
  };
}

export function listDatasetKeys(): string[] {
  return Object.keys(DATASET_CATALOG);
}
