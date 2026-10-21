import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildGeminiReferenceBlock } from "./dael-reference";
import { getMonitorEmpresas } from "@/lib/monitor-data/dataset";

describe("dael-reference", () => {
  it("incluye tamaño de muestra y edición en el bloque Gemini", () => {
    const block = buildGeminiReferenceBlock({ sectionKey: "muestra" });
    assert.match(block, /Jul–Ago 2025|Jul-Ago 2025/);
    assert.match(block, new RegExp(`${getMonitorEmpresas().length} empresas`));
    assert.match(block, /67%|pronóstico/i);
  });
});
