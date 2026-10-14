import type { ItemTooltipParams, AxisTooltipParams } from "./types";

function fmtNum(value: number, decimals = 2): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(decimals).replace(/\.?0+$/, "");
}

/** Tooltip eje (barras/columnas/líneas) — solo datos pasados. */
export function formatAxisTooltipHtml(parts: AxisTooltipParams): string {
  const lines: string[] = [`<strong>${escapeHtml(parts.category)}</strong>`];
  const val = fmtNum(parts.value);
  lines.push(parts.unit ? `${val} ${escapeHtml(parts.unit)}` : val);
  if (parts.period) {
    lines.push(`<span style="opacity:0.85">${escapeHtml(parts.period)}</span>`);
  }
  if (parts.comparisonLabel != null && parts.comparisonValue != null) {
    const cv = fmtNum(parts.comparisonValue);
    const cu = parts.unit ? ` ${escapeHtml(parts.unit)}` : "";
    lines.push(`${escapeHtml(parts.comparisonLabel)}: ${cv}${cu}`);
  }
  return lines.join("<br/>");
}

/** Tooltip ítem (pastel/dona). */
export function formatItemTooltipHtml(parts: ItemTooltipParams): string {
  const lines: string[] = [`<strong>${escapeHtml(parts.name)}</strong>`];
  const val = fmtNum(parts.value);
  lines.push(parts.unit ? `${val} ${escapeHtml(parts.unit)}` : val);
  if (parts.sharePercent != null) {
    lines.push(`Participación: ${fmtNum(parts.sharePercent, 1)}%`);
  }
  if (parts.period) {
    lines.push(`<span style="opacity:0.85">${escapeHtml(parts.period)}</span>`);
  }
  return lines.join("<br/>");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Formatter ECharts para trigger axis con una serie y unidad % u otra. */
export function axisTooltipFormatter(
  unit?: string,
  period?: string,
): (params: unknown) => string {
  return (params: unknown) => {
    const list = Array.isArray(params) ? params : [params];
    const first = list[0] as { name?: string; value?: number | number[] } | undefined;
    if (!first) return "";
    const raw = first.value;
    const value = typeof raw === "number" ? raw : Array.isArray(raw) ? raw[raw.length - 1] : 0;
    return formatAxisTooltipHtml({
      category: String(first.name ?? ""),
      value: typeof value === "number" ? value : 0,
      unit,
      period,
    });
  };
}

export function itemTooltipFormatter(
  unit?: string,
  period?: string,
): (params: unknown) => string {
  return (params: unknown) => {
    const p = params as {
      name?: string;
      value?: number;
      percent?: number;
    };
    return formatItemTooltipHtml({
      name: String(p.name ?? ""),
      value: typeof p.value === "number" ? p.value : 0,
      unit,
      sharePercent: typeof p.percent === "number" ? p.percent : undefined,
      period,
    });
  };
}
