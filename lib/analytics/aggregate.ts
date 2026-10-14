import type { InteractionEventRow, SessionRegistryRow } from "./types";
import { ANALYTICS_SCHEMA_VERSION } from "./types";

function countBy<T extends string>(items: T[]): Record<T, number> {
  const out = {} as Record<T, number>;
  for (const item of items) {
    out[item] = (out[item] ?? 0) + 1;
  }
  return out;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export type AggregatedMeetingAnalytics = {
  schema_version: string;
  generated_at: string;
  session: {
    meeting_id: string;
    sessions_observed: number;
    first_event_at: string | null;
    last_event_at: string | null;
    duration_seconds: number | null;
    open_sessions_without_leave: number;
  };
  participation: {
    unique_participants: number;
    unique_sessions: number;
    participants_with_any_interaction: number;
    total_events: number;
    events_per_participant_avg: number | null;
  };
  charts: {
    views_by_chart_id: Record<string, number>;
    unique_participants_by_chart_id: Record<string, number>;
    clicks_by_chart_id: Record<string, number>;
    chart_types_seen: Record<string, number>;
  };
  elements: {
    selections_by_label: Record<string, number>;
    selections_by_element_id: Record<string, number>;
    top_elements: { element_id: string; element_label: string; event_count: number }[];
    least_elements: { element_id: string; element_label: string; event_count: number }[];
  };
  actions: {
    detail_opened: number;
    detail_closed: number;
    filter_changes: number;
    chart_type_changes: number;
    explore_started: number;
    explore_returned: number;
    questions_asked: number;
    by_event_type: Record<string, number>;
  };
  sequences: {
    pairs: { from: string; to: string; count: number }[];
    top_paths: string[];
  };
  timeline: { bucket_start: string; event_count: number }[];
  data_quality: {
    events_available: number;
    sessions_with_join: number;
    sessions_with_leave: number;
    missing_leave_events: number;
    questions_in_aggregate: boolean;
    limitations: string[];
  };
};

export function aggregateMeetingInteractions(
  meetingId: string,
  events: InteractionEventRow[],
  sessions: SessionRegistryRow[],
): AggregatedMeetingAnalytics {
  const sorted = [...events].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const timestamps = sorted.map((e) => e.created_at);
  const first = timestamps[0] ?? null;
  const last = timestamps[timestamps.length - 1] ?? null;
  let duration: number | null = null;
  if (first && last) {
    duration = Math.max(
      0,
      Math.round((new Date(last).getTime() - new Date(first).getTime()) / 1000),
    );
  }

  const participantIds = unique(sorted.map((e) => e.participant_id));
  const sessionIds = unique(sorted.map((e) => e.session_id));
  const interactiveTypes = new Set([
    "element.clicked",
    "detail.opened",
    "filter.changed",
    "chart_type.changed",
    "explore.started",
    "question.asked",
  ]);
  const participantsInteractive = unique(
    sorted.filter((e) => interactiveTypes.has(e.event_type)).map((e) => e.participant_id),
  );

  const viewsByChart: Record<string, number> = {};
  const clicksByChart: Record<string, number> = {};
  const participantsByChart: Record<string, Set<string>> = {};
  const chartTypes: string[] = [];

  for (const e of sorted) {
    if (e.event_type === "chart.viewed" && e.chart_id) {
      viewsByChart[e.chart_id] = (viewsByChart[e.chart_id] ?? 0) + 1;
      participantsByChart[e.chart_id] ??= new Set();
      participantsByChart[e.chart_id].add(e.participant_id);
    }
    if (e.event_type === "element.clicked" && e.chart_id) {
      clicksByChart[e.chart_id] = (clicksByChart[e.chart_id] ?? 0) + 1;
    }
    if (e.chart_type) chartTypes.push(e.chart_type);
  }

  const uniqueParticipantsByChart: Record<string, number> = {};
  for (const [chartId, set] of Object.entries(participantsByChart)) {
    uniqueParticipantsByChart[chartId] = set.size;
  }

  const selectionLabels: string[] = [];
  const selectionIds: string[] = [];
  const elementCounts = new Map<string, { id: string; label: string; count: number }>();

  for (const e of sorted) {
    if (e.event_type === "element.clicked" || e.event_type === "detail.opened") {
      if (e.element_label) selectionLabels.push(e.element_label);
      if (e.element_id) selectionIds.push(e.element_id);
      const key = e.element_id ?? e.element_label ?? "unknown";
      const prev = elementCounts.get(key) ?? {
        id: e.element_id ?? key,
        label: e.element_label ?? key,
        count: 0,
      };
      prev.count += 1;
      elementCounts.set(key, prev);
    }
  }

  const elementList = [...elementCounts.values()]
    .sort((a, b) => b.count - a.count)
    .map((e) => ({
      element_id: e.id,
      element_label: e.label,
      event_count: e.count,
    }));
  const byType = countBy(sorted.map((e) => e.event_type));

  const pairs = new Map<string, number>();
  for (let i = 1; i < sorted.length; i++) {
    const from = sorted[i - 1].event_type;
    const to = sorted[i].event_type;
    const key = `${from}→${to}`;
    pairs.set(key, (pairs.get(key) ?? 0) + 1);
  }
  const pairList = [...pairs.entries()]
    .map(([k, count]) => {
      const [from, to] = k.split("→");
      return { from, to, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const bucketMs = 5 * 60 * 1000;
  const timelineMap = new Map<string, number>();
  for (const e of sorted) {
    const t = new Date(e.created_at).getTime();
    const bucket = new Date(Math.floor(t / bucketMs) * bucketMs).toISOString();
    timelineMap.set(bucket, (timelineMap.get(bucket) ?? 0) + 1);
  }
  const timeline = [...timelineMap.entries()]
    .map(([bucket_start, event_count]) => ({ bucket_start, event_count }))
    .sort((a, b) => a.bucket_start.localeCompare(b.bucket_start));

  const joins = sessions.length;
  const leaves = sessions.filter((s) => s.left_at).length;
  const limitations: string[] = [];
  if (events.length === 0) limitations.push("No hay eventos persistidos para esta reunión.");
  if (joins > leaves) limitations.push("Hay sesiones sin evento session.leave registrado.");
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    limitations.push("Supabase no configurado: eventos solo en cola local.");
  }
  limitations.push(
    "Los participantes se identifican con IDs seudonimizados del navegador; no hay autenticación fuerte.",
  );

  const total = sorted.length;
  const avgEvents =
    participantIds.length > 0 ? Math.round((total / participantIds.length) * 10) / 10 : null;

  return {
    schema_version: ANALYTICS_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    session: {
      meeting_id: meetingId,
      sessions_observed: sessionIds.length,
      first_event_at: first,
      last_event_at: last,
      duration_seconds: duration,
      open_sessions_without_leave: Math.max(0, joins - leaves),
    },
    participation: {
      unique_participants: participantIds.length,
      unique_sessions: sessionIds.length,
      participants_with_any_interaction: participantsInteractive.length,
      total_events: total,
      events_per_participant_avg: avgEvents,
    },
    charts: {
      views_by_chart_id: viewsByChart,
      unique_participants_by_chart_id: uniqueParticipantsByChart,
      clicks_by_chart_id: clicksByChart,
      chart_types_seen: countBy(chartTypes),
    },
    elements: {
      selections_by_label: countBy(selectionLabels),
      selections_by_element_id: countBy(selectionIds),
      top_elements: elementList.slice(0, 10),
      least_elements: [...elementList].reverse().slice(0, 5),
    },
    actions: {
      detail_opened: byType["detail.opened"] ?? 0,
      detail_closed: byType["detail.closed"] ?? 0,
      filter_changes: byType["filter.changed"] ?? 0,
      chart_type_changes: byType["chart_type.changed"] ?? 0,
      explore_started: byType["explore.started"] ?? 0,
      explore_returned: byType["explore.returned_to_presentation"] ?? 0,
      questions_asked: byType["question.asked"] ?? 0,
      by_event_type: byType,
    },
    sequences: {
      pairs: pairList,
      top_paths: pairList.slice(0, 5).map((p) => `${p.from} → ${p.to} (${p.count})`),
    },
    timeline,
    data_quality: {
      events_available: total,
      sessions_with_join: joins,
      sessions_with_leave: leaves,
      missing_leave_events: Math.max(0, joins - leaves),
      questions_in_aggregate: false,
      limitations,
    },
  };
}
