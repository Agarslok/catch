import {
  getDemoClientId,
  getMonitorDataset,
  getMonitorEmpresas,
} from "@/lib/monitor-data/dataset";
import type { Empresa } from "@/lib/monitor-data/types";
import { isMonitorChartId } from "./catalog";
import { chartUiLabel } from "./chart-metadata";
import type { MonitorChartElementRef, MonitorChartId } from "./types";

const CLIENT_LABEL = "Su empresa";

export type HighlightProbe = {
  category?: string;
  seriesKey?: string;
  datasetIndex?: number;
  index?: number;
};

function ordenadasRot(M: Empresa[], ult: number) {
  return M.map((e) => ({ id: e.id, v: e.rot[ult] }))
    .filter((x) => x.v != null)
    .sort((a, b) => (a.v as number) - (b.v as number));
}

function puntosSalRot(M: Empresa[], ult: number) {
  return M.filter((e) => e.sal[0] != null && e.rot[ult] != null).map((e) => e.id);
}

/**
 * Resuelve un resaltado contra el dataset demo (muestra completa, sin filtros UI).
 * Devuelve null si el elemento no existe en esa gráfica.
 */
export function resolveMonitorHighlightTarget(
  chartId: MonitorChartId,
  probe: HighlightProbe,
): MonitorChartElementRef | null {
  const M = getMonitorEmpresas();
  const datos = getMonitorDataset();
  const ULT = datos.bimestres.length - 1;
  const CLIENTE = getDemoClientId();

  switch (chartId) {
    case "plantilla": {
      const labels = ["Operativo", "Administrativo", "Otro"];
      return matchCategoryIndex(chartId, labels, probe, "", 0);
    }
    case "mixcontrata": {
      const labels = ["Reposición de bajas", "Posiciones nuevas"];
      return matchCategoryIndex(chartId, labels, probe, "", 0);
    }
    case "rotcomp": {
      const filas = ordenadasRot(M, ULT);
      if (typeof probe.datasetIndex === "number" && typeof probe.index === "number") {
        if (probe.datasetIndex !== 0) return null;
        const row = filas[probe.index];
        if (!row) return null;
        return {
          chartId,
          category: row.id,
          seriesKey: probe.seriesKey ?? "",
          datasetIndex: 0,
          index: probe.index,
        };
      }
      if (probe.category) {
        const idx = filas.findIndex((f) => f.id === probe.category);
        if (idx < 0) return null;
        return {
          chartId,
          category: probe.category,
          seriesKey: probe.seriesKey ?? "",
          datasetIndex: 0,
          index: idx,
        };
      }
      return null;
    }
    case "salrot": {
      const ids = puntosSalRot(M, ULT);
      if (!probe.category) return null;
      if (!ids.includes(probe.category)) return null;
      const otros = ids.filter((id) => id !== CLIENTE);
      const isClient = probe.category === CLIENTE;
      const datasetIndex = isClient ? 1 : 0;
      const index = isClient ? 0 : otros.indexOf(probe.category);
      if (index < 0) return null;
      const seriesKey = isClient ? CLIENT_LABEL : "Otras empresas";
      if (probe.seriesKey && probe.seriesKey !== seriesKey) return null;
      return {
        chartId,
        category: probe.category,
        seriesKey,
        datasetIndex,
        index,
      };
    }
    case "rotserie": {
      const labels = [...datos.bimestres];
      const series = [
        { key: "No controlada", datasetIndex: 0 },
        { key: "Controlada", datasetIndex: 1 },
        { key: CLIENT_LABEL, datasetIndex: 2 },
      ];
      if (typeof probe.datasetIndex === "number" && typeof probe.index === "number") {
        const s = series.find((x) => x.datasetIndex === probe.datasetIndex);
        if (!s || probe.index < 0 || probe.index >= labels.length) return null;
        return {
          chartId,
          category: labels[probe.index],
          seriesKey: s.key,
          datasetIndex: probe.datasetIndex,
          index: probe.index,
        };
      }
      if (probe.category && probe.seriesKey) {
        const s = series.find((x) => x.key === probe.seriesKey);
        const idx = labels.indexOf(probe.category);
        if (!s || idx < 0) return null;
        return {
          chartId,
          category: probe.category,
          seriesKey: s.key,
          datasetIndex: s.datasetIndex,
          index: idx,
        };
      }
      return null;
    }
    case "edad": {
      const labels = ["< 23", "23-29", "30-37", "38-50", "> 50"];
      const series = [
        { key: "Mercado", datasetIndex: 0 },
        { key: CLIENT_LABEL, datasetIndex: 1 },
      ];
      return matchSeriesCategory(chartId, labels, series, probe);
    }
    case "incremento": {
      const labels = [
        "Operativo 2024",
        "Operativo 2025",
        "Administrativo 2024",
        "Administrativo 2025",
      ];
      const series = [
        { key: "Mercado", datasetIndex: 0 },
        { key: CLIENT_LABEL, datasetIndex: 1 },
      ];
      return matchSeriesCategory(chartId, labels, series, probe);
    }
    case "ausentismo": {
      const labels = [...datos.bimestres];
      const series = [
        { key: "Mercado", datasetIndex: 0 },
        { key: CLIENT_LABEL, datasetIndex: 1 },
      ];
      return matchSeriesCategory(chartId, labels, series, probe);
    }
    case "salini":
    case "capacitacion": {
      const filas = ordenadas(
        M,
        chartId === "salini" ? (e) => e.sal[0] : (e) => e.cap,
      );
      return matchOrderedBar(chartId, filas, probe);
    }
    default:
      return null;
  }
}

function ordenadas(M: Empresa[], f: (e: Empresa) => number | null | undefined) {
  return M.map((e) => ({ id: e.id, v: f(e) }))
    .filter((x) => x.v != null)
    .sort((a, b) => (a.v as number) - (b.v as number));
}

function matchOrderedBar(
  chartId: MonitorChartId,
  filas: { id: string }[],
  probe: HighlightProbe,
): MonitorChartElementRef | null {
  if (typeof probe.datasetIndex === "number" && typeof probe.index === "number") {
    if (probe.datasetIndex !== 0) return null;
    const row = filas[probe.index];
    if (!row) return null;
    return {
      chartId,
      category: row.id,
      seriesKey: probe.seriesKey ?? "",
      datasetIndex: 0,
      index: probe.index,
    };
  }
  if (probe.category) {
    const idx = filas.findIndex((f) => f.id === probe.category);
    if (idx < 0) return null;
    return {
      chartId,
      category: probe.category,
      seriesKey: probe.seriesKey ?? "",
      datasetIndex: 0,
      index: idx,
    };
  }
  return null;
}

function matchCategoryIndex(
  chartId: MonitorChartId,
  labels: string[],
  probe: HighlightProbe,
  defaultSeriesKey: string,
  datasetIndex: number,
): MonitorChartElementRef | null {
  if (typeof probe.index === "number") {
    if (probe.index < 0 || probe.index >= labels.length) return null;
    if (probe.datasetIndex !== undefined && probe.datasetIndex !== datasetIndex) return null;
    const category = labels[probe.index];
    return {
      chartId,
      category,
      seriesKey: probe.seriesKey ?? defaultSeriesKey,
      datasetIndex,
      index: probe.index,
    };
  }
  if (probe.category) {
    const needle = probe.category.trim().toLowerCase();
    const idx = labels.findIndex((l) => l.trim().toLowerCase() === needle);
    if (idx < 0) return null;
    const category = labels[idx];
    if (probe.datasetIndex !== undefined && probe.datasetIndex !== datasetIndex) return null;
    return {
      chartId,
      category,
      seriesKey: probe.seriesKey ?? defaultSeriesKey,
      datasetIndex,
      index: idx,
    };
  }
  return null;
}

function matchSeriesCategory(
  chartId: MonitorChartId,
  labels: string[],
  series: { key: string; datasetIndex: number }[],
  probe: HighlightProbe,
): MonitorChartElementRef | null {
  if (typeof probe.datasetIndex === "number" && typeof probe.index === "number") {
    const s = series.find((x) => x.datasetIndex === probe.datasetIndex);
    if (!s || probe.index < 0 || probe.index >= labels.length) return null;
    return {
      chartId,
      category: labels[probe.index],
      seriesKey: s.key,
      datasetIndex: probe.datasetIndex,
      index: probe.index,
    };
  }
  if (probe.category && probe.seriesKey) {
    const s = series.find((x) => x.key === probe.seriesKey);
    const idx = labels.indexOf(probe.category);
    if (!s || idx < 0) return null;
    if (probe.datasetIndex !== undefined && probe.datasetIndex !== s.datasetIndex) return null;
    return {
      chartId,
      category: probe.category,
      seriesKey: s.key,
      datasetIndex: s.datasetIndex,
      index: idx,
    };
  }
  return null;
}

export function parseChartId(value: unknown): MonitorChartId | null {
  if (typeof value !== "string" || !isMonitorChartId(value)) return null;
  return value;
}

/** Referencia estable del cliente demo en rotcomp (barra). */
export function demoClientRotcompHighlight(): MonitorChartElementRef | null {
  return resolveMonitorHighlightTarget("rotcomp", { category: getDemoClientId() });
}

export function highlightHintsForCharts(chartIds: MonitorChartId[]): string {
  return chartIds
    .map((id) => {
      const sample = sampleHighlightCategories(id, 6);
      const label = chartUiLabel(id);
      return sample.length ? `${label}[${sample.join("; ")}]` : `${label}[sin catálogo]`;
    })
    .join(" ");
}

function sampleHighlightCategories(chartId: MonitorChartId, limit: number): string[] {
  const ref = resolveMonitorHighlightTarget(chartId, { category: getDemoClientId() });
  const samples: string[] = [];
  if (chartId === "mixcontrata") {
    samples.push("Reposición de bajas", "Posiciones nuevas");
  } else if (chartId === "plantilla") {
    samples.push("Operativo", "Administrativo", "Otro");
  } else if (ref?.category) {
    samples.push(ref.category);
  }
  if (chartId === "rotcomp" || chartId === "salini" || chartId === "capacitacion") {
    samples.push(getDemoClientId());
  }
  return [...new Set(samples)].slice(0, limit);
}

export function chartHasHighlightCatalog(chartId: MonitorChartId): boolean {
  return (
    chartId === "plantilla" ||
    chartId === "mixcontrata" ||
    chartId === "rotcomp" ||
    chartId === "salrot" ||
    chartId === "rotserie" ||
    chartId === "edad" ||
    chartId === "incremento" ||
    chartId === "ausentismo" ||
    chartId === "salini" ||
    chartId === "capacitacion"
  );
}
