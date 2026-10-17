/**
 * Referencia de prueba: réplica de helpers del HTML (líneas ~328–362, 553–562).
 * Solo para parity.test.ts — no usar en producción.
 */
import type { Empresa } from "./types";
import { MIN_EMPRESAS, FILTER_ALL } from "./types";

export function refVals(a: (number | null | undefined)[]): number[] {
  return a.filter((v): v is number => v != null && !Number.isNaN(v));
}

export function refProm(a: (number | null | undefined)[]): number | null {
  const v = refVals(a);
  return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null;
}

export function refPromSinCeros(a: (number | null | undefined)[]): number | null {
  return refProm(refVals(a).filter((v) => v > 0));
}

export function refMercado(
  empresas: Empresa[],
  filters: { tier: string; tamano: string; proceso: string },
): { M: Empresa[]; aplicado: boolean } {
  const m = empresas.filter(
    (e) =>
      (filters.tier === FILTER_ALL || e.tier === filters.tier) &&
      (filters.tamano === FILTER_ALL || e.tamano === filters.tamano) &&
      (filters.proceso === FILTER_ALL || (e.procesos || []).includes(filters.proceso)),
  );
  return m.length >= MIN_EMPRESAS ? { M: m, aplicado: true } : { M: empresas, aplicado: false };
}

export function refSerieRot(M: Empresa[], bimestreCount: number) {
  const total: (number | null)[] = [];
  for (let i = 0; i < bimestreCount; i++) {
    const p = M.filter((e) => (e.rot[i] ?? 0) > 0);
    total.push(refProm(p.map((e) => e.rot[i])));
  }
  return total;
}
