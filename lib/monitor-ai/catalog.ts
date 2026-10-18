import type { MonitorChartId, MonitorSectionIndex, MonitorSectionKey } from "./types";

/** Índices y claves alineados con SECCIONES en monitor-en-vivo-catch.html */
export const MONITOR_SECTION_KEYS: MonitorSectionKey[] = [
  "muestra",
  "salarios",
  "beneficios",
  "indicadores",
  "patrones",
];

export const MONITOR_CHART_IDS: MonitorChartId[] = [
  "plantilla",
  "procesos",
  "tier",
  "tamano",
  "edad",
  "salini",
  "escalera",
  "incremento",
  "mes",
  "beneficios",
  "incben",
  "negociacion",
  "capacitacion",
  "rotserie",
  "mixcontrata",
  "rotcomp",
  "causas",
  "ausentismo",
  "salrot",
  "plantbubble",
  "rotmapa",
  "perfilradar",
];

const SECTION_INDEX_TO_KEY: Record<MonitorSectionIndex, MonitorSectionKey> = {
  0: "muestra",
  1: "salarios",
  2: "beneficios",
  3: "indicadores",
  4: "patrones",
};

/** chartId → sectionIndex (beneficios aparece como sección y como gráfica) */
const CHART_TO_SECTION: Record<MonitorChartId, MonitorSectionIndex> = {
  plantilla: 0,
  procesos: 0,
  tier: 0,
  tamano: 0,
  edad: 0,
  salini: 1,
  escalera: 1,
  incremento: 1,
  mes: 1,
  beneficios: 2,
  incben: 2,
  negociacion: 2,
  capacitacion: 2,
  rotserie: 3,
  mixcontrata: 3,
  rotcomp: 3,
  causas: 3,
  ausentismo: 3,
  salrot: 4,
  plantbubble: 4,
  rotmapa: 4,
  perfilradar: 4,
};

export function sectionKeyForIndex(index: MonitorSectionIndex): MonitorSectionKey {
  return SECTION_INDEX_TO_KEY[index];
}

export function isMonitorSectionKey(v: string): v is MonitorSectionKey {
  return (MONITOR_SECTION_KEYS as string[]).includes(v);
}

export function isMonitorChartId(v: string): v is MonitorChartId {
  return (MONITOR_CHART_IDS as string[]).includes(v);
}

export function isMonitorSectionIndex(n: number): n is MonitorSectionIndex {
  return Number.isInteger(n) && n >= 0 && n <= 4;
}

export function sectionIndexForChart(chartId: MonitorChartId): MonitorSectionIndex {
  return CHART_TO_SECTION[chartId];
}

export function chartBelongsToSection(
  chartId: MonitorChartId,
  sectionIndex: MonitorSectionIndex,
): boolean {
  return CHART_TO_SECTION[chartId] === sectionIndex;
}
