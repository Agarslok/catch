import type { DataPoint, PointMetrics, PointNarrative, SeriesContext } from "./types";

export function formatNumberEs(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "—";
  const fixed = value.toFixed(decimals).replace(/\.?0+$/, "");
  return fixed.replace(".", ",");
}

function formatSigned(value: number, unit: string, decimals = 2): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatNumberEs(Math.abs(value), decimals)} ${unit}`.trim();
}

function findPointIndex(points: DataPoint[], id: string): number {
  return points.findIndex((p) => p.id === id);
}

function sumValues(points: DataPoint[]): number {
  return points.reduce((acc, p) => acc + p.value, 0);
}

function averageValue(points: DataPoint[]): number | undefined {
  if (points.length === 0) return undefined;
  return sumValues(points) / points.length;
}

function buildRank(points: DataPoint[], value: number): { rank: number; total: number } {
  const sorted = [...points].sort((a, b) => b.value - a.value);
  const rank = sorted.findIndex((p) => p.value === value) + 1;
  return { rank: rank > 0 ? rank : 1, total: points.length };
}

export function computePointNarrative(
  context: SeriesContext,
  pointId: string,
): PointNarrative | null {
  const index = findPointIndex(context.points, pointId);
  if (index < 0) return null;
  const point = context.points[index];
  const prev = index > 0 ? context.points[index - 1] : undefined;

  const metrics: PointMetrics = {
    label: point.label,
    value: point.value,
    unit: point.unit,
  };

  const bullets: string[] = [];
  let tooltipHint = "";
  let conclusion = "";

  switch (context.mode) {
    case "time_series_rate": {
      if (prev) {
        metrics.previousLabel = prev.label;
        metrics.previousValue = prev.value;
        metrics.deltaAbsolute = point.value - prev.value;
        if (prev.value !== 0) {
          metrics.deltaPercent = (metrics.deltaAbsolute / prev.value) * 100;
        }
      }
      tooltipHint =
        prev && metrics.deltaAbsolute != null
          ? `Frente a ${prev.label} (${formatNumberEs(prev.value)} ${point.unit}).`
          : "Primer periodo de la serie; no hay periodo anterior en estos datos.";
      if (metrics.deltaAbsolute != null && prev) {
        bullets.push(
          `Variación respecto a ${prev.label}: ${formatSigned(metrics.deltaAbsolute, point.unit)}` +
            (metrics.deltaPercent != null
              ? ` (${formatSigned(metrics.deltaPercent, "%", 1)})`
              : ""),
        );
      }
      conclusion =
        metrics.deltaAbsolute != null && metrics.deltaAbsolute < 0
          ? "La tasa bajó respecto al bimestre anterior en esta serie."
          : metrics.deltaAbsolute != null && metrics.deltaAbsolute > 0
            ? "La tasa subió respecto al bimestre anterior en esta serie."
            : "Valor de referencia en la serie bimestral de rotación.";
      break;
    }
    case "category_rate": {
      const avg = averageValue(context.points);
      if (avg != null) {
        metrics.averageValue = avg;
        metrics.vsAverageDelta = point.value - avg;
        const { rank, total } = buildRank(context.points, point.value);
        metrics.rank = rank;
        metrics.rankTotal = total;
        bullets.push(
          `Promedio de la muestra: ${formatNumberEs(avg)} ${point.unit}.`,
        );
        bullets.push(
          `Diferencia vs promedio: ${formatSigned(metrics.vsAverageDelta, point.unit)}.`,
        );
        bullets.push(`Posición en el ranking: ${rank} de ${total}.`);
        tooltipHint = `Comparado con el promedio municipal (${formatNumberEs(avg)} ${point.unit}).`;
        conclusion =
          rank === 1
            ? "Es el municipio con la tasa más alta en esta vista."
            : rank === total
              ? "Es el municipio con la tasa más baja en esta vista."
              : "Se sitúa en la mitad del ranking municipal de esta vista.";
      }
      break;
    }
    case "composition_percent": {
      const total = sumValues(context.points);
      if (total > 0) {
        metrics.sharePercent = (point.value / total) * 100;
        metrics.shareDenominatorLabel = "total de bajas";
        bullets.push(
          `Participación: ${formatNumberEs(metrics.sharePercent, 1)}% del total (${formatNumberEs(total)} ${point.unit}).`,
        );
        tooltipHint = `Representa ${formatNumberEs(metrics.sharePercent, 1)}% del total de ${formatNumberEs(total)} ${point.unit}.`;
        conclusion =
          metrics.sharePercent >= 20
            ? "Concentra una porción relevante del total en esta distribución."
            : "Aporta una porción menor dentro del total de la distribución.";
      }
      break;
    }
    case "composition_parts": {
      const total = sumValues(context.points);
      if (total > 0) {
        metrics.sharePercent = (point.value / total) * 100;
        metrics.shareDenominatorLabel = "contrataciones del mix";
        bullets.push(
          `Participación en el mix: ${formatNumberEs(metrics.sharePercent, 1)}% (${formatNumberEs(point.value)} de ${formatNumberEs(total)} puntos porcentuales del gráfico).`,
        );
        tooltipHint = `${formatNumberEs(metrics.sharePercent, 1)}% del mix mostrado en el gráfico.`;
        conclusion =
          point.value >= total / 2
            ? "Es la parte dominante del mix de contrataciones en esta vista."
            : "Es la parte minoritaria del mix en esta vista.";
      } else {
        tooltipHint = "Avanza la presentación para ver el desglose del mix.";
        conclusion = "El desglose se muestra cuando la narración activa los valores del mix.";
      }
      break;
    }
    default:
      break;
  }

  const valueStr = `${formatNumberEs(point.value)} ${point.unit}`;
  let tooltipLine = `${point.label}: ${valueStr}.`;
  if (metrics.sharePercent != null && metrics.shareDenominatorLabel) {
    tooltipLine += ` Representa el ${formatNumberEs(metrics.sharePercent, 1)}% del ${metrics.shareDenominatorLabel}.`;
  }
  if (
    context.mode === "time_series_rate" &&
    metrics.deltaAbsolute != null &&
    prev
  ) {
    tooltipLine += ` ${formatSigned(metrics.deltaAbsolute, point.unit)} respecto a ${prev.label}`;
    if (metrics.deltaPercent != null) {
      tooltipLine += ` (${formatSigned(metrics.deltaPercent, "%", 1)})`;
    }
    tooltipLine += ".";
  }

  return {
    tooltipLine,
    tooltipHint,
    detailTitle: point.label,
    metrics,
    bullets,
    conclusion,
    sourceNote: context.periodLabel
      ? `Fuente: ${context.chartTitle} · ${context.periodLabel}`
      : `Fuente: ${context.chartTitle}`,
  };
}

function elementKindLabel(context: SeriesContext): string {
  switch (context.elementKind) {
    case "bar_horizontal":
      return "Barra horizontal";
    case "column":
      return "Columna";
    case "pie_segment":
      return "Segmento";
    default:
      return "Elemento";
  }
}

function resolvePointId(context: SeriesContext, params: unknown): string | null {
  const list = Array.isArray(params) ? params : [params];
  if (list.length === 0) return null;

  const first = list[0] as {
    seriesType?: string;
    name?: string;
    dataIndex?: number;
    axisValue?: string;
    value?: number | number[];
  };

  if (first.seriesType === "pie" || (!Array.isArray(params) && first.name)) {
    const byName = context.points.find((pt) => pt.label === first.name);
    if (byName) return byName.id;
    if (typeof first.dataIndex === "number" && context.points[first.dataIndex]) {
      return context.points[first.dataIndex].id;
    }
  }

  for (const item of list) {
    const row = item as {
      dataIndex?: number;
      name?: string;
      axisValue?: string;
      value?: number | number[];
    };
    if (typeof row.dataIndex === "number" && context.points[row.dataIndex]) {
      return context.points[row.dataIndex].id;
    }
    const label = row.name ?? row.axisValue;
    if (label) {
      const found = context.points.find((pt) => pt.label === label);
      if (found) return found.id;
    }
  }

  return null;
}

export function richTooltipHtml(
  narrative: PointNarrative,
  elementLabel: string,
): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  return [
    `<div style="max-width:260px;line-height:1.4;font-size:13px">`,
    `<span style="font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#36b5d4">${esc(elementLabel)}</span>`,
    `<strong style="display:block;margin-top:4px;color:#243b53">${esc(narrative.detailTitle)}</strong>`,
    `<div style="margin-top:5px">${esc(narrative.tooltipLine)}</div>`,
    narrative.tooltipHint
      ? `<div style="margin-top:5px;font-size:12px;color:#5b6168">${esc(narrative.tooltipHint)}</div>`
      : "",
    `</div>`,
  ].join("");
}

const TOOLTIP_INTERACTION = {
  showDelay: 60,
  hideDelay: 40,
  enterable: false,
  confine: true,
  transitionDuration: 0.15,
};

export function richAxisTooltip(context: SeriesContext) {
  return {
    trigger: "axis" as const,
    axisPointer: { type: "shadow" as const },
    ...TOOLTIP_INTERACTION,
    formatter: createRichTooltipFormatter(context),
  };
}

export function richItemTooltip(context: SeriesContext) {
  return {
    trigger: "item" as const,
    ...TOOLTIP_INTERACTION,
    formatter: createRichTooltipFormatter(context),
  };
}

export function createRichTooltipFormatter(
  context: SeriesContext,
): (params: unknown) => string {
  const elementLabel = elementKindLabel(context);
  return (params: unknown) => {
    const id = resolvePointId(context, params);
    if (!id) return "";
    const narrative = computePointNarrative(context, id);
    return narrative ? richTooltipHtml(narrative, elementLabel) : "";
  };
}
