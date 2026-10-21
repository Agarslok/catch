/** PDF oficial de la reunión general de mercado (Jul–Ago 2025), servido desde /public. */
export const MARKET_SESSION_PDF_PATH = "/monitor-v3/informes/Informe_sesion_mercado_JulAgo2025.pdf";

export const MARKET_SESSION_PDF_FILENAME = "Informe_sesion_mercado_JulAgo2025.pdf";

export async function fetchOfficialMarketSessionPdf(): Promise<Blob | null> {
  try {
    const res = await fetch(MARKET_SESSION_PDF_PATH);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}
