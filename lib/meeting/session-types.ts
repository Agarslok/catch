import type { ChartKind, MunFilter } from "@/lib/data/guanajuato-2026";
import type { ChartAction } from "@/lib/visualization/types";
import type { MonitorSessionPhase } from "./monitor-session-phase";
import type { PresentedChart, SessionScript } from "./script-types";

export type MeetingPresentationStatus = "live" | "paused";

export type MeetingGlobalView = {
  munFilter?: MunFilter;
  chartKind?: ChartKind;
  highlight?: { category?: string; seriesKey?: string };
  /** Pausa del video del avatar (solo el presentador puede cambiarlo). */
  avatarVideoPaused?: boolean;
  /** Fase del monitor HTML / flujo pre-reunión (Supabase Realtime). */
  monitorSessionPhase?: MonitorSessionPhase;
  /** Fase 8: la sección actual espera autorización del moderador. */
  awaitingModerator?: boolean;
  sectionAwaitSectionId?: string | null;
  sectionAwaitSectionLabel?: string | null;
  /** Último punto presentado antes del cierre de sección. */
  sectionClosedPointId?: string | null;
};

export type MeetingStateRow = {
  meeting_id: string;
  current_step: number;
  unlocked_step: number;
  current_point_id: string | null;
  presentation_status: MeetingPresentationStatus;
  global_view: MeetingGlobalView;
  event_seq: number;
  script: SessionScript | null;
  presented_charts: PresentedChart[];
  updated_at: string;
};

export type PublishStateInput = {
  currentStep?: number;
  currentPointId?: string;
  unlockedStep?: number;
  reset?: boolean;
  presentationStatus?: MeetingPresentationStatus;
  globalView?: Partial<MeetingGlobalView>;
  action?: ChartAction;
  script?: SessionScript;
};

export type MeetingQuestionStatus = "open" | "answered" | "dismissed";

export type MeetingQueueRequestKind =
  | "written_question"
  | "assistant_to_presenter"
  | "ai_escalation"
  | "oral_turn"
  | "clarity_doubt";

export type MeetingQuestionRow = {
  id: string;
  meeting_id: string;
  participant_id: string;
  section_key: string;
  section_label: string;
  presentation_point_id?: string | null;
  request_kind: MeetingQueueRequestKind;
  source: string;
  text: string | null;
  status: MeetingQuestionStatus;
  answer_text: string | null;
  created_at: string;
  answered_at: string | null;
  dismissed_at: string | null;
};

export type ClarityVote = "claro" | "duda" | "glosario" | "explorar";

export type MeetingClarityRow = {
  meeting_id: string;
  section_key: string;
  participant_id: string;
  vote: ClarityVote;
  updated_at: string;
};
