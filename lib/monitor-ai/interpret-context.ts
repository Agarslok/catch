import {
  MONITOR_CHART_IDS,
  MONITOR_SECTION_KEYS,
  sectionIndexForChart,
  sectionKeyForIndex,
} from "./catalog";
import { MONITOR_CHART_UI } from "./chart-metadata";
import { highlightOptionsForChart } from "./highlight-elements";
import type { MonitorChartId, MonitorSectionIndex, MonitorSectionKey } from "./types";
import {
  listAvailablePresentationActions,
  PRESENTATION_ACTION_CATALOG,
  type PresentationActionType,
  type PresentationControllerSnapshot,
} from "./action-contract";
import { planMonitorNarration } from "@/lib/meeting/monitor-narration-plan";
import { buildMonitorPasos } from "@/lib/meeting/monitor-pasos";
import { getChartSpeakParagraph } from "@/lib/monitor-data/chart-speak-text";
import { getQuerySessionMeta, getSectionSummary } from "@/lib/monitor-data/queries";
import { getSectionName } from "@/lib/monitor-data/sections";

export const MAX_INTERPRET_CONTEXT_CHARS = 8_000;

export type CatalogSectionRef = {
  key: MonitorSectionKey;
  index: MonitorSectionIndex;
  name: string;
};

export type CatalogChartRef = {
  id: MonitorChartId;
  title: string;
  sectionKey: MonitorSectionKey;
};

export type InstructionMatch =
  | { kind: "section"; sectionKey: MonitorSectionKey; sectionIndex: MonitorSectionIndex }
  | { kind: "chart"; chartId: MonitorChartId; sectionKey: MonitorSectionKey }
  | {
      kind: "ambiguous";
      options: Array<{ type: "section" | "chart"; id: string; label: string }>;
    }
  | { kind: "not_found"; query: string }
  | { kind: "none" };

export type InterpretAnalyticsSlice = {
  sectionKey: MonitorSectionKey;
  sectionName: string;
  kpis: Array<{ label: string; value: string | number; client?: boolean }>;
  chartId?: MonitorChartId;
  speakText?: string;
  highlightOptions?: string[];
};

export type InterpretModelContext = {
  meetingId: string;
  dataSource: "demo_dataset";
  session: ReturnType<typeof getQuerySessionMeta>;
  controller: {
    stepIndex: number;
    stepKind: string;
    presentationStatus: PresentationControllerSnapshot["presentationStatus"];
    awaitingModerator: boolean;
  };
  availableActions: PresentationActionType[];
  pendingActions: PresentationActionType[];
  catalogs: {
    sections: CatalogSectionRef[];
    charts: CatalogChartRef[];
  };
  current: {
    speakText: string | null;
    chartId: MonitorChartId | null;
    sectionKey: MonitorSectionKey | null;
  };
  analytics: InterpretAnalyticsSlice[];
  instructionMatch: InstructionMatch;
  highlightHint?: string;
};

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúüñ\s-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SECTION_ALIASES: Record<MonitorSectionKey, string[]> = {
  muestra: ["muestra", "contexto", "contexto y muestra", "primera seccion", "primera sección"],
  salarios: ["salarios", "personal y salarios", "sueldos", "salario"],
  beneficios: ["beneficios"],
  indicadores: ["indicadores"],
  patrones: ["patrones", "patrones y relaciones"],
};

function sectionCatalog(): CatalogSectionRef[] {
  return MONITOR_SECTION_KEYS.map((key, i) => ({
    key,
    index: i as MonitorSectionIndex,
    name: getSectionName(key),
  }));
}

function chartCatalog(): CatalogChartRef[] {
  return MONITOR_CHART_IDS.map((id) => ({
    id,
    title: MONITOR_CHART_UI[id].title,
    sectionKey: sectionKeyForIndex(sectionIndexForChart(id)),
  }));
}

function uniquePush<T>(arr: T[], item: T, key: (v: T) => string): void {
  if (!arr.some((x) => key(x) === key(item))) arr.push(item);
}

function includesPhrase(haystack: string, needle: string): boolean {
  const n = fold(needle);
  if (!n) return false;
  const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`).test(haystack);
}

const CHART_ALIASES: Partial<Record<MonitorChartId, string[]>> = {
  ausentismo: ["ausentismo"],
  rotcomp: ["rotacion por compania", "rotacion por empresa"],
  rotserie: ["rotacion bimestral"],
  causas: ["causas de rotacion"],
  mixcontrata: ["contrataciones"],
  salini: ["salario diario inicial"],
  plantilla: ["tipo de personal"],
};

function matchingSections(text: string): CatalogSectionRef[] {
  const f = fold(text);
  const out: CatalogSectionRef[] = [];
  for (const sec of sectionCatalog()) {
    const aliases = [sec.key, sec.name, ...(SECTION_ALIASES[sec.key] ?? [])];
    if (aliases.some((a) => includesPhrase(f, a))) uniquePush(out, sec, (s) => s.key);
  }
  return out;
}

function matchingCharts(text: string): CatalogChartRef[] {
  const f = fold(text);
  const catalog = chartCatalog();
  const exact: CatalogChartRef[] = [];
  const loose: CatalogChartRef[] = [];
  for (const ch of catalog) {
    const aliases = CHART_ALIASES[ch.id] ?? [];
    if (includesPhrase(f, ch.id) || includesPhrase(f, ch.title) || aliases.some((a) => includesPhrase(f, a))) {
      uniquePush(exact, ch, (c) => c.id);
      continue;
    }
    const words = fold(ch.title).split(" ").filter((w) => w.length >= 8);
    if (words.some((w) => includesPhrase(f, w))) uniquePush(loose, ch, (c) => c.id);
  }
  return exact.length ? exact : loose;
}

const NAV_HINT =
  /\b(ve|ir|vamos|abre|salta|mostrar|muestrame|ensena|ensenar|regresa|regresar|vuelve|volver|seccion|secciones|grafica|grafico|chart)\b/i;

export function matchInstructionTargets(instruction: string): InstructionMatch {
  const text = instruction.trim();
  if (!text) return { kind: "none" };
  const f = fold(text);
  const wantsSection = /\bseccion(es)?\b/.test(f);
  const wantsChart = /\b(grafica|grafico|chart|visualizacion)\b/.test(f);
  const wantsNav = NAV_HINT.test(text) || wantsSection || wantsChart;
  const sections = matchingSections(text);
  const charts = matchingCharts(text);

  const ambiguous = (): InstructionMatch => {
    const options = [
      ...sections.map((s) => ({ type: "section" as const, id: s.key, label: s.name })),
      ...charts.map((c) => ({ type: "chart" as const, id: c.id, label: c.title })),
    ];
    return { kind: "ambiguous", options };
  };

  if (wantsNav) {
    if (wantsSection && !wantsChart) {
      if (sections.length === 1) {
        return {
          kind: "section",
          sectionKey: sections[0].key,
          sectionIndex: sections[0].index,
        };
      }
      if (sections.length === 0 && charts.length === 1) {
        return { kind: "chart", chartId: charts[0].id, sectionKey: charts[0].sectionKey };
      }
      if (sections.length > 1 || charts.length > 1) return ambiguous();
    } else if (wantsChart && !wantsSection) {
      if (charts.length === 1) {
        return { kind: "chart", chartId: charts[0].id, sectionKey: charts[0].sectionKey };
      }
      if (charts.length > 1) return ambiguous();
      if (sections.length === 1) {
        const inSection = chartCatalog().filter((c) => c.sectionKey === sections[0].key);
        if (inSection.length === 1) {
          return { kind: "chart", chartId: inSection[0].id, sectionKey: inSection[0].sectionKey };
        }
        if (inSection.length > 1) {
          return {
            kind: "ambiguous",
            options: inSection.map((c) => ({ type: "chart" as const, id: c.id, label: c.title })),
          };
        }
        return {
          kind: "section",
          sectionKey: sections[0].key,
          sectionIndex: sections[0].index,
        };
      }
    } else {
      if (sections.length === 1 && charts.length === 0) {
        return {
          kind: "section",
          sectionKey: sections[0].key,
          sectionIndex: sections[0].index,
        };
      }
      if (charts.length === 1 && sections.length === 0) {
        return { kind: "chart", chartId: charts[0].id, sectionKey: charts[0].sectionKey };
      }
      if (sections.length + charts.length > 1) return ambiguous();
    }
    const query = text.replace(NAV_HINT, "").replace(/\b(a|al|la|de|del|el)\b/gi, " ").trim();
    const qf = fold(query);
    if (qf && /\b(punto|paso|anterior|atras|siguiente)\b/.test(qf) && !wantsSection && !wantsChart) {
      return { kind: "none" };
    }
    if (query) return { kind: "not_found", query: query.slice(0, 80) };
  }

  return { kind: "none" };
}

const HIGHLIGHT_HINT = /resalt\w*\s+(?:el\s+|la\s+|los\s+|las\s+)?["«]?([^"».:,]{2,40})/i;

export function extractHighlightHint(instruction: string): string | undefined {
  const m = instruction.match(HIGHLIGHT_HINT);
  const raw = m?.[1]?.trim();
  if (!raw) return undefined;
  return raw.replace(/\s+mientras\b[\s\S]*/i, "").trim().slice(0, 40) || undefined;
}

function sliceForSection(
  sectionKey: MonitorSectionKey,
  chartId?: MonitorChartId,
): InterpretAnalyticsSlice {
  const summary = getSectionSummary(sectionKey);
  const speak = chartId ? getChartSpeakParagraph(chartId) : null;
  return {
    sectionKey,
    sectionName: summary.sectionName,
    kpis: summary.kpis.map((k) => ({
      label: k.l,
      value: k.v,
      ...(k.t ? { client: true } : {}),
    })),
    chartId,
    speakText: speak ?? undefined,
    highlightOptions: chartId ? highlightOptionsForChart(chartId, 8) : undefined,
  };
}

function currentChartId(stepIndex: number): MonitorChartId | null {
  const paso = buildMonitorPasos()[stepIndex];
  if (paso?.tipo === "explica") return paso.chartId;
  return null;
}

function currentSectionKey(stepIndex: number): MonitorSectionKey | null {
  const paso = buildMonitorPasos()[stepIndex];
  if (paso?.tipo === "explica" || paso?.tipo === "hoja") {
    return sectionKeyForIndex(paso.sectionIndex);
  }
  return null;
}

export function buildInterpretModelContext(input: {
  meetingId: string;
  instruction: string;
  snapshot: PresentationControllerSnapshot;
}): InterpretModelContext {
  const plan = planMonitorNarration(input.snapshot.stepIndex);
  const availableActions = listAvailablePresentationActions(input.snapshot);
  const pendingActions = (Object.keys(PRESENTATION_ACTION_CATALOG) as PresentationActionType[]).filter(
    (t) => PRESENTATION_ACTION_CATALOG[t].availability === "pending",
  );
  const instructionMatch = matchInstructionTargets(input.instruction);
  const highlightHint = extractHighlightHint(input.instruction);
  const chartId = currentChartId(input.snapshot.stepIndex);
  const sectionKey = currentSectionKey(input.snapshot.stepIndex);

  const analytics: InterpretAnalyticsSlice[] = [];
  if (sectionKey) {
    analytics.push(sliceForSection(sectionKey, chartId ?? undefined));
  }
  if (instructionMatch.kind === "section" && instructionMatch.sectionKey !== sectionKey) {
    analytics.push(sliceForSection(instructionMatch.sectionKey));
  }
  if (instructionMatch.kind === "chart") {
    const already = analytics.some((a) => a.chartId === instructionMatch.chartId);
    if (!already) analytics.push(sliceForSection(instructionMatch.sectionKey, instructionMatch.chartId));
  }

  const ctx: InterpretModelContext = {
    meetingId: input.meetingId,
    dataSource: "demo_dataset",
    session: getQuerySessionMeta(),
    controller: {
      stepIndex: input.snapshot.stepIndex,
      stepKind: plan.stepKind,
      presentationStatus: input.snapshot.presentationStatus,
      awaitingModerator: plan.blockAdvance === true || plan.stepKind === "hoja",
    },
    availableActions,
    pendingActions,
    catalogs: {
      sections: sectionCatalog(),
      charts: chartCatalog(),
    },
    current: {
      speakText: plan.speakText,
      chartId,
      sectionKey,
    },
    analytics,
    instructionMatch,
    highlightHint,
  };

  const encoded = JSON.stringify(ctx);
  if (encoded.length > MAX_INTERPRET_CONTEXT_CHARS) {
    for (const slice of ctx.analytics) {
      if (slice.speakText && slice.speakText.length > 280) {
        slice.speakText = `${slice.speakText.slice(0, 277)}…`;
      }
    }
    if (ctx.current.speakText && ctx.current.speakText.length > 280) {
      ctx.current.speakText = `${ctx.current.speakText.slice(0, 277)}…`;
    }
  }
  return ctx;
}
