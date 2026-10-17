import type { ChartKind, MunFilter } from "@/lib/data/guanajuato-2026";
import type { ChartAction } from "@/lib/visualization/types";
import type { MeetingGlobalView } from "./session-types";

export function emptyGlobalView(): MeetingGlobalView {
  return {};
}

export function mergeGlobalView(
  current: MeetingGlobalView,
  patch: Partial<MeetingGlobalView>,
): MeetingGlobalView {
  return {
    ...current,
    ...patch,
    highlight: patch.highlight !== undefined ? patch.highlight : current.highlight,
  };
}

export function applyChartActionToGlobalView(
  view: MeetingGlobalView,
  action: ChartAction,
): MeetingGlobalView {
  if (action.scope !== "global") return view;
  switch (action.type) {
    case "filter":
      if (action.dimension === "munFilter") {
        return mergeGlobalView(view, {
          munFilter: action.value as MunFilter,
        });
      }
      if (action.dimension === "chartKind") {
        return mergeGlobalView(view, {
          chartKind: action.value as ChartKind,
        });
      }
      return view;
    case "highlight":
      return mergeGlobalView(view, {
        highlight: {
          category: action.category,
          seriesKey: action.seriesKey,
        },
      });
    case "reset_view":
      return emptyGlobalView();
    default:
      return view;
  }
}
