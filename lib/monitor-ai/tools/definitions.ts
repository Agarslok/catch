/** Declaraciones Gemini function calling (Capital Humano demo). */

import { MONITOR_CHART_IDS } from "../catalog";

export const MONITOR_AI_TOOL_DECLARATIONS = [
  {
    name: "get_section_summary",
    description:
      "KPIs agregados de una sección del monitor (muestra, salarios, beneficios, indicadores, patrones). Respeta filtros de mercado y regla de mínimo 5 empresas.",
    parameters: {
      type: "object",
      properties: {
        sectionKey: {
          type: "string",
          enum: ["muestra", "salarios", "beneficios", "indicadores", "patrones"],
        },
        filters: {
          type: "object",
          properties: {
            tier: { type: "string", description: "Todos | Tier 1 | Tier 2 | Tier 3" },
            tamano: { type: "string" },
            proceso: { type: "string", description: "Clave de proceso, p. ej. metalmecanica" },
          },
        },
      },
      required: ["sectionKey"],
    },
  },
  {
    name: "get_market_metric",
    description:
      "Una métrica agregada del mercado o del cliente demo en un bimestre. Valores numéricos; null si no hay dato.",
    parameters: {
      type: "object",
      properties: {
        metric: {
          type: "string",
          enum: [
            "turnover_total",
            "turnover_uncontrolled",
            "turnover_controlled",
            "absenteeism",
            "median_initial_salary",
            "market_headcount",
            "client_turnover_total",
            "client_absenteeism",
            "client_initial_salary",
          ],
        },
        bimestreIndex: {
          type: "integer",
          description: "Índice 0..n-1 en DATOS.bimestres; omitir para el último bimestre",
        },
        filters: { type: "object" },
      },
      required: ["metric"],
    },
  },
  {
    name: "compare_client_to_market",
    description:
      "Compara la empresa demo fija con el mercado agregado para rotación, ausentismo o salario inicial mediano.",
    parameters: {
      type: "object",
      properties: {
        metric: {
          type: "string",
          enum: ["turnover_total", "absenteeism", "median_initial_salary"],
        },
        bimestreIndex: { type: "integer" },
        filters: { type: "object" },
      },
      required: ["metric"],
    },
  },
  {
    name: "propose_chart_highlight",
    description:
      "Solicita resaltar un elemento real ya presente en una gráfica del monitor (barra, segmento o punto). Usar chartId interno del enum (no el subtítulo visible; ver visibleChartLabels en el contexto). category o index deben existir en highlightOptions. No inventar identificadores.",
    parameters: {
      type: "object",
      properties: {
        chartId: { type: "string", enum: [...MONITOR_CHART_IDS] },
        category: { type: "string", description: "Etiqueta del elemento (p. ej. EMP_39, Reposición de bajas, bimestre)" },
        seriesKey: { type: "string", description: "Nombre de la serie cuando la gráfica tiene varias" },
        datasetIndex: { type: "integer" },
        index: { type: "integer", description: "Índice en labels o en la serie de barras" },
        reason: { type: "string", description: "Motivo breve para el presentador (opcional)" },
      },
      required: ["chartId"],
    },
  },
  {
    name: "clear_chart_highlight",
    description:
      "Quita el resaltado de una gráfica. Sin parámetros: quita cualquier resaltado activo. Con chartId y/o category: solo si coincide con el resaltado actual (usa activeHighlight del contexto). Usar cuando el usuario pida desmarcar, quitar resaltado o dejar de señalar.",
    parameters: {
      type: "object",
      properties: {
        chartId: { type: "string", enum: [...MONITOR_CHART_IDS] },
        category: {
          type: "string",
          description: "Etiqueta del elemento resaltado (la misma usada al resaltar)",
        },
        reason: { type: "string", description: "Motivo breve (opcional)" },
      },
    },
  },
] as const;

export type MonitorAiToolName =
  | "get_section_summary"
  | "get_market_metric"
  | "compare_client_to_market"
  | "propose_chart_highlight"
  | "clear_chart_highlight";

export const MONITOR_AI_TOOL_NAMES = new Set<string>([
  "get_section_summary",
  "get_market_metric",
  "compare_client_to_market",
  "propose_chart_highlight",
  "clear_chart_highlight",
]);
