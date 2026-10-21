import { mixContratacion, perfilRadar } from "./domain";
import { getDemoClient, getMonitorDataset, getMonitorEmpresas } from "./dataset";
import { fmt$, fmtN, fmtP } from "./format";
import { mediana, prom, promSinCeros, rango, serieRotIndices, vals } from "./stats";
import type { Empresa } from "./types";
import type { MonitorChartId } from "@/lib/monitor-ai/types";
import { withSectionLead } from "@/lib/monitor-content/dael-reference";

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

function speakForChart(chartId: MonitorChartId, M: Empresa[], CLI: Empresa): string | null {
  const datos = getMonitorDataset();
  const ULT = datos.bimestres.length - 1;

  switch (chartId) {
    case "plantilla": {
      const sx = datos.mercado?.sintesis;
      const comp = sx?.composicion;
      return `Son ${sx?.empresas ?? 40} empresas y ${fmtN(sx?.empleados ?? 35128)} empleados. El ${fmtP(comp?.op ?? 0.7, 0)} es personal operativo. El ${fmtP(sx?.mujeres?.pct ?? 0.386, 1)} de la plantilla son mujeres (n = ${sx?.mujeres?.n ?? 37}).`;
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
    case "tamano":
      return "Hay empresas de todos los tamaños: 5 de 1 a 100, 10 de 101 a 300, 7 de 301 a 500, 8 de 501 a 1,000 y 10 de más de 1,000. El 80% tiene sindicato.";
    case "edad": {
      const d = edadMercado(M);
      return `En el mercado, el ${fmtP(d[0], 0)} del personal tiene menos de 23 años; en su empresa, el ${fmtP(CLI.edad[0], 0)}. Una plantilla más joven suele rotar más: es la asociación más fuerte que encontramos en los datos.`;
    }
    case "salini": {
      const s = datos.mercado?.sintesis?.salario;
      return `Mediana ${fmt$(s?.mediana ?? 340)} diarios. La mitad de las empresas paga entre ${fmt$(s?.p25 ?? 300)} y ${fmt$(s?.p75 ?? 370)}. 13 de 40 pagan bajo el mínimo 2026 de $315.`;
    }
    case "escalera": {
      const s = datos.mercado?.sintesis?.salario;
      return `Escalera mediana de ${fmt$(s?.escalera?.[0] ?? 340)} a ${fmt$(s?.escalera?.[3] ?? 561)}: ${fmtP(s?.crecimientoPct ?? 0.65, 0)} más. El piso del rango central es ${fmt$(s?.p25 ?? 300)}. El 43% revisa salarios en abril.`;
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
    case "paquete":
      return "El paquete típico del operativo: 10% en vales, 8.3% de fondo de ahorro, 50% de prima vacacional y 20 días de aguinaldo. El 60% da comedor.";
    case "beneficios":
      return "Una de cada tres empresas no movió ningún beneficio. Las demás subieron, sobre todo vales (45%) y fondo de ahorro (40%). El incremento en beneficios fue 2.9%.";
    case "incben":
      return `En 2025 el mercado incrementó los beneficios ${fmtP(prom(M.map((e) => e.inc["2025"][2])), 2)} para el personal operativo y ${fmtP(prom(M.map((e) => e.inc["2025"][3])), 2)} para el administrativo. Su empresa: ${fmtP(CLI.inc["2025"][2], 2)} y ${fmtP(CLI.inc["2025"][3], 2)}.`;
    case "negociacion": {
      const t = conteoLabels(M.map((e) => etapaNeg(e.neg)));
      return `${t[0]?.label}: ${fmtP(t[0]?.v, 0)} de las compañías. Su empresa: ${etapaNeg(CLI.neg) || "sin dato"}.`;
    }
    case "rotserie": {
      const sx = datos.mercado?.sintesis?.rotacion;
      const ed = datos.mercado?.rotacionEdicion;
      const ultimo = sx?.ultimo ?? ed?.mercado ?? 0.0813;
      const hace = sx?.haceUnAno ?? 0.1077;
      const vol = sx?.voluntaria ?? ed?.voluntaria ?? 0.0559;
      return `Bajó de ${fmtP(hace, 1)} a ${fmtP(ultimo, 1)} en ${datos.bimestres[ULT]}. Mediana ${fmtP(sx?.mediana ?? 0.0728, 1)}. Voluntaria ${fmtP(vol, 1)}. El filtro puede ver Tier o tamaño; la cifra base es el mercado completo.`;
    }
    case "cuandosevan": {
      const sx = datos.mercado?.sintesis;
      return `67% de las bajas antes del primer año. Mejor sueldo como causa: ${fmtP(sx?.causaSueldoPct ?? 0.718, 1)} de empresas. Reposición: ${fmtP(sx?.reposicionPct ?? 0.71, 0)} de contrataciones.`;
    }
    case "mixcontrata": {
      const mk = mixContratacion(M, ULT);
      const cl = mixContratacion([CLI], ULT);
      return `Siete de cada diez contrataciones del mercado solo reponen a alguien que se fue (${fmtP(mk.pCr, 0)} reposición frente a ${fmtP(mk.pCn, 0)} posiciones nuevas en ${datos.bimestres[ULT]}). Su empresa: ${fmtP(cl.pCr, 0)} reposición y ${fmtP(cl.pCn, 0)} nuevas.`;
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
      const ae = datos.mercado?.ausentismoEdicion;
      const cap = ae?.capacitacionHoras ?? mediana(M.map((e) => e.cap));
      const total = ae?.total ?? promSinCeros(M.map((e) => e.aus[ULT]));
      return `De cada 100 días que se debían trabajar, se faltaron ${fmtP(total, 2)} en ${datos.bimestres[ULT]}${ae?.justificado != null ? ` (justificado ${fmtP(ae.justificado, 2)}, injustificado ${fmtP(ae.injustificado ?? 0, 2)})` : ""}. La capacitación típica es ${(cap ?? 0).toFixed(1)} horas por persona en el bimestre; la suya, ${(CLI.cap ?? 0).toFixed(1)} h.`;
    }
    case "prediccion": {
      const p = datos.mercado?.prediccion;
      const seg = datos.mercado?.sintesis?.segmentos;
      return `2026: ${fmtP(p?.rot2026 ?? 0.38, 0)} si la tendencia sigue. Rango del 80%: ${fmtP(p?.lo80 ?? 0.33, 0)} a ${fmtP(p?.hi80 ?? 0.44, 0)}. Si se detiene, ${fmtP(p?.siSeDetiene ?? 0.41, 0)}. ${seg?.altoRiesgo ?? 10} empresas en alto riesgo, ${seg?.estables ?? 20} estables y ${seg?.referentes ?? 10} referentes. La gráfica muestra la historia bimestral y, en azul, el pronóstico con su banda.`;
    }
    case "salrot": {
      const d = datos.mercado?.sintesis?.drivers;
      return `Bajas antes del año: +54% en las odds. Ausentismo: +22%. Salario sobre el mercado: −${fmtP(d?.oddsReduccionPct ?? 0.29, 0)} (OR ${(d?.orSalario ?? 0.71).toFixed(2)}). El personal menor de 23 años no es concluyente: su intervalo cruza el sin efecto. El 75% de la variación depende de cada empresa. Asociación, no causa.`;
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
  if (!text?.trim()) return null;
  return withSectionLead(chartId, text.trim());
}
