import { getMonitorDataset } from "./dataset";
import { num, prom, rango, serieRotIndices, vals } from "./stats";
import type { Empresa } from "./types";

export function beneficiosMercado(M: Empresa[]) {
  const datos = getMonitorDataset();
  const r = M.filter((e) => e.ben.some((x) => x));
  if (!r.length) return [];
  return datos.beneficios
    .map((label, i) => ({
      i,
      label: label.replace("Incremento en ", "Incremento en "),
      v: r.filter((e) => e.ben[i]).length / r.length,
    }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v);
}

export function mixContratacion(lista: Empresa[], bimestreIndex: number) {
  let cn = 0;
  let cr = 0;
  lista.forEach((e) => {
    cn += num(e.cn?.[bimestreIndex]) || 0;
    cr += num(e.cr?.[bimestreIndex]) || 0;
  });
  const t = cn + cr || 1;
  return { cn, cr, total: t, pCn: cn / t, pCr: cr / t };
}

function percentilEnMuestra(
  lista: (number | null | undefined)[],
  v: number | null,
  invertir: boolean,
): number {
  const a = vals(lista);
  if (v == null || !a.length) return 0;
  const p = (rango(a, v) ?? 0) * 100;
  return invertir ? 100 - p : p;
}

export function perfilRadar(M: Empresa[], cli: Empresa) {
  const ULT = getMonitorDataset().bimestres.length - 1;
  const defs: [string, (e: Empresa) => number | null, boolean][] = [
    ["Rotación", (e) => e.rot[ULT], true],
    ["Ausentismo", (e) => e.aus[ULT], true],
    ["Salario inicial", (e) => e.sal[0], false],
    ["Incremento 2025", (e) => e.inc["2025"][0], false],
    ["Capacitación", (e) => e.cap, false],
  ];
  const labels = defs.map((d) => d[0]);
  const merc = defs.map(([, f, inv]) =>
    percentilEnMuestra(M.map(f), prom(vals(M.map(f))), inv),
  );
  const cliVals = defs.map(([, f, inv]) => percentilEnMuestra(M.map(f), f(cli), inv));
  return { labels, merc, cli: cliVals };
}

export function serieRotForDatos(M: Empresa[]) {
  const datos = getMonitorDataset();
  return serieRotIndices(M, datos.bimestres.length);
}
