import type { MonitorSectionKey } from "@/lib/monitor-ai/types";

export type MonitorMarketFilters = {
  tier?: string;
  tamano?: string;
  proceso?: string;
};

export type MarketSlice = {
  M: Empresa[];
  filtersApplied: boolean;
  filterSubsetCount: number;
};

export type MonitorMercadoMeta = {
  sintesis?: {
    empresas?: number;
    empleados?: number;
    composicion?: { op?: number; adm?: number; otro?: number };
    mujeres?: { pct?: number; n?: number };
    tier?: { t1?: number; t2?: number; n?: number };
    procesoTopPct?: number;
    salario?: {
      mediana?: number;
      p25?: number;
      p75?: number;
      escalera?: number[];
      crecimientoPct?: number;
    };
    incrementoOp?: { "2024"?: number; "2025"?: number };
    sinRevision?: number;
    paqueteTipico?: { valesPct?: number; aguinaldoDias?: number };
    rotacion?: {
      ultimo?: number;
      haceUnAno?: number;
      voluntaria?: number;
      involuntaria?: number;
      mediana?: number;
      promedio?: number;
    };
    causaSueldoPct?: number;
    reposicionPct?: number;
    tiempoExtraPct?: number;
    drivers?: { orSalario?: number; oddsReduccionPct?: number };
    segmentos?: {
      referentes?: number;
      estables?: number;
      altoRiesgo?: number;
      casiSeguras?: number;
    };
  };
  cuandosevan?: {
    nEmpresas?: number;
    antesPrimerAno?: number;
    labels?: string[];
    acumulado?: number[];
  };
  ausentismoEdicion?: {
    total?: number;
    justificado?: number;
    injustificado?: number;
    capacitacionHoras?: number;
    nAus?: number;
    nCap?: number;
  };
  prediccion?: {
    rot2026?: number;
    lo80?: number;
    hi80?: number;
    siSeDetiene?: number;
  };
  rotacionEdicion?: {
    mercado?: number;
    mediana?: number;
    voluntaria?: number;
    involuntaria?: number;
  };
};

export type DatosCapitalHumano = {
  bimestres: string[];
  edicion: string;
  beneficios: string[];
  motivos: string[];
  empresas: Empresa[];
  mercado?: MonitorMercadoMeta;
};

export type Empresa = {
  id: string;
  proceso: string | null;
  procesos: string[];
  tier: string | null;
  tamano: string | null;
  sindicato: number | null;
  confed: string | null;
  op: number | null;
  adm: number | null;
  otro: number | null;
  muj: number | null;
  edad: (number | null)[];
  sal: (number | null)[];
  inc: Record<string, (number | null)[]>;
  mes: number[];
  ben: number[];
  neg: string | null;
  cap: number | null;
  mot: (number | null)[];
  rot: (number | null)[];
  rnc: (number | null)[];
  rc: (number | null)[];
  aus: (number | null)[];
  cn: (number | null)[];
  cr: (number | null)[];
};

export type KpiRow = { v: string | number; l: string; t?: boolean };

export type NullableNumber = number | null;

export const DEMO_CLIENT_ID = "EMP_39";

export const MIN_EMPRESAS = 5;

export const FILTER_ALL = "Todos";

export const TAMANOS = [
  "1 a 100",
  "101 a 300",
  "301 a 500",
  "501 a 1,000",
  "más de 1,000",
] as const;

export const PROCESO_KEYS = [
  "metalmecanica",
  "fundicion",
  "plasticos",
  "electronico_electronica",
  "arnesera",
  "recubrimientos",
  "quimicos_solventes_y_adhesivos",
  "interiores_textil_piel",
  "carton_fibra_panel_de_madera",
  "vidrios_laminados",
] as const;

export type ProcesoKey = (typeof PROCESO_KEYS)[number];

export type MonitorMarketMetric =
  | "turnover_total"
  | "turnover_uncontrolled"
  | "turnover_controlled"
  | "absenteeism"
  | "median_initial_salary"
  | "client_turnover_total"
  | "client_absenteeism"
  | "client_initial_salary"
  | "market_headcount";

export type SectionSummaryResult = {
  sectionKey: MonitorSectionKey;
  sectionName: string;
  edition: string;
  filtersApplied: boolean;
  filterSubsetCount: number;
  kpis: KpiRow[];
};

export type MetricValueResult = {
  metric: MonitorMarketMetric;
  bimestreIndex: number;
  bimestreLabel: string;
  value: NullableNumber;
  valueFormatted: string | null;
  filtersApplied: boolean;
  filterSubsetCount: number;
};

export type CompareClientResult = {
  metric: MonitorMarketMetric;
  bimestreIndex: number;
  bimestreLabel: string;
  clientValue: NullableNumber;
  marketValue: NullableNumber;
  clientFormatted: string | null;
  marketFormatted: string | null;
  filtersApplied: boolean;
  filterSubsetCount: number;
};
