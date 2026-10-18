import type { InteractionEventType } from "./types";

export type PresentationNavKind =
  | "presentation.navigated_forward"
  | "presentation.navigated_back"
  | "presentation.section_selected";

export function presentationNavMetadata(input: {
  fromPointId: string;
  toPointId: string;
  fromIndex: number;
  toIndex: number;
  sectionId?: string | null;
  sectionName?: string | null;
  follow?: boolean;
}): Record<string, unknown> {
  return {
    from_point_id: input.fromPointId,
    to_point_id: input.toPointId,
    from_index: input.fromIndex,
    to_index: input.toIndex,
    section_id: input.sectionId ?? null,
    section_name: input.sectionName ?? null,
    follow: input.follow ?? false,
  };
}

export function navEventForDirection(
  direction: 1 | -1,
): PresentationNavKind {
  return direction === 1
    ? "presentation.navigated_forward"
    : "presentation.navigated_back";
}

export function excerptText(text: string, max = 240): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export const VISITOR_INTERACTIVE_EVENT_TYPES: InteractionEventType[] = [
  "chart.viewed",
  "element.clicked",
  "detail.opened",
  "detail.closed",
  "filter.changed",
  "chart_type.changed",
  "explore.started",
  "explore.returned_to_presentation",
  "presentation.navigated_forward",
  "presentation.navigated_back",
  "presentation.section_selected",
  "question.asked",
  "question.answered",
  "question.private_opened",
];
