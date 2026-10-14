import { getCatalogEntry } from "./catalog";
import { getDatasetEntry } from "./datasets";
import {
  CHART_ACTION_TYPES,
  VISUALIZATION_IDS,
  type ActionValidationResult,
  type ChartAction,
  type ChartActionType,
  type ActionScope,
  type FilterAction,
  type HighlightAction,
  type ShowChartAction,
  type VisualizationId,
} from "./types";

const MUN_FILTERS = new Set(["total", "controlada", "nocontrolada"]);
const CHART_KINDS = new Set(["bar", "pie"]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isVisualizationId(v: unknown): v is VisualizationId {
  return typeof v === "string" && VISUALIZATION_IDS.includes(v as VisualizationId);
}

function isActionType(v: unknown): v is ChartActionType {
  return typeof v === "string" && CHART_ACTION_TYPES.includes(v as ChartActionType);
}

function isActionScope(v: unknown): v is ActionScope {
  return v === "global" || v === "local";
}

export function validateChartAction(raw: unknown): ActionValidationResult {
  const errors: string[] = [];
  if (!isRecord(raw)) {
    return { ok: false, errors: ["action must be an object"] };
  }

  const type = raw.type;
  if (!isActionType(type)) {
    return { ok: false, errors: ["invalid or missing action type"] };
  }

  if (!isActionScope(raw.scope)) {
    return { ok: false, errors: ["scope must be global or local"] };
  }
  const scope = raw.scope;

  switch (type) {
    case "show_chart": {
      const visualizationId = raw.visualizationId;
      const datasetKey = raw.datasetKey;
      if (!isVisualizationId(visualizationId)) {
        errors.push("visualizationId not in catalog");
      }
      if (typeof datasetKey !== "string" || !getDatasetEntry(datasetKey)) {
        errors.push("datasetKey not registered");
      }
      if (errors.length) return { ok: false, errors };
      const vizId = visualizationId as VisualizationId;
      const key = datasetKey as string;
      getCatalogEntry(vizId);
      const action: ShowChartAction = {
        type: "show_chart",
        scope,
        visualizationId: vizId,
        datasetKey: key,
      };
      return { ok: true, action };
    }
    case "highlight": {
      const category =
        typeof raw.category === "string" ? raw.category.trim() : undefined;
      const seriesKey =
        typeof raw.seriesKey === "string" ? raw.seriesKey.trim() : undefined;
      if (!category && !seriesKey) {
        errors.push("highlight requires category or seriesKey");
      }
      if (errors.length) return { ok: false, errors };
      const action: HighlightAction = {
        type: "highlight",
        scope,
        category,
        seriesKey,
      };
      return { ok: true, action };
    }
    case "filter": {
      const dimension = raw.dimension;
      const value = typeof raw.value === "string" ? raw.value : "";
      if (
        dimension !== "munFilter" &&
        dimension !== "chartKind" &&
        dimension !== "category"
      ) {
        errors.push("invalid filter dimension");
        return { ok: false, errors };
      }
      if (dimension === "munFilter" && !MUN_FILTERS.has(value)) {
        errors.push("invalid munFilter value");
      }
      if (dimension === "chartKind" && !CHART_KINDS.has(value)) {
        errors.push("invalid chartKind value");
      }
      if (dimension === "category" && !value.trim()) {
        errors.push("category filter requires value");
      }
      if (errors.length) return { ok: false, errors };
      const action: FilterAction = {
        type: "filter",
        scope,
        dimension,
        value,
      };
      return { ok: true, action };
    }
    case "zoom": {
      const action = {
        type: "zoom" as const,
        scope,
        startCategory:
          typeof raw.startCategory === "string" ? raw.startCategory : undefined,
        endCategory:
          typeof raw.endCategory === "string" ? raw.endCategory : undefined,
      };
      return { ok: true, action };
    }
    case "open_detail": {
      const entityId = typeof raw.entityId === "string" ? raw.entityId.trim() : "";
      if (!entityId) errors.push("open_detail requires entityId");
      if (errors.length) return { ok: false, errors };
      return {
        ok: true,
        action: { type: "open_detail", scope, entityId },
      };
    }
    case "reset_view": {
      return { ok: true, action: { type: "reset_view", scope } };
    }
    default:
      return { ok: false, errors: ["unsupported action"] };
  }
}

export function parseChartActionFromJson(json: string): ActionValidationResult {
  try {
    const parsed = JSON.parse(json) as unknown;
    return validateChartAction(parsed);
  } catch {
    return { ok: false, errors: ["invalid JSON"] };
  }
}

/** Acciones que solo deben afectar al cliente que pregunta. */
export function isLocalOnlyAction(action: ChartAction): boolean {
  return action.scope === "local";
}
