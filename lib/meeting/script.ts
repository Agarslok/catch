import { CHAPTERS } from "@/lib/data/guanajuato-2026";
import { PRESENTATION_HANDOFF_NARRATIVE } from "@/lib/meeting/presentation-handoff";
import { resolveDatasetKeyFromChartFocus } from "@/lib/visualization/datasets";
import { SCRIPT_POINT_KINDS, type PresentedChart, type ScriptPoint, type ScriptPointKind, type ScriptSection, type SessionScript } from "./script-types";

function isKind(v: unknown): v is ScriptPointKind {
  return typeof v === "string" && (SCRIPT_POINT_KINDS as readonly string[]).includes(v);
}

export function generateSessionScript(meetingId: string): SessionScript {
  const warnings: string[] = [];
  const sections: ScriptSection[] = [];
  const points: ScriptPoint[] = [];
  let order = 0;

  points.push({
    id: "intro",
    sectionId: null,
    kind: "introduction",
    title: "Bienvenida y agenda",
    order: order++,
    narrative:
      "Cuatro capítulos con datos del Monitor de Mercado Laboral · Guanajuato · Ene–Feb 2026. En cada uno se presentan las gráficas una a una, luego la hoja completa y, antes de seguir, se confirma si quedó claro.",
    chartRefs: [],
  });

  CHAPTERS.forEach((chapter, chapterIndex) => {
    const datasetKey = resolveDatasetKeyFromChartFocus(chapter.chartFocus);
    if (!datasetKey) {
      warnings.push(`Sin dataset autorizado para ${chapter.t} (${chapter.chartFocus}).`);
      return;
    }

    const sectionId = `sec-${chapter.chartFocus}`;
    const pointIds: string[] = [];

    const beatTitles = [chapter.capA, chapter.capB];
    beatTitles.forEach((cap, beat) => {
      const pointId = `${sectionId}-p${beat}`;
      pointIds.push(pointId);
      points.push({
        id: pointId,
        sectionId,
        kind: "chart",
        title: beat === 0 ? chapter.headline : cap,
        order: order++,
        narrative: cap,
        chartRefs: [
          {
            id: `${chapter.chartFocus}-b${beat}`,
            title: chapter.t,
            chapterIndex,
            beat,
          },
        ],
        dataRef: datasetKey,
      });
    });

    const sheetId = `${sectionId}-sheet`;
    pointIds.push(sheetId);
    points.push({
      id: sheetId,
      sectionId,
      kind: "full_sheet",
      title: `Hoja completa de ${chapter.t}`,
      order: order++,
      narrative: chapter.sub,
      chartRefs: [
        { id: `${chapter.chartFocus}-b0`, title: chapter.capA, chapterIndex, beat: 0 },
        { id: `${chapter.chartFocus}-b1`, title: chapter.capB, chapterIndex, beat: 1 },
      ],
      dataRef: datasetKey,
    });

    const clarityId = `${sectionId}-clarity`;
    pointIds.push(clarityId);
    points.push({
      id: clarityId,
      sectionId,
      kind: "clarity_check",
      title: `¿Quedó claro? · ${chapter.t}`,
      order: order++,
      narrative: `¿Quedó claro lo que vimos en ${chapter.t}?`,
      chartRefs: [],
    });

    sections.push({
      id: sectionId,
      name: chapter.t,
      order: chapterIndex,
      summary: chapter.sub,
      pointIds,
    });
  });

  points.push({
    id: "closing",
    sectionId: null,
    kind: "closing",
    title: "Cierre, preguntas y exportación",
    order: order++,
    narrative: PRESENTATION_HANDOFF_NARRATIVE,
    chartRefs: [],
  });

  const script: SessionScript = {
    id: `script-${meetingId}`,
    meetingId,
    version: 1,
    generatedAt: new Date().toISOString(),
    source: "authorized_data",
    title: "Capital Humano Live · Guanajuato",
    sections,
    points,
    warnings,
  };

  const validated = validateSessionScript(script);
  if (!validated.ok) {
    warnings.push(...validated.errors);
    script.warnings = warnings;
  }
  return script;
}

export type ScriptValidation =
  | { ok: true; script: SessionScript }
  | { ok: false; errors: string[] };

export function validateSessionScript(raw: unknown): ScriptValidation {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object") {
    return { ok: false, errors: ["script must be an object"] };
  }
  const s = raw as SessionScript;
  if (!s.id || !s.meetingId) errors.push("script requires id and meetingId");
  if (!Array.isArray(s.points) || s.points.length === 0) {
    errors.push("script requires at least one point");
  }
  if (!Array.isArray(s.sections)) errors.push("script.sections must be an array");

  const pointIds = new Set<string>();
  (s.points ?? []).forEach((p, i) => {
    if (!p?.id) errors.push(`point[${i}] missing id`);
    else if (pointIds.has(p.id)) errors.push(`duplicate point id: ${p.id}`);
    else pointIds.add(p.id);
    if (!isKind(p?.kind)) errors.push(`point ${p?.id ?? i} has invalid kind`);
    if (typeof p?.order !== "number") errors.push(`point ${p?.id ?? i} missing order`);
    if (p?.kind === "chart" && (!p.chartRefs || p.chartRefs.length === 0)) {
      errors.push(`chart point ${p.id} has no chartRefs`);
    }
    if (p?.kind === "chart" && p.chartRefs) {
      for (const ref of p.chartRefs) {
        if (ref.chapterIndex < 0 || ref.chapterIndex >= CHAPTERS.length) {
          errors.push(`point ${p.id} references unknown chapter ${ref.chapterIndex}`);
        }
      }
    }
  });

  (s.sections ?? []).forEach((sec) => {
    if (!sec?.id) errors.push("section missing id");
    for (const pid of sec.pointIds ?? []) {
      if (!pointIds.has(pid)) errors.push(`section ${sec.id} references missing point ${pid}`);
    }
  });

  if (errors.length) return { ok: false, errors };
  return { ok: true, script: s };
}

export function getPointIndex(script: SessionScript, pointId: string): number {
  return script.points.findIndex((p) => p.id === pointId);
}

export function getPointById(script: SessionScript, pointId: string): ScriptPoint | undefined {
  return script.points.find((p) => p.id === pointId);
}

export function getPointAt(script: SessionScript, index: number): ScriptPoint {
  const i = Math.min(script.points.length - 1, Math.max(0, index));
  return script.points[i];
}

export function clampScriptIndex(script: SessionScript, index: number): number {
  return Math.min(script.points.length - 1, Math.max(0, Math.floor(index)));
}

export function sectionForPoint(
  script: SessionScript,
  point: ScriptPoint,
): ScriptSection | undefined {
  if (!point.sectionId) return undefined;
  return script.sections.find((s) => s.id === point.sectionId);
}

export function isPointUnlocked(
  script: SessionScript,
  pointId: string,
  unlockedIndex: number,
): boolean {
  const i = getPointIndex(script, pointId);
  return i >= 0 && i <= unlockedIndex;
}

export function visitorVisibleSections(
  script: SessionScript,
  unlockedIndex: number,
): ScriptSection[] {
  return script.sections.filter((sec) => {
    const first = sec.pointIds[0];
    if (!first) return false;
    return isPointUnlocked(script, first, unlockedIndex);
  });
}

export function visitorVisiblePoints(
  script: SessionScript,
  unlockedIndex: number,
): ScriptPoint[] {
  return script.points.filter((_, i) => i <= unlockedIndex);
}

export function filterScriptForVisitor(
  script: SessionScript,
  unlockedIndex: number,
): SessionScript {
  const points = visitorVisiblePoints(script, unlockedIndex);
  const ids = new Set(points.map((p) => p.id));
  const sections = visitorVisibleSections(script, unlockedIndex).map((sec) => ({
    ...sec,
    pointIds: sec.pointIds.filter((id) => ids.has(id)),
  }));
  return { ...script, points, sections };
}

export function mergePresentedChart(
  existing: PresentedChart[],
  next: PresentedChart,
): PresentedChart[] {
  if (existing.some((c) => c.key === next.key)) return existing;
  return [...existing, next];
}

export function presentedForSection(
  charts: PresentedChart[],
  sectionId: string,
): PresentedChart[] {
  const seen = new Set<string>();
  return charts
    .filter((c) => c.sectionId === sectionId)
    .sort((a, b) => a.order - b.order)
    .filter((c) => {
      if (seen.has(c.chartId)) return false;
      seen.add(c.chartId);
      return true;
    });
}

export function specialPointId(
  script: SessionScript,
  sectionId: string,
  kind: ScriptPointKind,
): string | null {
  const p = script.points.find((x) => x.sectionId === sectionId && x.kind === kind);
  return p?.id ?? null;
}

export function chapterMeta(chapterIndex: number) {
  return CHAPTERS[chapterIndex];
}

/** Pasos añadidos por error; el HTML recorre explica → hoja → claridad. */
export const HIDDEN_SCRIPT_KINDS: ScriptPointKind[] = [
  "section_summary",
  "doubt_resolution",
];

export function isNavigableKind(kind: ScriptPointKind): boolean {
  return !HIDDEN_SCRIPT_KINDS.includes(kind);
}

export function remapHiddenPoint(script: SessionScript, point: ScriptPoint): ScriptPoint {
  if (isNavigableKind(point.kind) || !point.sectionId) return point;
  if (point.kind === "section_summary") {
    return (
      script.points.find((p) => p.sectionId === point.sectionId && p.kind === "full_sheet") ??
      point
    );
  }
  if (point.kind === "doubt_resolution") {
    return (
      script.points.find((p) => p.sectionId === point.sectionId && p.kind === "clarity_check") ??
      point
    );
  }
  return point;
}

export function adjacentNavigableIndex(
  script: SessionScript,
  from: number,
  direction: 1 | -1,
): number {
  let i = from + direction;
  while (i >= 0 && i < script.points.length) {
    if (isNavigableKind(script.points[i].kind)) return i;
    i += direction;
  }
  return from;
}

export type SheetIndexItem = {
  id: string;
  pointId: string;
  title: string;
  subtitle: string;
  type: "chart" | "table";
  chapterIndex: number;
  beat: number;
};

export function sheetIndexItems(
  script: SessionScript,
  sectionId: string,
): SheetIndexItem[] {
  return script.points
    .filter((p) => p.sectionId === sectionId && p.kind === "chart")
    .flatMap((p) => {
      const ref = p.chartRefs[0];
      const chapter = ref ? chapterMeta(ref.chapterIndex) : undefined;
      const beat = ref?.beat ?? 0;
      const title =
        beat === 0 ? (chapter?.capA ?? p.title) : (chapter?.capB ?? p.title);
      return [
        {
          id: `${p.id}-chart`,
          pointId: p.id,
          title,
          subtitle: chapter ? `${chapter.t} · ${chapter.eyebrow}` : p.title,
          type: "chart" as const,
          chapterIndex: ref?.chapterIndex ?? 0,
          beat,
        },
      ];
    });
}
