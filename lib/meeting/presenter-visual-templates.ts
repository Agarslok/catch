/** Plantillas visuales del presentador (referencia de paleta; sin tema global). */

export const PRESENTER_VISUAL_TEMPLATE_IDS = ["mml", "nexo", "pulso"] as const;

export type PresenterVisualTemplateId =
  (typeof PRESENTER_VISUAL_TEMPLATE_IDS)[number];

export type PresenterVisualTemplateColor = {
  hex: string;
  label: string;
};

export type PresenterVisualTemplateMeta = {
  id: PresenterVisualTemplateId;
  label: string;
  description: string;
  /** Tipo de informe para el que está pensada la plantilla. */
  specialty: string;
  /** Para qué sirve y qué tono de conversación favorece. */
  utility: string;
  /** Enfoque sugerido del guión al presentar. */
  scriptFocus: string;
  colors: PresenterVisualTemplateColor[];
};

export const PRESENTER_VISUAL_TEMPLATES: PresenterVisualTemplateMeta[] = [
  {
    id: "mml",
    label: "MML",
    description: "Blanco y azules del Monitor de Mercado Laboral.",
    specialty: "Informes de rotación y benchmark de mercado",
    utility:
      "Especializada para comparar su empresa con la muestra del Monitor: rotación por Tier, edad y salario. Ayuda a explicar brechas frente al referente y tendencias del bimestre con un lenguaje de mercado laboral.",
    scriptFocus:
      "«Hoy revisamos cómo se mueve la rotación frente al mercado de referencia y qué factores explican la diferencia con su empresa.»",
    colors: [
      { hex: "#2778b1", label: "Primario" },
      { hex: "#38aecb", label: "Acento" },
      { hex: "#eef5fa", label: "Fondo suave" },
      { hex: "#232222", label: "Texto" },
    ],
  },
  {
    id: "nexo",
    label: "Nexo",
    description: "Verdes corporativos, tono sobrio y legible.",
    specialty: "Informes de gestión humana y desarrollo de personas",
    utility:
      "Pensada para mesas con RH y líderes: retención, capacitación, equidad y políticas internas. El diseño prioriza lectura sobria para comités y planes de acción sobre el capital humano.",
    scriptFocus:
      "«Ubiquemos estos indicadores en su estrategia de personas: qué retener, dónde capacitar y qué decisiones de política interna se desprenden de los datos.»",
    colors: [
      { hex: "#2d5a4a", label: "Primario" },
      { hex: "#6b9e78", label: "Acento" },
      { hex: "#eef4f0", label: "Fondo suave" },
      { hex: "#1a2e28", label: "Texto" },
    ],
  },
  {
    id: "pulso",
    label: "Pulso",
    description: "Púrpuras y rosas para un contraste distinto.",
    specialty: "Informes operativos: plantilla, ausentismo y alertas",
    utility:
      "Enfatiza tamaño de plantilla, ausentismo y señales de riesgo operativo del bimestre. Útil cuando el público necesita priorizar urgencias, concentraciones y variaciones que requieren respuesta rápida.",
    scriptFocus:
      "«Veamos dónde late el riesgo operativo: ausentismo, concentración por área y los puntos que conviene atender antes del próximo corte.»",
    colors: [
      { hex: "#5c3d7a", label: "Primario" },
      { hex: "#c45c8a", label: "Acento" },
      { hex: "#f5eef3", label: "Fondo suave" },
      { hex: "#2a2030", label: "Texto" },
    ],
  },
];
