export const SCRIPT_POINT_KINDS = [
  "introduction",
  "chart",
  "full_sheet",
  "section_summary",
  "clarity_check",
  "doubt_resolution",
  "closing",
] as const;

export type ScriptPointKind = (typeof SCRIPT_POINT_KINDS)[number];

export type ScriptChartRef = {
  id: string;
  title: string;
  chapterIndex: number;
  beat: number;
};

export type ScriptPoint = {
  id: string;
  sectionId: string | null;
  kind: ScriptPointKind;
  title: string;
  order: number;
  narrative: string;
  chartRefs: ScriptChartRef[];
  dataRef?: string;
};

export type ScriptSection = {
  id: string;
  name: string;
  order: number;
  summary: string;
  pointIds: string[];
};

export type SessionScript = {
  id: string;
  meetingId: string;
  version: number;
  generatedAt: string;
  source: "authorized_data";
  title: string;
  sections: ScriptSection[];
  points: ScriptPoint[];
  warnings: string[];
};

export type PresentedChart = {
  key: string;
  meetingId: string;
  sectionId: string;
  pointId: string;
  chartId: string;
  title: string;
  chapterIndex: number;
  beat: number;
  order: number;
};

export type LocalExploreMode = "follow" | "explore" | "summary_origin";
