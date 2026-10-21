import type { MonitorChartId, MonitorSectionKey } from "@/lib/monitor-ai/types";
import { MONITOR_CHARTS_BY_SECTION } from "@/lib/meeting/monitor-pasos";
import { getMonitorDataset } from "@/lib/monitor-data/dataset";
import { DAEL_GEMINI_FIXED_RULES } from "./dael-gemini-rules";

export const DAEL_WELCOME_AVATAR_TEXT =
  "Hoy vemos el mercado completo: 40 empresas y 35,128 empleados. Nadie ve los datos de otra empresa. Al terminar, cada una entra con su usuario y recibe su propia lectura frente al mercado.";

export const DAEL_CLOSING_SYNTHESIS =
  "Sesión cerrada. Rotación 8.1% (10.8% hace un año); 67% de las bajas antes del primer año; 2026 entre 33% y 44% anual (38% central). Asociaciones, no certezas. Ahora cada empresa a su ritmo.";

const SECTION_HOJA_NARRATION: Record<number, string> = {
  0: "¿Quedó claro quién forma la muestra? Pueden filtrar por Tier o tamaño.",
  1: "¿Quedó claro el salario de ingreso y la escalera frente al mercado?",
  2: "¿Quedó claro el paquete de prestaciones?",
  3: "¿Quedó clara la rotación, el antes del año y la mediana vs promedio?",
  4: "¿Quedó claro el pronóstico 2026 y qué factores se asocian con la rotación?",
};

const CHART_SECTION_LEAD: Partial<Record<MonitorChartId, string>> = {
  plantilla:
    "Quién está en el benchmark antes de ver rotación o salarios.",
  salini: "¿Cuánto se paga al ingresar?",
  beneficios: "Qué más incluye el paquete además del salario.",
  rotserie: "Dónde duele: la rotación del mercado.",
  prediccion: "Qué esperar en 2026 y con qué incertidumbre.",
  salrot: "Qué se asocia con más o menos bajas — sin afirmar causa.",
};

function firstChartInSection(chartId: MonitorChartId): boolean {
  for (const charts of MONITOR_CHARTS_BY_SECTION) {
    if (charts[0] === chartId) return true;
    if (charts.includes(chartId)) return false;
  }
  return false;
}

export function sectionLeadForChart(chartId: MonitorChartId): string | null {
  if (!firstChartInSection(chartId)) return null;
  return CHART_SECTION_LEAD[chartId] ?? null;
}

export function withSectionLead(chartId: MonitorChartId, body: string): string {
  const lead = sectionLeadForChart(chartId);
  if (!lead) return body;
  return `${lead} ${body}`;
}

export function hojaNarrationForSection(sectionIndex: number): string {
  return (
    SECTION_HOJA_NARRATION[sectionIndex] ??
    "¿Esta sección quedó clara? Este es el momento para preguntar al presentador."
  );
}

function sampleFacts(): string {
  const datos = getMonitorDataset();
  const sx = datos.mercado?.sintesis;
  const m = datos.mercado;
  return [
    `Edición ${datos.edicion}. Síntesis DAEL (6 slides): Contexto → Insights → Qué viene.`,
    sx
      ? `Muestra: ${sx.empresas} empresas, ${sx.empleados} empleados; ${(sx.composicion?.op ?? 0.7) * 100}% operativo; ${(sx.mujeres?.pct ?? 0.386) * 100}% mujeres (n=${sx.mujeres?.n ?? 37}). Salario mediana $${sx.salario?.mediana ?? 340} (P25–P75 $${sx.salario?.p25 ?? 300}–$${sx.salario?.p75 ?? 370}).`
      : "",
    m?.rotacionEdicion
      ? `Rotación ${(m.rotacionEdicion.mercado ?? 0.0813) * 100}% Jul–Ago 2025; voluntaria ${(m.rotacionEdicion.voluntaria ?? 0.0559) * 100}%; mediana ${(m.rotacionEdicion.mediana ?? 0.0728) * 100}%.`
      : "",
    m?.cuandosevan
      ? `Antes del año: ${(m.cuandosevan.antesPrimerAno ?? 0.67) * 100}% (n=${m.cuandosevan.nEmpresas ?? 38}).`
      : "",
    m?.prediccion
      ? `2026: ${(m.prediccion.rot2026 ?? 0.38) * 100}% si sigue la tendencia (rango del 80%: ${(m.prediccion.lo80 ?? 0.33) * 100}–${(m.prediccion.hi80 ?? 0.44) * 100}%; si se detiene ${(m.prediccion.siSeDetiene ?? 0.41) * 100}%; ${sx?.segmentos?.altoRiesgo ?? 10} empresas en alto riesgo).`
      : "",
    "Paquete operativo: vales 10%, fondo 8.3%, prima 50%, aguinaldo 20 días, comedor 60%. Beneficios movidos: 33% ninguno, vales 45%, fondo 40%, incremento 2.9%. Abril: 43% de las revisiones.",
    sx?.drivers
      ? `Driver salario sobre mercado: OR ${sx.drivers.orSalario ?? 0.71} (asociación, no causa).`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildGeminiReferenceBlock(opts?: {
  sectionKey?: MonitorSectionKey;
  chartId?: MonitorChartId | null;
}): string {
  const parts = [DAEL_GEMINI_FIXED_RULES, sampleFacts()];
  if (opts?.sectionKey) parts.push(`Sección activa: ${opts.sectionKey}.`);
  if (opts?.chartId) parts.push(`Gráfica (chartId): ${opts.chartId}.`);
  return parts.join("\n\n");
}
