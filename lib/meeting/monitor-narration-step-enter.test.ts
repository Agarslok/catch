import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getDemoClientId } from "@/lib/monitor-data/dataset";
import { buildMonitorPasos, findPasoIndexForChart } from "./monitor-pasos";
import { planMonitorNarration } from "./monitor-narration-plan";
import {
  applyStepEnterToRuntime,
  decideStepEnter,
  planMatchesActiveStep,
  shouldIgnoreStepEnterCallback,
} from "./monitor-narration-step-enter";

describe("monitor narration step enter (Fase 6.1)", () => {
  const pasos = buildMonitorPasos();
  const plantilla = findPasoIndexForChart("plantilla");
  const rotcomp = findPasoIndexForChart("rotcomp");
  const hoja = pasos.findIndex((p) => p.tipo === "hoja");

  it("paso explica: speakText y highlightRef del mismo punto", () => {
    const plan = planMonitorNarration(plantilla);
    assert.equal(planMatchesActiveStep(plan, plantilla), true);
    const d = decideStepEnter({ stepIndex: plantilla, plan, generation: 1 });
    assert.equal(d.skip, false);
    assert.equal(d.speak, true);
    assert.ok(d.speakText && d.speakText.length > 20);
    assert.ok(d.highlightAction && d.highlightAction.type === "highlight");
    if (d.highlightAction?.type === "highlight") {
      assert.equal(d.highlightAction.target.chartId, "plantilla");
      assert.equal(d.highlightAction.target.category, "Operativo");
    }
    assert.equal(d.awaitingModerator, false);
    assert.equal(d.runtimeStatus, "speaking");
  });

  it("rotcomp resalta la empresa demo (dato real)", () => {
    const plan = planMonitorNarration(rotcomp);
    const d = decideStepEnter({ stepIndex: rotcomp, plan, generation: 2 });
    assert.equal(d.skip, false);
    if (d.highlightAction?.type === "highlight") {
      assert.equal(d.highlightAction.target.chartId, "rotcomp");
      assert.equal(d.highlightAction.target.category, getDemoClientId());
    }
  });

  it("plan de otro paso no se aplica", () => {
    const plan = planMonitorNarration(plantilla);
    const d = decideStepEnter({ stepIndex: rotcomp, plan, generation: 1 });
    assert.equal(d.skip, true);
    assert.equal(d.reason, "plan_mismatch");
    assert.equal(d.speak, false);
    assert.equal(d.highlightAction, null);
  });

  it("el mismo cambio de punto no se duplica", () => {
    const plan = planMonitorNarration(plantilla);
    const first = decideStepEnter({ stepIndex: plantilla, plan, generation: 4 });
    const second = decideStepEnter({
      stepIndex: plantilla,
      plan,
      generation: 4,
      lastApplied: { stepIndex: plantilla, generation: 4 },
    });
    assert.equal(first.skip, false);
    assert.equal(second.skip, true);
    assert.equal(second.reason, "duplicate_step_enter");
  });

  it("dos cambios consecutivos generan execId distintos", () => {
    const a = decideStepEnter({
      stepIndex: plantilla,
      plan: planMonitorNarration(plantilla),
      generation: 1,
      now: 1000,
    });
    const b = decideStepEnter({
      stepIndex: rotcomp,
      plan: planMonitorNarration(rotcomp),
      generation: 2,
      now: 1001,
      lastApplied: { stepIndex: plantilla, generation: 1 },
    });
    assert.notEqual(a.execId, b.execId);
    assert.notEqual(a.echoId, b.echoId);
    const runtime = applyStepEnterToRuntime(b);
    assert.equal(shouldIgnoreStepEnterCallback(runtime, a.execId), true);
    assert.equal(shouldIgnoreStepEnterCallback(runtime, b.execId), false);
  });

  it("hoja narra sin highlight de gráfica única y espera moderador", () => {
    const plan = planMonitorNarration(hoja);
    const d = decideStepEnter({ stepIndex: hoja, plan, generation: 1 });
    assert.equal(d.skip, false);
    assert.equal(d.speak, true);
    assert.equal(d.awaitingModerator, true);
    assert.equal(d.runtimeStatus, "awaiting_moderator");
    assert.equal(d.highlightAction, null);
  });
});
