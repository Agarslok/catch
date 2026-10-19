import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getDemoClientId } from "@/lib/monitor-data/dataset";
import { resolveMonitorHighlightProbe } from "@/lib/monitor-ai/highlight-elements";
import {
  elementMatchesHighlight,
  highlightRefKey,
  interactionStateForPresentation,
  labelsMatch,
  shouldClearHighlightOnStepChange,
} from "./chart-highlight-visual";

describe("chart highlight visual", () => {
  it("resuelve Administrativo en plantilla por datos reales", () => {
    const r = resolveMonitorHighlightProbe("plantilla", { category: "Administrativo" });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.target.category, "Administrativo");
    assert.equal(r.target.datasetIndex, 0);
    assert.ok(elementMatchesHighlight(r.target, "plantilla", 0, 1, "Administrativo"));
  });

  it("rechaza categoría inexistente en plantilla", () => {
    const r = resolveMonitorHighlightProbe("plantilla", { category: "Comercial" });
    assert.equal(r.ok, false);
  });

  it("resuelve barra demo en rotcomp", () => {
    const id = getDemoClientId();
    const r = resolveMonitorHighlightProbe("rotcomp", { category: id });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.target.chartId, "rotcomp");
  });

  it("cambia de categoría actualiza la clave de deduplicación", () => {
    const a = highlightRefKey({ chartId: "plantilla", category: "Operativo", datasetIndex: 0, index: 0 });
    const b = highlightRefKey({ chartId: "plantilla", category: "Administrativo", datasetIndex: 0, index: 1 });
    assert.notEqual(a, b);
  });

  it("mismo evento dos veces produce la misma clave", () => {
    const ref = { chartId: "rotcomp", category: getDemoClientId(), datasetIndex: 0, index: 3 };
    assert.equal(highlightRefKey(ref), highlightRefKey({ ...ref }));
  });

  it("limpia resaltado al cambiar de diapositiva sin esa gráfica", () => {
    assert.equal(
      shouldClearHighlightOnStepChange(["plantilla"], { chartId: "rotcomp", category: "x" }),
      true,
    );
    assert.equal(
      shouldClearHighlightOnStepChange(["plantilla", "rotcomp"], { chartId: "rotcomp", category: "x" }),
      false,
    );
  });

  it("interactionState atenúa otras categorías", () => {
    const hi = { chartId: "plantilla", category: "Administrativo" };
    assert.equal(interactionStateForPresentation("Administrativo", hi, null), "highlighted");
    assert.equal(interactionStateForPresentation("Operativo", hi, null), "muted");
    assert.equal(interactionStateForPresentation("Operativo", null, "Operativo"), "selected");
  });

  it("labelsMatch ignora mayúsculas y acentos", () => {
    assert.equal(labelsMatch("Administrativo", "administrativo"), true);
  });
});
