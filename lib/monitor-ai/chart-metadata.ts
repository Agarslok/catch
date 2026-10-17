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
    subtitle: "Suma de la muestra",
  },
  procesos: { title: "Principales procesos", subtitle: "% de compañías que realizan cada proceso" },
  tier: { title: "Nivel en la cadena automotriz", subtitle: "% de compañías por Tier" },
  tamano: { title: "Tamaño de las compañías", subtitle: "% de la muestra en cada rango de empleados" },
  edad: { title: "Edad del personal", subtitle: "Mercado ponderado por empleados contra su empresa" },
  salini: {
    title: "Salario diario inicial del personal operativo",
    subtitle: "Cada barra es una empresa; la suya en ámbar",
  },
  escalera: {
    title: "Escalera salarial operativa",
    subtitle: "Percentiles del mercado y su empresa, salario diario",
  },
  incremento: {
    title: "Incremento salarial otorgado",
    subtitle: "Promedio simple de compañías contra su empresa",
  },
  mes: {
    title: "Mes de revisión salarial",
    subtitle: "% de compañías que incrementan en cada mes",
  },
  beneficios: {
    title: "Beneficios incluidos en el incremento",
    subtitle: "% de compañías que respondieron",
  },
  incben: {
    title: "Incremento en beneficios 2025",
    subtitle: "Promedio simple de compañías contra su empresa",
  },
  negociacion: {
    title: "Estatus del contrato colectivo",
    subtitle: "Compañías por etapa de la revisión",
  },
  capacitacion: {
    title: "Horas de capacitación por persona",
    subtitle: "En el bimestre; cada barra es una empresa",
  },
  rotserie: {
    title: "Rotación bimestral por tipo",
    subtitle: "Mercado (promedio simple sin ceros) y su empresa",
  },
  mixcontrata: {
    title: "Contrataciones del bimestre",
    subtitle: "Reposición de bajas frente a posiciones nuevas (mercado)",
  },
  rotcomp: {
    title: "Rotación por compañía",
    subtitle: "Cada barra es una empresa; la suya en ámbar",
  },
  causas: { title: "Causas de rotación", subtitle: "% de compañías que califican la causa como común o más" },
  ausentismo: {
    title: "Ausentismo bimestral",
    subtitle: "Mercado (promedio simple sin ceros) y su empresa",
  },
  salrot: {
    title: "Salario inicial y rotación",
    subtitle: "Cada punto es una empresa; la suya en ámbar",
  },
  plantbubble: {
    title: "Plantilla, rotación y ausentismo",
    subtitle: "Eje X: empleados · Y: rotación · tamaño del punto: ausentismo",
  },
  rotmapa: {
    title: "Rotación por Tier y tamaño",
    subtitle: "Intensidad del color = rotación promedio del segmento",
  },
  perfilradar: {
    title: "Perfil relativo de su empresa",
    subtitle: "Percentil en cada dimensión (100 = mejor posición en la muestra)",
  },
};

export function chartUiLabel(chartId: MonitorChartId): string {
  const ui = MONITOR_CHART_UI[chartId];
  if (!ui) return chartId;
  return `${chartId} (subtítulo en pantalla: «${ui.subtitle}»)`;
}
