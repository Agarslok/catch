import type { MonitorSectionKey } from "@/lib/monitor-ai/types";
import { fmt$, fmtN, fmtP } from "./format";
import { mediana, prom, promSinCeros } from "./stats";
import type { Empresa, KpiRow } from "./types";
import { getMonitorDataset } from "./dataset";
import { beneficiosMercado, mixContratacion, perfilRadar } from "./domain";

const SECTION_NAMES: Record<MonitorSectionKey, string> = {
  muestra: "Contexto y Muestra",
  salarios: "Personal y Salarios",
  beneficios: "Beneficios",
  indicadores: "Indicadores",
  patrones: "Patrones y relaciones",
};

export function sectionKpis(sectionKey: MonitorSectionKey, M: Empresa[], cli: Empresa): KpiRow[] {
  const datos = getMonitorDataset();
  const ULT = datos.bimestres.length - 1;

  switch (sectionKey) {
    case "muestra": {
      const tot = M.reduce((s, e) => s + (e.op || 0) + (e.adm || 0) + (e.otro || 0), 0);
      const mujNum = M.filter((e) => e.muj != null).reduce(
        (s, e) => s + (e.op || 0) + (e.adm || 0) + (e.otro || 0),
        0,
      );
      const muj =
        mujNum > 0
          ? M.reduce(
              (s, e) =>
                s + (e.muj ?? 0) * ((e.op || 0) + (e.adm || 0) + (e.otro || 0)),
              0,
            ) / mujNum
          : null;
      return [
        { v: M.length, l: "Empresas en la muestra" },
        { v: fmtN(tot), l: "Empleados" },
        { v: fmtP(muj, 0), l: "Mujeres (ponderado por empleados)" },
        {
          v: fmtN((cli.op || 0) + (cli.adm || 0) + (cli.otro || 0)),
          l: "Empleados de su empresa",
          t: true,
        },
      ];
    }
    case "salarios":
      return [
        { v: fmt$(mediana(M.map((e) => e.sal[0]))), l: "Salario diario inicial (mediana)" },
        { v: fmt$(cli.sal[0]), l: "Su salario diario inicial", t: true },
        {
          v: fmtP(prom(M.map((e) => e.inc["2025"][0])), 2),
          l: "Incremento operativo 2025 (promedio)",
        },
        { v: fmtP(cli.inc["2025"][0], 2), l: "Su incremento operativo 2025", t: true },
      ];
    case "beneficios": {
      const b = beneficiosMercado(M);
      const top = b[0];
      return [
        {
          v: top?.label ?? "—",
          l: top ? `Beneficio más común (${fmtP(top.v, 0)})` : "Beneficio más común",
        },
        { v: cli.ben.reduce((s, x) => s + x, 0), l: "Beneficios incluidos por su empresa", t: true },
        {
          v: (mediana(M.map((e) => e.cap)) ?? 0).toFixed(1) + " h",
          l: "Capacitación por persona (mediana)",
        },
        { v: (cli.cap ?? 0).toFixed(1) + " h", l: "Su capacitación por persona", t: true },
      ];
    }
    case "indicadores":
      return [
        {
          v: fmtP(promSinCeros(M.map((e) => e.rot[ULT])), 2),
          l: "Rotación del mercado (promedio simple sin ceros)",
        },
        { v: fmtP(cli.rot[ULT], 2), l: "Su rotación", t: true },
        {
          v: fmtP(mediana(M.map((e) => e.rot[ULT]).filter((v) => (v ?? 0) > 0)), 2),
          l: "Rotación mediana",
        },
        {
          v: fmtP(promSinCeros(M.map((e) => e.aus[ULT])), 2),
          l: "Ausentismo del mercado",
        },
      ];
    case "patrones": {
      const pr = perfilRadar(M, cli);
      return [
        { v: fmtP(mixContratacion(M, ULT).pCr, 0), l: "Contrataciones por reposición (mercado)" },
        { v: fmtP(cli.rot[ULT], 2), l: "Su rotación", t: true },
        { v: fmt$(cli.sal[0]), l: "Su salario inicial" },
        { v: fmtP(pr.cli[0], 0), l: "Percentil en rotación (menor es mejor)" },
      ];
    }
    default:
      return [];
  }
}

export function getSectionName(sectionKey: MonitorSectionKey): string {
  return SECTION_NAMES[sectionKey];
}
