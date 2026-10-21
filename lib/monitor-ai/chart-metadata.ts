import type { MonitorChartId } from "./types";

/**
 * Metadatos de UI alineados con SECCIONES[].graficos en monitor-en-vivo-catch.html.
 * chartId interno (p. ej. plantilla) ≠ título visible; el subtítulo es lo que ve el usuario bajo el gráfico.
 */
export const MONITOR_CHART_UI: Record<
  MonitorChartId,
  { title: string; subtitle: string }
> = {
  plantilla: {
    title: "Empleados por tipo de personal",
    subtitle: "70% operativo · 28% administrativo · 2% otro",
  },
  procesos: { title: "Principales procesos", subtitle: "% de compañías que realizan cada proceso" },
  tier: { title: "Nivel en la cadena automotriz", subtitle: "% de compañías por Tier" },
  tamano: { title: "Empresas de todos los tamaños", subtitle: "10 tienen más de 1,000 empleados" },
  edad: { title: "Edad del personal", subtitle: "Mercado ponderado por empleados contra su empresa" },
  salini: {
    title: "Salario diario inicial",
    subtitle: "Mediana $340 · la mitad paga entre $300 y $370",
  },
  escalera: {
    title: "Escalera salarial",
    subtitle: "$340 al inicio · $561 al máximo · +65%",
  },
  incremento: {
    title: "Incremento 2025",
    subtitle: "7.5% al operativo · 2.9% en beneficios",
  },
  mes: {
    title: "Mes de revisión",
    subtitle: "Abril concentra el 43% de las empresas",
  },
  negociacion: {
    title: "Estatus del contrato colectivo",
    subtitle: "Compañías por etapa de la revisión",
  },
  paquete: {
    title: "Paquete del operativo",
    subtitle: "Mediana del mercado · personal operativo",
  },
  beneficios: {
    title: "Qué se movió además del salario",
    subtitle: "33% solo subió el salario · vales 45% · fondo 40%",
  },
  incben: {
    title: "Incremento en beneficios",
    subtitle: "2.9% al operativo en 2025",
  },
  rotserie: {
    title: "Rotación del mercado",
    subtitle: "8.1% en Jul–Ago 2025 · 10.8% hace un año",
  },
  rotcomp: {
    title: "Cada empresa, sin nombre",
    subtitle: "Mediana 7.3% · promedio 8.1% · la suya en ámbar",
  },
  cuandosevan: {
    title: "Cuándo se van",
    subtitle: "67% antes del primer año · 20% en el primer mes",
  },
  causas: { title: "La causa número uno", subtitle: "Mejor sueldo en otro empleo · 72%" },
  ausentismo: {
    title: "Ausentismo",
    subtitle: "2.25% del mercado en Jul–Ago 2025 · su empresa en ámbar",
  },
  mixcontrata: {
    title: "Contrataciones por bimestre",
    subtitle: "Reposición de bajas frente a posiciones nuevas (mercado)",
  },
  prediccion: {
    title: "Rotación esperada 2026",
    subtitle: "38% si la tendencia sigue · 80% entre 33% y 44%",
  },
  salrot: {
    title: "Qué mueve la rotación",
    subtitle: "Asociación, no causa · su empresa en ámbar",
  },
  perfilradar: {
    title: "Su empresa frente al mercado",
    subtitle: "100 = mejor posición de la muestra en esa dimensión",
  },
};

export function chartUiLabel(chartId: MonitorChartId): string {
  const ui = MONITOR_CHART_UI[chartId];
  if (!ui) return chartId;
  return `${chartId} (subtítulo en pantalla: «${ui.subtitle}»)`;
}
