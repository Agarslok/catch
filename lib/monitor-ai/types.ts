import type { MonitorAiViewContext } from "./view-context";

/** Contrato estable: catch.monitor.ai.v1 */
export const MONITOR_AI_CONTRACT_VERSION = "catch.monitor.ai.v1";

export type MonitorSectionKey =
  | "muestra"
  | "salarios"
  | "beneficios"
  | "indicadores"
  | "patrones";

export type MonitorChartId =
  | "plantilla"
  | "procesos"
  | "tier"
  | "tamano"
  | "edad"
  | "salini"
  | "escalera"
  | "incremento"
  | "mes"
  | "beneficios"
  | "incben"
  | "negociacion"
  | "capacitacion"
  | "rotserie"
  | "mixcontrata"
  | "rotcomp"
  | "causas"
  | "ausentismo"
  | "salrot"
  | "plantbubble"
  | "rotmapa"
  | "perfilradar";

export type MonitorSectionIndex = 0 | 1 | 2 | 3 | 4;

export type MonitorAiCallerRole = "moderador" | "visitor";

export type MonitorAiHighlightStatus =
  | "applied"
  | "not_visible"
  | "failed"
  | "rejected"
  | null;

export type MonitorAiChatRequestBody = {
  question?: string;
  sectionIndex?: number;
  sectionKey?: string;
  chartId?: string | null;
  presentationStep?: number;
  viewContext?: Record<string, unknown>;
  contextBlock?: string;
  editionLabel?: string;
  participantId?: string;
};

export type MonitorChartElementRef = {
  chartId: MonitorChartId;
  category?: string;
  seriesKey?: string;
  datasetIndex?: number;
  index?: number;
};

export type MonitorAiHighlightAction = {
  type: "highlight";
  target: MonitorChartElementRef;
  reason?: string;
};

export type MonitorAiAction = MonitorAiHighlightAction;

export type MonitorAiInterpreter = "gemini" | "unavailable";

export type MonitorAiChatSuccess = {
  contract: typeof MONITOR_AI_CONTRACT_VERSION;
  meetingId: string;
  message: string;
  interpreter: MonitorAiInterpreter;
  action: MonitorAiAction | null;
  meta?: {
    sectionKey?: MonitorSectionKey;
    chartId?: MonitorChartId | null;
    providerCalled: boolean;
    highlightStatus?: MonitorAiHighlightStatus;
  };
};

export type MonitorAiErrorCode =
  | "INVALID_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "CONTEXT_TOO_LARGE"
  | "AI_TIMEOUT"
  | "AI_PROVIDER_ERROR"
  | "AI_EMPTY_RESPONSE"
  | "SERVICE_UNAVAILABLE";

export type MonitorAiChatErrorBody = {
  contract: typeof MONITOR_AI_CONTRACT_VERSION;
  error: {
    code: MonitorAiErrorCode;
    message: string;
  };
};

export type MonitorAiValidatedRequest = {
  meetingId: string;
  question: string;
  sectionIndex?: MonitorSectionIndex;
  sectionKey?: MonitorSectionKey;
  chartId?: MonitorChartId | null;
  presentationStep?: number;
  contextForProvider: string;
  editionLabel?: string;
  viewContext?: MonitorAiViewContext;
  caller: {
    role: MonitorAiCallerRole;
    participantId?: string;
  };
};
