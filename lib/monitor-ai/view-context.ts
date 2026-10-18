import { isMonitorChartId } from "./catalog";
import type { MonitorAiHighlightStatus, MonitorChartId } from "./types";

export type MonitorAiViewStepType = "inicio" | "explica" | "hoja" | "cierre" | "other";

export type MonitorAiVisibleChartMeta = {
  chartId: MonitorChartId;
  title: string;
  subtitle: string;
  mounted: boolean;
};

export type MonitorAiActiveHighlightRef = {
  chartId: MonitorChartId;
  category?: string;
  seriesKey?: string;
  datasetIndex?: number;
  index?: number;
};

export type MonitorAiViewContext = {
  presentationStep: number;
  stepType: MonitorAiViewStepType;
  followPresenter: boolean;
  role: string;
  sectionIndex?: number;
  primaryChartId?: MonitorChartId | null;
  visibleChartIds: MonitorChartId[];
  mountedChartIds: MonitorChartId[];
  chartSurface?: "canvas" | "table";
  visibleCharts?: MonitorAiVisibleChartMeta[];
  activeHighlight?: MonitorAiActiveHighlightRef | null;
};

const VIEW_CONTEXT_KEYS = new Set([
  "presentationStep",
  "stepType",
  "followPresenter",
  "role",
  "sectionIndex",
  "primaryChartId",
  "visibleChartIds",
  "mountedChartIds",
  "chartSurface",
  "visibleCharts",
  "activeHighlight",
]);

const STEP_TYPES = new Set<string>(["inicio", "explica", "hoja", "cierre", "other"]);

export function parseMonitorAiViewContext(raw: unknown): MonitorAiViewContext | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  for (const key of Object.keys(o)) {
    if (!VIEW_CONTEXT_KEYS.has(key)) return null;
  }
  const presentationStep = o.presentationStep;
  if (!Number.isInteger(presentationStep) || (presentationStep as number) < 0) return null;
  const stepType = String(o.stepType ?? "other");
  if (!STEP_TYPES.has(stepType)) return null;
  const followPresenter = o.followPresenter === true;
  const role = String(o.role ?? "").trim().slice(0, 32);
  if (!role) return null;

  const visibleChartIds = parseChartIdList(o.visibleChartIds, 24);
  if (visibleChartIds === null) return null;
  const mountedChartIds = parseChartIdList(o.mountedChartIds, 24);
  if (mountedChartIds === null) return null;

  let sectionIndex: number | undefined;
  if (o.sectionIndex !== undefined && o.sectionIndex !== null) {
    if (!Number.isInteger(o.sectionIndex) || (o.sectionIndex as number) < 0) return null;
    sectionIndex = o.sectionIndex as number;
  }

  let primaryChartId: MonitorChartId | null | undefined;
  if (o.primaryChartId !== undefined && o.primaryChartId !== null) {
    const cid = String(o.primaryChartId).trim();
    if (!isMonitorChartId(cid)) return null;
    primaryChartId = cid;
    if (!visibleChartIds.includes(cid)) return null;
  } else if (o.primaryChartId === null) {
    primaryChartId = null;
  }

  let chartSurface: "canvas" | "table" | undefined;
  if (o.chartSurface === "canvas" || o.chartSurface === "table") {
    chartSurface = o.chartSurface;
  }

  let visibleCharts: MonitorAiVisibleChartMeta[] | undefined;
  if (o.visibleCharts !== undefined && o.visibleCharts !== null) {
    if (!Array.isArray(o.visibleCharts) || o.visibleCharts.length > 24) return null;
    visibleCharts = [];
    for (const item of o.visibleCharts) {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const cid = String(row.chartId ?? "").trim();
      if (!isMonitorChartId(cid)) return null;
      if (!visibleChartIds.includes(cid)) return null;
      const title = String(row.title ?? "").trim().slice(0, 120);
      const subtitle = String(row.subtitle ?? "").trim().slice(0, 120);
      if (!title || !subtitle) return null;
      visibleCharts.push({
        chartId: cid,
        title,
        subtitle,
        mounted: row.mounted === true,
      });
    }
  }

  let activeHighlight: MonitorAiActiveHighlightRef | null | undefined;
  if (o.activeHighlight !== undefined && o.activeHighlight !== null) {
    if (typeof o.activeHighlight !== "object") return null;
    const h = o.activeHighlight as Record<string, unknown>;
    const cid = String(h.chartId ?? "").trim();
    if (!isMonitorChartId(cid)) return null;
    activeHighlight = {
      chartId: cid,
      category:
        typeof h.category === "string" && h.category.trim()
          ? h.category.trim().slice(0, 120)
          : undefined,
      seriesKey:
        typeof h.seriesKey === "string" ? h.seriesKey.trim().slice(0, 80) : undefined,
      datasetIndex:
        Number.isInteger(h.datasetIndex) ? (h.datasetIndex as number) : undefined,
      index: Number.isInteger(h.index) ? (h.index as number) : undefined,
    };
  } else if (o.activeHighlight === null) {
    activeHighlight = null;
  }

  return {
    presentationStep: presentationStep as number,
    stepType: stepType as MonitorAiViewStepType,
    followPresenter,
    role,
    sectionIndex,
    primaryChartId,
    visibleChartIds,
    mountedChartIds,
    chartSurface,
    visibleCharts,
    activeHighlight,
  };
}

function parseChartIdList(raw: unknown, max: number): MonitorChartId[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length > max) return null;
  const out: MonitorChartId[] = [];
  for (const item of raw) {
    const id = String(item).trim();
    if (!isMonitorChartId(id)) return null;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

/** ¿La gráfica objetivo está en la vista que el cliente declara? */
export function highlightAllowedForView(
  chartId: MonitorChartId,
  view: MonitorAiViewContext | undefined,
): boolean {
  if (!view) return false;
  if (view.stepType === "inicio" || view.stepType === "cierre") return false;
  if (!view.visibleChartIds.includes(chartId)) return false;
  return true;
}

export function resolveHighlightDeliveryStatus(
  chartId: MonitorChartId,
  view: MonitorAiViewContext | undefined,
): MonitorAiHighlightStatus {
  if (!highlightAllowedForView(chartId, view)) return "not_visible";
  if (!view!.mountedChartIds.includes(chartId)) return "not_visible";
  return "applied";
}
