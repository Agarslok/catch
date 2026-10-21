import type { MonitorSectionKey } from "@/lib/monitor-ai/types";
import { fmt$, fmtN, fmtP } from "./format";
import { mediana, promSinCeros } from "./stats";
import type { Empresa, KpiRow } from "./types";
import { getMonitorDataset } from "./dataset";
import { mixContratacion } from "./domain";

const SECTION_NAMES: Record<MonitorSectionKey, string> = {
  muestra: "Contexto y muestra",
  salarios: "Personal y salarios",
  beneficios: "Beneficios",
  indicadores: "Indicadores",
  patrones: "Qué viene",
};

export function sectionKpis(sectionKey: MonitorSectionKey, M: Empresa[], _cli: Empresa): KpiRow[] {
  const datos = getMonitorDataset();
  const ULT = datos.bimestres.length - 1;

  switch (sectionKey) {
    case "muestra": {
      const sx = datos.mercado?.sintesis;
      const completo = M.length === datos.empresas.length;
      if (!completo) {
        return [
          { v: M.length, l: "Empresas en este corte" },
          { v: fmtN(sx?.empleados ?? 35128), l: "Empleados del mercado completo" },
        ];
      }
      return [
        { v: sx?.empresas ?? 40, l: "Empresas" },
        { v: fmtN(sx?.empleados ?? 35128), l: "Empleados" },
        { v: fmtP(sx?.composicion?.op ?? 0.7, 0), l: "Personal operativo" },
        { v: fmtP(sx?.mujeres?.pct ?? 0.386, 1), l: "Mujeres en la plantilla" },
      ];
    }
    case "salarios": {
      const s = datos.mercado?.sintesis?.salario;
      return [
        { v: fmt$(s?.mediana ?? mediana(M.map((e) => e.sal[0]))), l: "Mediana al ingreso" },
        { v: `${fmt$(s?.p25 ?? 300)}–${fmt$(s?.p75 ?? 370)}`, l: "Mitad de las empresas" },
        { v: fmtP(s?.crecimientoPct ?? 0.65, 0), l: "Del inicial al máximo" },
        { v: "13 de 40", l: "Pagan bajo el mínimo 2026" },
      ];
    }
    case "beneficios":
      return [
        { v: "33%", l: "No movió ningún beneficio" },
        { v: "45%", l: "Subió vales de despensa" },
        { v: "40%", l: "Subió fondo de ahorro" },
        { v: "2.9%", l: "Incremento en beneficios" },
      ];
    case "indicadores": {
      const mk = mixContratacion(M, ULT);
      const merc = datos.mercado;
      const antesAno = merc?.cuandosevan?.antesPrimerAno;
      const rotMerc = merc?.rotacionEdicion?.mercado ?? promSinCeros(M.map((e) => e.rot[ULT]));
      const ausMerc =
        merc?.ausentismoEdicion?.total ?? promSinCeros(M.map((e) => e.aus[ULT]));
      return [
        { v: fmtP(rotMerc, 1), l: "Rotación del mercado (Jul–Ago 2025)" },
        {
          v: antesAno != null ? fmtP(antesAno, 0) : "—",
          l: "Bajas antes del primer año (prom. empresas)",
        },
        { v: fmtP(ausMerc, 2), l: "Ausentismo del mercado" },
        { v: fmtP(mk.pCr, 0), l: "Contrataciones por reposición" },
      ];
    }
    case "patrones": {
      const p = datos.mercado?.prediccion;
      return [
        {
          v: p?.rot2026 != null ? fmtP(p.rot2026, 0) : "—",
          l: "Rotación anual esperada 2026",
        },
        {
          v:
            p?.lo80 != null && p?.hi80 != null
              ? `${fmtP(p.lo80, 0)}–${fmtP(p.hi80, 0)}`
              : "—",
          l: "Banda 80% de incertidumbre",
        },
        { v: fmtP(p?.siSeDetiene ?? 0.41, 0), l: "Si se detiene" },
        { v: String(datos.mercado?.sintesis?.segmentos?.altoRiesgo ?? 10), l: "Empresas en alto riesgo" },
      ];
    }
    default:
      return [];
  }
}

export function getSectionName(sectionKey: MonitorSectionKey): string {
  return SECTION_NAMES[sectionKey];
}
