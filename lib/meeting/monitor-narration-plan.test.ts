import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getDemoClientId } from "@/lib/monitor-data/dataset";
import {
  buildMonitorPasos,
  findPasoIndexForChart,
} from "./monitor-pasos";
import { planMonitorNarration, snapshotMonitorNarrationPlans } from "./monitor-narration-plan";

describe("monitor narration plan", () => {
  it("paso explica con texto disponible (plantilla)", () => {
    const idx = findPasoIndexForChart("plantilla");
    assert.ok(idx >= 0);
    const plan = planMonitorNarration(idx);
    assert.equal(plan.stepKind, "explica");
    assert.ok(plan.speakText && plan.speakText.length > 20);
    assert.match(plan.speakText, /empresas/i);
    assert.equal(plan.blockAdvance, false);
    assert.ok(plan.highlightRef);
    assert.equal(plan.highlightRef!.chartId, "plantilla");
    assert.equal(plan.highlightRef!.category, "Operativo");
  });

  it("paso hoja con blockAdvance true", () => {
    const pasos = buildMonitorPasos();
    const idx = pasos.findIndex((p) => p.tipo === "hoja" && p.sectionIndex === 0);
    assert.ok(idx >= 0);
    const plan = planMonitorNarration(idx);
    assert.equal(plan.stepKind, "hoja");
    assert.equal(plan.blockAdvance, true);
    assert.match(plan.speakText ?? "", /resumen de la sección/i);
  });

  it("paso cierre", () => {
    const pasos = buildMonitorPasos();
    const idx = pasos.length - 1;
    assert.equal(pasos[idx].tipo, "cierre");
    const plan = planMonitorNarration(idx);
    assert.equal(plan.stepKind, "cierre");
    assert.equal(plan.blockAdvance, false);
    assert.match(plan.speakText ?? "", /presentación ha finalizado/i);
  });

  it("índice inválido sin texto ni resaltado", () => {
    const pasos = buildMonitorPasos();
    const plan = planMonitorNarration(pasos.length + 99);
    assert.equal(plan.speakText, null);
    assert.equal(plan.highlightRef, null);
    assert.equal(plan.blockAdvance, false);
  });

  it("referencia de resaltado válida en paso explica", () => {
    const idx = findPasoIndexForChart("rotcomp");
    const plan = planMonitorNarration(idx, {
      highlight: { chartId: "rotcomp", category: getDemoClientId() },
    });
    assert.ok(plan.highlightRef);
    assert.equal(plan.highlightRef!.chartId, "rotcomp");
    assert.equal(plan.highlightRef!.category, getDemoClientId());
  });

  it("referencia inexistente o inválida devuelve null", () => {
    const idx = findPasoIndexForChart("plantilla");
    const wrongChart = planMonitorNarration(idx, {
      highlight: { chartId: "rotcomp", category: "Administrativo" },
    });
    assert.equal(wrongChart.highlightRef, null);

    const badCategory = planMonitorNarration(idx, {
      highlight: { chartId: "plantilla", category: "CategoríaInventada" },
    });
    assert.equal(badCategory.highlightRef, null);
  });

  it("no modifica la secuencia de pasos (sin efectos secundarios)", () => {
    const before = buildMonitorPasos().map((p) =>
      p.tipo === "explica" ? `${p.chartId}` : p.tipo,
    );
    planMonitorNarration(3, {
      highlight: { chartId: "plantilla", category: "Operativo" },
    });
    planMonitorNarration(999);
    const after = buildMonitorPasos().map((p) =>
      p.tipo === "explica" ? `${p.chartId}` : p.tipo,
    );
    assert.deepEqual(after, before);
  });

  it("snapshot tiene un plan por paso, alineado con el índice", () => {
    const pasos = buildMonitorPasos();
    const snap = snapshotMonitorNarrationPlans();
    assert.equal(snap.length, pasos.length);
    assert.equal(snap[0].stepKind, "inicio");
    assert.equal(snap[0].stepIndex, 0);
    const hoja = pasos.findIndex((p) => p.tipo === "hoja");
    assert.equal(snap[hoja].blockAdvance, true);
    assert.equal(snap[pasos.length - 1].stepKind, "cierre");
  });
});
