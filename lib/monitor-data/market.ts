import type { DatosCapitalHumano, Empresa, MarketSlice, MonitorMarketFilters } from "./types";
import { FILTER_ALL, MIN_EMPRESAS } from "./types";

export function normalizeFilters(raw?: MonitorMarketFilters): {
  tier: string;
  tamano: string;
  proceso: string;
} {
  return {
    tier: raw?.tier?.trim() || FILTER_ALL,
    tamano: raw?.tamano?.trim() || FILTER_ALL,
    proceso: raw?.proceso?.trim() || FILTER_ALL,
  };
}

export function mercado(empresas: Empresa[], filters?: MonitorMarketFilters): MarketSlice {
  const f = normalizeFilters(filters);
  const m = empresas.filter(
    (e) =>
      (f.tier === FILTER_ALL || e.tier === f.tier) &&
      (f.tamano === FILTER_ALL || e.tamano === f.tamano) &&
      (f.proceso === FILTER_ALL || (e.procesos || []).includes(f.proceso)),
  );
  if (m.length >= MIN_EMPRESAS) {
    return { M: m, filtersApplied: true, filterSubsetCount: m.length };
  }
  return { M: empresas, filtersApplied: false, filterSubsetCount: m.length };
}

export function ultimoBimestreIndex(datos: DatosCapitalHumano): number {
  return datos.bimestres.length - 1;
}
