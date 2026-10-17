export function num(v: unknown): number | null {
  if (v === null || v === undefined || Number.isNaN(v as number)) return null;
  return v as number;
}

export function vals(a: (number | null | undefined)[]): number[] {
  return a.filter((v): v is number => v != null && !Number.isNaN(v));
}

export function prom(a: (number | null | undefined)[]): number | null {
  const v = vals(a);
  return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null;
}

export function promSinCeros(a: (number | null | undefined)[]): number | null {
  return prom(vals(a).filter((v) => v > 0));
}

export function cuantil(a: (number | null | undefined)[], q: number): number | null {
  const sorted = vals(a).sort((x, y) => x - y);
  if (!sorted.length) return null;
  const p = (sorted.length - 1) * q;
  const i = Math.floor(p);
  return sorted[i] + (sorted[Math.min(i + 1, sorted.length - 1)] - sorted[i]) * (p - i);
}

export function mediana(a: (number | null | undefined)[]): number | null {
  return cuantil(a, 0.5);
}

export function rango(lista: (number | null | undefined)[], v: number): number | null {
  const a = vals(lista);
  if (!a.length) return null;
  return a.filter((x) => x < v).length / a.length;
}

export function serieRotIndices(
  M: { rot: (number | null)[]; rnc: (number | null)[]; rc: (number | null)[] }[],
  bimestreCount: number,
): { total: (number | null)[]; nc: (number | null)[]; ct: (number | null)[] } {
  const total: (number | null)[] = [];
  const nc: (number | null)[] = [];
  const ct: (number | null)[] = [];
  for (let i = 0; i < bimestreCount; i++) {
    const p = M.filter((e) => (e.rot[i] ?? 0) > 0);
    total.push(prom(p.map((e) => e.rot[i])));
    nc.push(prom(p.map((e) => e.rnc[i])));
    ct.push(prom(p.map((e) => e.rc[i])));
  }
  return { total, nc, ct };
}
