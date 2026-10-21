import { describe, expect, it } from "vitest";
import {
  MARKET_SESSION_PDF_FILENAME,
  MARKET_SESSION_PDF_PATH,
} from "./market-session-pdf";

describe("market-session-pdf", () => {
  it("expone ruta pública y nombre de archivo oficiales", () => {
    expect(MARKET_SESSION_PDF_PATH).toBe(
      "/monitor-v3/informes/Informe_sesion_mercado_JulAgo2025.pdf",
    );
    expect(MARKET_SESSION_PDF_FILENAME).toBe(
      "Informe_sesion_mercado_JulAgo2025.pdf",
    );
  });
});
