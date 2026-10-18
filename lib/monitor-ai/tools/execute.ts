import {
  compareClientToMarketQuery,
  getMarketMetricQuery,
  getQuerySessionMeta,
  getSectionSummary,
  MonitorDataQueryError,
} from "@/lib/monitor-data/queries";
import {
  buildClearActionFromProposal,
  buildHighlightActionFromProposal,
} from "../validate-highlight";
import type { MonitorAiToolName } from "./definitions";

export type ToolExecutionResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string; code: string };

export function executeMonitorAiTool(
  name: string,
  args: Record<string, unknown>,
): ToolExecutionResult {
  if (!isToolName(name)) {
    return { ok: false, code: "UNKNOWN_TOOL", error: "Función no permitida." };
  }

  try {
    const meta = getQuerySessionMeta();
    switch (name) {
      case "get_section_summary": {
        const sectionKey = String(args.sectionKey ?? "");
        const filters = args.filters as Record<string, unknown> | undefined;
        const data = getSectionSummary(sectionKey, filters);
        return { ok: true, data: { ...data, session: meta } };
      }
      case "get_market_metric": {
        const metric = String(args.metric ?? "");
        const bimestreIndex =
          args.bimestreIndex !== undefined ? Number(args.bimestreIndex) : undefined;
        const filters = args.filters as Record<string, unknown> | undefined;
        const data = getMarketMetricQuery(metric, bimestreIndex, filters);
        return { ok: true, data: { ...data, session: meta } };
      }
      case "compare_client_to_market": {
        const metric = String(args.metric ?? "");
        const bimestreIndex =
          args.bimestreIndex !== undefined ? Number(args.bimestreIndex) : undefined;
        const filters = args.filters as Record<string, unknown> | undefined;
        const data = compareClientToMarketQuery(metric, bimestreIndex, filters);
        return { ok: true, data: { ...data, session: meta } };
      }
      case "propose_chart_highlight": {
        const built = buildHighlightActionFromProposal(args);
        if (!built.ok) {
          return {
            ok: false,
            code: "INVALID_HIGHLIGHT",
            error: built.errors.join("; "),
          };
        }
        return {
          ok: true,
          data: {
            accepted: true,
            chartId: built.action.target?.chartId ?? null,
            category: built.action.target?.category ?? null,
          },
        };
      }
      case "clear_chart_highlight": {
        const built = buildClearActionFromProposal(args);
        if (!built.ok) {
          return {
            ok: false,
            code: "INVALID_HIGHLIGHT",
            error: built.errors.join("; "),
          };
        }
        return {
          ok: true,
          data: {
            accepted: true,
            cleared: true,
            chartId: built.action.target?.chartId ?? null,
            category: built.action.target?.category ?? null,
          },
        };
      }
      default:
        return { ok: false, code: "UNKNOWN_TOOL", error: "Función no permitida." };
    }
  } catch (e) {
    if (e instanceof MonitorDataQueryError) {
      return { ok: false, code: e.code, error: e.message };
    }
    return { ok: false, code: "QUERY_FAILED", error: "No se pudo ejecutar la consulta." };
  }
}

function isToolName(name: string): name is MonitorAiToolName {
  return (
    name === "get_section_summary" ||
    name === "get_market_metric" ||
    name === "compare_client_to_market" ||
    name === "propose_chart_highlight" ||
    name === "clear_chart_highlight"
  );
}
