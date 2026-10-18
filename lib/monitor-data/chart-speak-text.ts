import { beneficiosMercado, mixContratacion, perfilRadar } from "./domain";
import { getDemoClient, getMonitorDataset, getMonitorEmpresas } from "./dataset";
import { fmt$, fmtN, fmtP } from "./format";
import { mediana, prom, promSinCeros, rango, serieRotIndices, vals } from "./stats";
import { TAMANOS } from "./types";
import type { Empresa } from "./types";
import type { MonitorChartId } from "@/lib/monitor-ai/types";

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const PROCESO_LABELS: Record<string, string> = {
  metalmecanica: "Metalmecánica",
  fundicion: "Fundición",
  plasticos: "Plásticos",
  electronico_electronica: "Electrónica",
  arnesera: "Arnesera",
  recubrimientos: "Recubrimientos",
  quimicos_solventes_y_adhesivos: "Químicos, solventes y adhesivos",
  interiores_textil_piel: "Interiores (textil/piel)",
  carton_fibra_panel_de_madera: "Cartón, fibra y panel de madera",
  vidrios_laminados: "Vidrios laminados",
};

function conteoLabels(lista: (string | null | undefined)[]) {
  const n = lista.filter((x) => x != null && x !== "").length;
  const c: Record<string, number> = {};
  lista.forEach((v) => {
    const k = v == null || v === "" ? "Sin dato" : String(v);
    c[k] = (c[k] || 0) + 1;
  });
  return Object.entries(c)
    .map(([label, k]) => ({ label, v: k / (n || 1) }))
    .sort((a, b) => b.v - a.v);
}

function conteoProcesos(M: Empresa[]) {
  const r = M.filter((e) => (e.procesos || []).length);
  const c: Record<string, number> = {};
  r.forEach((e) => e.procesos.forEach((p) => { c[p] = (c[p] || 0) + 1; }));
  return Object.entries(c)
    .map(([k, n]) => ({
      k,
      label: PROCESO_LABELS[k] || k,
      v: n / r.length,
    }))
    .sort((a, b) => b.v - a.v);
}

function edadMercado(M: Empresa[]) {
  const r = M.filter((e) => e.edad.some((v) => v != null));
  const w = r.map((e) => (e.op || 0) + (e.adm || 0) + (e.otro || 0));
  const W = w.reduce((a, b) => a + b, 0);
  return [0, 1, 2, 3, 4].map((i) =>
    r.reduce((s, e, j) => s + (e.edad[i] || 0) * w[j], 0) / W,
  );
}

function mesesMercado(M: Empresa[]) {
  const r = M.filter((e) => e.mes.some((x) => x));
  return MESES.map((_, i) => r.filter((e) => e.mes[i]).length / r.length);
}

function etapaNeg(t: string | null) {
  if (!t) return null;
  if (/pendiente/i.test(t)) return "Pendiente";
  const m = t.match(/(20\d\d)/);
  if (m) return `Revisado ${m[1]}`;
  return "No aplica";
}

function conteoTamano(M: Empresa[]) {
  const n = M.length;
  const c: Record<string, number> = {};
  M.forEach((e) => {
    const t = e.tamano || "Sin dato";
    c[t] = (c[t] || 0) + 1;
  });
  const rows: { label: string; v: number }[] = TAMANOS.filter((t) => c[t]).map((t) => ({
    label: t,
    v: c[t]! / n,
  }));
  if (c["Sin dato"]) rows.push({ label: "Sin dato", v: c["Sin dato"] / n });
  return rows.sort((a, b) => b.v - a.v);
}

function causasMercado(M: Empresa[]) {
  const datos = getMonitorDataset();
  const r = M.filter((e) => e.mot.some((v) => v != null));
  return datos.motivos
    .map((label, i) => ({
      i,
      label,
      v: r.filter((e) => (e.mot[i] ?? -1) >= 3).length / r.length,
    }))
    .sort((a, b) => b.v - a.v);
}

function celdaRotMax(M: Empresa[], ult: number) {
  const tiers = [...new Set(M.map((e) => e.tier).filter((t): t is string => !!t))].sort();
  const celdas: { tier: string; tam: string; v: number }[] = [];
  TAMANOS.forEach((tam) => {
    tiers.forEach((tier) => {
      const sub = M.filter(
        (e) => e.tamano === tam && e.tier === tier && (e.rot[ult] ?? 0) > 0,
      );
      if (sub.length >= 2) {
        celdas.push({ tier, tam, v: prom(sub.map((e) => e.rot[ult])) ?? 0 });
      }
    });
  });
  if (!celdas.length) return { tier: "—", tam: "—", v: 0 };
  return celdas.reduce((a, b) => (b.v > a.v ? b : a));
}

function speakForChart(chartId: MonitorChartId, M: Empresa[], CLI: Empresa): string | null {
  const datos = getMonitorDataset();
  const ULT = datos.bimestres.length - 1;

  switch (chartId) {
    case "plantilla": {
      const op = M.reduce((s, e) => s + (e.op || 0), 0);
      const ad = M.reduce((s, e) => s + (e.adm || 0), 0);
      const ot = M.reduce((s, e) => s + (e.otro || 0), 0);
      const t = op + ad + ot;
      const cliHead = (CLI.op || 0) + (CLI.adm || 0) + (CLI.otro || 0);
      return `La muestra reúne ${M.length} empresas con ${fmtN(t)} empleados. El ${fmtP(op / t, 0)} es personal operativo y el ${fmtP(ad / t, 0)} administrativo. Su empresa aporta ${fmtN(cliHead)} empleados, el ${fmtP(cliHead / t, 1)} del total.`;
    }
    case "procesos": {
      const f = conteoProcesos(M);
      if (!f.length) return null;
      const proc = (CLI.procesos || []).map((p) => PROCESO_LABELS[p] || p).join(" y ");
      return `${f[0].label} es el proceso más común: lo realiza el ${fmtP(f[0].v, 0)} de las compañías. Su empresa trabaja en ${proc}, marcado en ámbar.`;
    }
    case "tier": {
      const t = conteoLabels(M.map((e) => e.tier));
      const sind = prom(M.map((e) => e.sindicato));
      return `El ${fmtP(t[0]?.v, 0)} de las compañías es ${t[0]?.label}. Su empresa es ${CLI.tier}. El ${fmtP(sind, 0)} de las compañías tiene sindicato.`;
    }
    case "tamano": {
      const t = conteoTamano(M);
      const seg = CLI.tamano || "sin dato";
      return `El ${fmtP(t[0]?.v, 0)} de las compañías tiene entre ${t[0]?.label.toLowerCase()} empleados. La suya (${seg}) está en el segmento resaltado en ámbar.`;
    }
    case "edad": {
      const d = edadMercado(M);
      return `En el mercado, el ${fmtP(d[0], 0)} del personal tiene menos de 23 años; en su empresa, el ${fmtP(CLI.edad[0], 0)}. Una plantilla más joven suele rotar más: es la asociación más fuerte que encontramos en los datos.`;
    }
    case "salini": {
      const med = mediana(M.map((e) => e.sal[0]));
      const pos = rango(M.map((e) => e.sal[0]), CLI.sal[0] ?? 0);
      return `La mediana del mercado es ${fmt$(med)} diarios. Su empresa paga ${fmt$(CLI.sal[0])}, ${CLI.sal[0]! < (med ?? 0) ? "por debajo" : "por arriba"} de la mediana: el ${fmtP(pos, 0)} de las empresas paga menos que usted.`;
    }
    case "escalera": {
      const esc = CLI.sal[3]! / CLI.sal[0]! - 1;
      const escM = mediana(
        M.map((e) => (e.sal[3] && e.sal[0] ? e.sal[3] / e.sal[0] - 1 : null)),
      );
      return `Del salario inicial al máximo, su escalera crece ${fmtP(esc, 0)}; en la empresa típica del mercado, ${fmtP(escM, 0)}. Una escalera corta deja poco incentivo para quedarse.`;
    }
    case "incremento":
      return `El mercado otorgó en promedio ${fmtP(prom(M.map((e) => e.inc["2025"][0])), 2)} al personal operativo en 2025, contra ${fmtP(prom(M.map((e) => e.inc["2024"][0])), 2)} en 2024. Su empresa otorgó ${fmtP(CLI.inc["2025"][0], 2)} en 2025.`;
    case "mes": {
      const v = mesesMercado(M);
      const i = v.indexOf(Math.max(...v));
      const mesesCli = CLI.mes
        .map((x, j) => (x ? MESES[j] : null))
        .filter(Boolean)
        .join(", ");
      return `${MESES[i]} concentra las revisiones: el ${fmtP(v[i], 0)} de las compañías. Su empresa revisa en ${mesesCli || "un mes no reportado"}.`;
    }
    case "beneficios": {
      const b = beneficiosMercado(M);
      return `${b[0]?.label} y ${b[1]?.label.toLowerCase()} son los beneficios que más se incrementan (${fmtP(b[0]?.v, 0)} y ${fmtP(b[1]?.v, 0)} de las compañías). En ámbar, los que incluyó su empresa.`;
    }
    case "incben":
      return `En 2025 el mercado incrementó los beneficios ${fmtP(prom(M.map((e) => e.inc["2025"][2])), 2)} para el personal operativo y ${fmtP(prom(M.map((e) => e.inc["2025"][3])), 2)} para el administrativo. Su empresa: ${fmtP(CLI.inc["2025"][2], 2)} y ${fmtP(CLI.inc["2025"][3], 2)}.`;
    case "negociacion": {
      const t = conteoLabels(M.map((e) => etapaNeg(e.neg)));
      return `${t[0]?.label}: ${fmtP(t[0]?.v, 0)} de las compañías. Su empresa: ${etapaNeg(CLI.neg) || "sin dato"}.`;
    }
    case "capacitacion":
      return `La empresa típica dio ${(mediana(M.map((e) => e.cap)) ?? 0).toFixed(1)} horas de capacitación por persona en el bimestre; la suya, ${(CLI.cap ?? 0).toFixed(1)} horas.`;
    case "rotserie": {
      const s = serieRotIndices(M, datos.bimestres.length);
      return `La rotación del mercado pasó de ${fmtP(s.total[0])} en ${datos.bimestres[0]} a ${fmtP(s.total[ULT])} en ${datos.bimestres[ULT]}. La mayor parte es no controlada: la deciden los empleados. Su empresa terminó en ${fmtP(CLI.rot[ULT])}.`;
    }
    case "mixcontrata": {
      const mk = mixContratacion(M, ULT);
      const cl = mixContratacion([CLI], ULT);
      return `En ${datos.bimestres[ULT]}, el ${fmtP(mk.pCr, 0)} de las contrataciones del mercado repusieron una baja y el ${fmtP(mk.pCn, 0)} abrieron posición nueva. Su empresa: ${fmtP(cl.pCr, 0)} reposición y ${fmtP(cl.pCn, 0)} nuevas.`;
    }
    case "rotcomp": {
      const r = M.map((e) => e.rot[ULT]);
      const p = promSinCeros(r);
      const md = mediana(r.filter((v) => (v ?? 0) > 0));
      return `El promedio simple es ${fmtP(p, 2)} y la mediana ${fmtP(md, 2)}: unas pocas empresas con rotación muy alta jalan el promedio. Su empresa, con ${fmtP(CLI.rot[ULT], 2)}, está ${CLI.rot[ULT]! > (p ?? 0) ? "por arriba" : "por debajo"} de ambos.`;
    }
    case "causas": {
      const c = causasMercado(M);
      return `"${c[0]?.label}" es la causa más citada: el ${fmtP(c[0]?.v, 0)} de las compañías la ve común o más frecuente. En ámbar, las causas que su empresa califica igual.`;
    }
    case "ausentismo": {
      const s = datos.bimestres.map((_, i) => promSinCeros(M.map((e) => e.aus[i])));
      const min = Math.min(...vals(s));
      const max = Math.max(...vals(s));
      return `El ausentismo del mercado se mueve entre ${fmtP(min, 2)} y ${fmtP(max, 2)}. Su empresa tuvo ${fmtP(CLI.aus[ULT], 2)} en ${datos.bimestres[ULT]}. Más ausentismo suele ir con más rotación.`;
    }
    case "salrot": {
      const med = mediana(M.map((e) => e.sal[0]));
      const p = M.find((e) => e.id === CLI.id);
      return `A menor salario de ingreso suele ir más rotación (ρ ≈ −0.35 en la muestra). Su empresa paga ${fmt$(p?.sal[0])} con rotación ${fmtP(p?.rot[ULT], 2)} frente a una mediana salarial de ${fmt$(med)}.`;
    }
    case "plantbubble": {
      const h = (CLI.op || 0) + (CLI.adm || 0) + (CLI.otro || 0);
      return `Su plantilla suma ${fmtN(h)} personas, rotación ${fmtP(CLI.rot[ULT], 2)} y ausentismo ${fmtP(CLI.aus[ULT], 2)}. El tamaño del punto refleja el ausentismo relativo en el bimestre.`;
    }
    case "rotmapa": {
      const h = celdaRotMax(M, ULT);
      return `La combinación con mayor rotación promedio en ${datos.edicion} es ${h.tier} · ${h.tam} (${fmtP(h.v, 2)}). Las celdas vacías no alcanzan el mínimo de empresas para mostrarse.`;
    }
    case "perfilradar": {
      const r = perfilRadar(M, CLI);
      const peor = r.labels[r.cli.indexOf(Math.min(...r.cli))];
      return `El radar compara su posición relativa en rotación, ausentismo, salario, incremento y capacitación. La dimensión más baja para usted es ${peor.toLowerCase()}.`;
    }
    default:
      return null;
  }
}

/**
 * Párrafo narrativo de la columna izquierda (g.texto(EMP)) para cada gráfica del monitor.
 * Alineado con monitor-en-vivo-catch.html.
 */
export function getChartSpeakParagraph(chartId: MonitorChartId): string | null {
  const M = getMonitorEmpresas();
  const CLI = getDemoClient();
  const text = speakForChart(chartId, M, CLI);
  return text?.trim() ? text.trim() : null;
}
