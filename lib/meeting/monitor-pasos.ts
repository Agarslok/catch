import type { MonitorChartId, MonitorSectionIndex } from "@/lib/monitor-ai/types";

/**
 * Orden de gráficas por sección, alineado con SECCIONES[].graficos en monitor-en-vivo-catch.html
 * y con MONITOR_CHARTS_BY_SECTION / CHART_TO_SECTION en lib/monitor-ai/catalog.ts.
 */
/** Recorrido visible. El resto de chartId sigue en el tipo, pero no entra al guion. */
export const MONITOR_CHARTS_BY_SECTION: readonly MonitorChartId[][] = [
  ["plantilla", "tamano"],
  ["salini", "escalera"],
  ["paquete", "beneficios"],
  ["rotserie", "cuandosevan"],
  ["prediccion", "salrot"],
];

export type MonitorPasoTipo = "inicio" | "explica" | "hoja" | "cierre";

export type MonitorPaso =
  | { tipo: "inicio" }
  | {
      tipo: "explica";
      sectionIndex: MonitorSectionIndex;
      chartIndex: number;
      chartId: MonitorChartId;
    }
  | { tipo: "hoja"; sectionIndex: MonitorSectionIndex }
  | { tipo: "cierre" };

/** Réplica de la construcción de PASOS en monitor-en-vivo-catch.html (líneas ~854–856). */
export function buildMonitorPasos(): MonitorPaso[] {
  const out: MonitorPaso[] = [{ tipo: "inicio" }];
  MONITOR_CHARTS_BY_SECTION.forEach((charts, si) => {
    const sectionIndex = si as MonitorSectionIndex;
    charts.forEach((chartId, gi) => {
      out.push({ tipo: "explica", sectionIndex, chartIndex: gi, chartId });
    });
    out.push({ tipo: "hoja", sectionIndex });
  });
  out.push({ tipo: "cierre" });
  return out;
}

export function chartIdsForSection(sectionIndex: MonitorSectionIndex): MonitorChartId[] {
  return [...MONITOR_CHARTS_BY_SECTION[sectionIndex]];
}

export function findPasoIndexForChart(chartId: MonitorChartId): number {
  const pasos = buildMonitorPasos();
  return pasos.findIndex(
    (p) => p.tipo === "explica" && p.chartId === chartId,
  );
}
