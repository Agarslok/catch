import { beneficiosMercado, perfilRadar } from "@/lib/monitor-data/domain";
import {
  getDemoClient,
  getDemoClientId,
  getMonitorDataset,
  getMonitorEmpresas,
} from "@/lib/monitor-data/dataset";
import { TAMANOS } from "@/lib/monitor-data/types";
import type { Empresa } from "@/lib/monitor-data/types";
import type { MonitorChartId } from "./types";
import type { MonitorChartElementRef } from "./types";

export type HighlightProbe = {
  category?: string;
  seriesKey?: string;
  datasetIndex?: number;
  index?: number;
};

export type HighlightResolveError =
  | "invalid_chart"
  | "no_options"
  | "not_found"
  | "ambiguous"
  | "series_mismatch";

const CLIENT_LABEL = "Su empresa";

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

const MESES_CORTOS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function ref(
  chartId: MonitorChartId,
  category: string,
  seriesKey: string,
  datasetIndex: number,
  index: number,
): MonitorChartElementRef {
  return { chartId, category, seriesKey, datasetIndex, index };
}

function ordenadasRot(M: Empresa[], ult: number) {
  return M.map((e) => ({ id: e.id, v: e.rot[ult] }))
    .filter((x) => x.v != null)
    .sort((a, b) => (a.v as number) - (b.v as number));
}

function ordenadasVal(M: Empresa[], f: (e: Empresa) => number | null | undefined) {
  return M.map((e) => ({ id: e.id, v: f(e) }))
    .filter((x) => x.v != null)
    .sort((a, b) => (a.v as number) - (b.v as number));
}

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

function matrizRotTierTam(M: Empresa[], ult: number) {
  const tiers = [...new Set(M.map((e) => e.tier).filter((t): t is string => !!t))].sort();
  const celdas: { tier: string; tam: string; x: number; y: number }[] = [];
  TAMANOS.forEach((tam, yi) => {
    tiers.forEach((tier, xi) => {
      const sub = M.filter(
        (e) => e.tamano === tam && e.tier === tier && (e.rot[ult] ?? 0) > 0,
      );
      if (sub.length >= 2) celdas.push({ tier, tam, x: xi, y: yi });
    });
  });
  return { tiers, celdas };
}

/** Elementos resaltables según la misma lógica de datos que el monitor HTML. */
export function enumerateHighlightElements(chartId: MonitorChartId): MonitorChartElementRef[] {
  const M = getMonitorEmpresas();
  const datos = getMonitorDataset();
  const ULT = datos.bimestres.length - 1;
  const CLIENTE = getDemoClientId();
  const out: MonitorChartElementRef[] = [];

  switch (chartId) {
    case "plantilla": {
      const labels = ["Operativo", "Administrativo", "Otro"];
      labels.forEach((l, i) => out.push(ref(chartId, l, "", 0, i)));
      break;
    }
    case "procesos": {
      conteoProcesos(M).forEach((row, i) =>
        out.push(ref(chartId, row.label, "", 0, i)),
      );
      break;
    }
    case "tier": {
      conteoLabels(M.map((e) => e.tier)).forEach((row, i) =>
        out.push(ref(chartId, row.label, "", 0, i)),
      );
      break;
    }
    case "tamano": {
      const rows: { label: string }[] = TAMANOS.filter((t) => M.some((e) => e.tamano === t)).map(
        (t) => ({ label: t }),
      );
      if (M.some((e) => !e.tamano)) rows.push({ label: "Sin dato" });
      rows.forEach((row, i) => out.push(ref(chartId, row.label, "", 0, i)));
      break;
    }
    case "edad": {
      const labels = ["< 23", "23-29", "30-37", "38-50", "> 50"];
      const series = [
        { key: "Mercado", datasetIndex: 0 },
        { key: CLIENT_LABEL, datasetIndex: 1 },
      ];
      series.forEach((s) =>
        labels.forEach((l, i) => out.push(ref(chartId, l, s.key, s.datasetIndex, i))),
      );
      break;
    }
    case "salini":
    case "capacitacion": {
      const filas = ordenadasVal(
        M,
        chartId === "salini" ? (e) => e.sal[0] : (e) => e.cap,
      );
      filas.forEach((row, i) => out.push(ref(chartId, row.id, "", 0, i)));
      break;
    }
    case "escalera": {
      const labels = ["Inicial", "Intermedio bajo", "Intermedio alto", "Máximo"];
      const series = [
        { key: "Percentil 75", datasetIndex: 0 },
        { key: "Percentil 25", datasetIndex: 1 },
        { key: "Mediana", datasetIndex: 2 },
        { key: CLIENT_LABEL, datasetIndex: 3 },
      ];
      series.forEach((s) =>
        labels.forEach((l, i) => out.push(ref(chartId, l, s.key, s.datasetIndex, i))),
      );
      break;
    }
    case "incremento": {
      const labels = [
        "Operativo 2024",
        "Operativo 2025",
        "Administrativo 2024",
        "Administrativo 2025",
      ];
      const series = [
        { key: "Mercado", datasetIndex: 0 },
        { key: CLIENT_LABEL, datasetIndex: 1 },
      ];
      series.forEach((s) =>
        labels.forEach((l, i) => out.push(ref(chartId, l, s.key, s.datasetIndex, i))),
      );
      break;
    }
    case "mes": {
      MESES_CORTOS.forEach((l, i) => out.push(ref(chartId, l, "", 0, i)));
      break;
    }
    case "beneficios": {
      beneficiosMercado(M)
        .slice(0, 10)
        .forEach((row, i) => out.push(ref(chartId, row.label, "", 0, i)));
      break;
    }
    case "incben": {
      ["Operativo", "Administrativo"].forEach((l, i) => {
        out.push(ref(chartId, l, "Mercado", 0, i));
        out.push(ref(chartId, l, CLIENT_LABEL, 1, i));
      });
      break;
    }
    case "negociacion": {
      conteoLabels(M.map((e) => etapaNeg(e.neg))).forEach((row, i) =>
        out.push(ref(chartId, row.label, "", 0, i)),
      );
      break;
    }
    case "mixcontrata": {
      ["Reposición de bajas", "Posiciones nuevas"].forEach((l, i) =>
        out.push(ref(chartId, l, "", 0, i)),
      );
      break;
    }
    case "rotcomp": {
      ordenadasRot(M, ULT).forEach((row, i) => out.push(ref(chartId, row.id, "", 0, i)));
      break;
    }
    case "rotserie": {
      const series = [
        { key: "No controlada", datasetIndex: 0 },
        { key: "Controlada", datasetIndex: 1 },
        { key: CLIENT_LABEL, datasetIndex: 2 },
      ];
      datos.bimestres.forEach((bim, i) => {
        series.forEach((ser) => {
          if (ser.datasetIndex < 2) {
            out.push(ref(chartId, bim, ser.key, ser.datasetIndex, i));
          } else {
            out.push(ref(chartId, bim, ser.key, ser.datasetIndex, i));
          }
        });
      });
      break;
    }
    case "causas": {
      causasMercado(M)
        .slice(0, 10)
        .forEach((row, i) => out.push(ref(chartId, row.label, "", 0, i)));
      break;
    }
    case "ausentismo": {
      const series = [
        { key: "Mercado", datasetIndex: 0 },
        { key: CLIENT_LABEL, datasetIndex: 1 },
      ];
      datos.bimestres.forEach((bim, i) => {
        series.forEach((ser) => out.push(ref(chartId, bim, ser.key, ser.datasetIndex, i)));
      });
      break;
    }
    case "salrot": {
      const ids = M.filter((e) => e.sal[0] != null && e.rot[ULT] != null).map((e) => e.id);
      const otros = ids.filter((id) => id !== CLIENTE);
      ids.forEach((id) => {
        const isClient = id === CLIENTE;
        out.push(
          ref(
            chartId,
            id,
            isClient ? CLIENT_LABEL : "Otras empresas",
            isClient ? 1 : 0,
            isClient ? 0 : otros.indexOf(id),
          ),
        );
      });
      break;
    }
    case "plantbubble": {
      const pts = M.filter((e) => e.rot[ULT] != null);
      const otros = pts.filter((p) => p.id !== CLIENTE);
      const client = pts.filter((p) => p.id === CLIENTE);
      otros.forEach((e, i) =>
        out.push(ref(chartId, e.id, "Otras empresas", 0, i)),
      );
      client.forEach((e, i) =>
        out.push(ref(chartId, e.id, CLIENT_LABEL, 1, i)),
      );
      break;
    }
    case "rotmapa": {
      matrizRotTierTam(M, ULT).celdas.forEach((c, i) =>
        out.push(ref(chartId, `${c.tier} · ${c.tam}`, "Rotación", 0, i)),
      );
      break;
    }
    case "perfilradar": {
      const r = perfilRadar(M, getDemoClient());
      const series = [
        { key: "Promedio del mercado", datasetIndex: 0 },
        { key: CLIENT_LABEL, datasetIndex: 1 },
      ];
      r.labels.forEach((l, i) => {
        series.forEach((s) => out.push(ref(chartId, l, s.key, s.datasetIndex, i)));
      });
      break;
    }
    default:
      break;
  }
  return out;
}

function probeMatchesElement(probe: HighlightProbe, el: MonitorChartElementRef): boolean {
  if (typeof probe.datasetIndex === "number" && probe.datasetIndex !== el.datasetIndex) {
    return false;
  }
  if (typeof probe.index === "number" && probe.index !== el.index) {
    return false;
  }
  if (probe.seriesKey && el.seriesKey) {
    if (norm(probe.seriesKey) !== norm(el.seriesKey)) return false;
  }
  if (probe.category != null && probe.category !== "") {
    if (norm(probe.category) !== norm(el.category ?? "")) return false;
  }
  return true;
}

function elementKey(el: MonitorChartElementRef): string {
  return `${el.datasetIndex}:${el.index}:${el.seriesKey}:${el.category}`;
}

export function resolveMonitorHighlightProbe(
  chartId: MonitorChartId,
  probe: HighlightProbe,
): { ok: true; target: MonitorChartElementRef } | { ok: false; reason: HighlightResolveError } {
  const options = enumerateHighlightElements(chartId);
  if (!options.length) return { ok: false, reason: "no_options" };

  const hasCategory = probe.category != null && probe.category !== "";
  const hasIndex = typeof probe.index === "number";
  const hasDs = typeof probe.datasetIndex === "number";

  if (!hasCategory && !hasIndex) {
    return { ok: false, reason: "not_found" };
  }

  let matches = options.filter((el) => probeMatchesElement(probe, el));

  if (!matches.length && hasCategory) {
    const needle = norm(probe.category!);
    matches = options.filter((el) => {
      if (probe.seriesKey && el.seriesKey && norm(probe.seriesKey) !== norm(el.seriesKey)) {
        return false;
      }
      if (typeof probe.datasetIndex === "number" && probe.datasetIndex !== el.datasetIndex) {
        return false;
      }
      const cat = norm(el.category ?? "");
      return cat === needle || cat.includes(needle) || needle.includes(cat);
    });
  }

  if (!matches.length) return { ok: false, reason: "not_found" };

  const unique = new Map<string, MonitorChartElementRef>();
  matches.forEach((m) => unique.set(elementKey(m), m));
  matches = [...unique.values()];

  if (matches.length > 1) {
    if (hasDs && hasIndex) {
      const exact = matches.find(
        (m) => m.datasetIndex === probe.datasetIndex && m.index === probe.index,
      );
      if (exact) return { ok: true, target: exact };
    }
    return { ok: false, reason: "ambiguous" };
  }

  return { ok: true, target: matches[0]! };
}

export function highlightOptionsForChart(chartId: MonitorChartId, limit = 12): string[] {
  const els = enumerateHighlightElements(chartId);
  const labels = els.map((e) => {
    const sk = e.seriesKey ? `${e.seriesKey} · ` : "";
    return `${sk}${e.category}`;
  });
  return [...new Set(labels)].slice(0, limit);
}
