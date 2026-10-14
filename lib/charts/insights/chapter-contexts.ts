import { D1, D2, MU, type ChartKind, type MunFilter } from "@/lib/data/guanajuato-2026";
import type { DataPoint, SeriesContext } from "./types";

const PCT = "%";

export function buildTurnoverBimonthlyContext(beat: number): SeriesContext {
  const labels = [...D1.map(([l]) => l), "Ene–Feb 26"];
  const values = [...D1.map(([, v]) => v), 7.24];
  const points: DataPoint[] = labels.map((label, i) => ({
    id: `turnover-${i}`,
    label,
    value: beat === 1 || i < D1.length ? values[i] : 0,
    unit: PCT,
  }));
  return {
    chartId: "turnover_bimonthly",
    chartTitle: "Rotación bimestral total",
    mode: "time_series_rate",
    elementKind: "column",
    periodLabel: "2025 y Ene–Feb 2026",
    points,
  };
}

export function buildMunicipalityContext(
  munFilter: MunFilter,
  chartKind: ChartKind,
): SeriesContext {
  const idx = ({ controlada: 1, nocontrolada: 2, total: 3 } as const)[munFilter];
  const rows = [...MU].sort((a, b) => (b[idx] as number) - (a[idx] as number));
  const filterLabel =
    munFilter === "total"
      ? "Total"
      : munFilter === "controlada"
        ? "Controlada"
        : "No controlada";
  return {
    chartId: chartKind === "pie" ? "turnover_municipality_pie" : "turnover_municipality_bar",
    chartTitle: `Rotación por municipio (${filterLabel})`,
    mode: "category_rate",
    elementKind: chartKind === "pie" ? "pie_segment" : "bar_horizontal",
    periodLabel: "Ene–Feb 2026",
    points: rows.map((row, i) => ({
      id: `mun-${i}-${row[0]}`,
      label: row[0],
      value: row[idx] as number,
      unit: PCT,
    })),
  };
}

export function buildTenureContext(chartKind: ChartKind): SeriesContext {
  return {
    chartId: chartKind === "pie" ? "tenure_pie" : "tenure_bar",
    chartTitle: "Bajas por antigüedad",
    mode: "composition_percent",
    elementKind: chartKind === "pie" ? "pie_segment" : "column",
    periodLabel: "% del total de bajas · bimestre",
    points: D2.map(([label, value], i) => ({
      id: `tenure-${i}`,
      label,
      value,
      unit: PCT,
    })),
  };
}

export function buildHiringMixContext(beat: number): SeriesContext {
  const replacement = beat === 1 ? 80 : 0;
  const growth = beat === 1 ? 20 : 0;
  return {
    chartId: "hiring_mix",
    chartTitle: "Mix de contrataciones",
    mode: "composition_parts",
    elementKind: "pie_segment",
    periodLabel: "Ene–Feb 2026",
    points: [
      { id: "hiring-replacement", label: "Cubrir bajas", value: replacement, unit: PCT },
      { id: "hiring-growth", label: "Posiciones nuevas", value: growth, unit: PCT },
    ],
  };
}
