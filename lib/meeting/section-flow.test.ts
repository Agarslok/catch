import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMonitorPasos } from "./monitor-pasos";
import { generateSessionScript } from "./script";
import {
  continueSectionTargetStep,
  evaluateMonitorNarrationEnd,
  evaluateScriptNarrationEnd,
  firstStepOfNextSection,
  isLastExplicaStep,
  mayContinueSection,
  reconcileMonitorAwaitOnNavigate,
  scriptContinueTarget,
  shouldBlockDuplicateContinue,
} from "./section-flow";

describe("section flow (Fase 8)", () => {
  const pasos = buildMonitorPasos();
  const hoja0 = pasos.findIndex((p) => p.tipo === "hoja" && p.sectionIndex === 0);
  const lastExplica0 = pasos.findIndex(
    (p, i) => p.tipo === "explica" && p.sectionIndex === 0 && isLastExplicaStep(i, pasos),
  );
  const script = generateSessionScript("test-meeting");

  const baseMonitorInput = (stepIndex: number, execId = "exec-1") => ({
    stepIndex,
    execId,
    currentStepIndex: stepIndex,
    runtimeExecId: execId,
    pasos,
    dedup: null,
    narrationFinished: true,
  });

  it("1. último explica con narración terminada navega a hoja", () => {
    const d = evaluateMonitorNarrationEnd(baseMonitorInput(lastExplica0));
    assert.equal(d.kind, "navigate_hoja");
    if (d.kind === "navigate_hoja") assert.equal(d.targetStep, hoja0);
  });

  it("2b. temporizador estimado no cierra la sección", () => {
    const d = evaluateMonitorNarrationEnd({
      ...baseMonitorInput(lastExplica0),
      endSource: "timer_estimate",
    });
    assert.equal(d.kind, "ignore");
    assert.equal(d.reason, "unconfirmed_timer");
  });

  it("2. último punto sin narración terminada no cierra", () => {
    const d = evaluateMonitorNarrationEnd({
      ...baseMonitorInput(lastExplica0),
      narrationFinished: false,
    });
    assert.equal(d.kind, "ignore");
  });

  it("3. cierre duplicado en el mismo paso", () => {
    const first = evaluateMonitorNarrationEnd(baseMonitorInput(lastExplica0));
    assert.equal(first.kind, "navigate_hoja");
    const dedup = first.kind === "navigate_hoja" ? first.dedup : null;
    const second = evaluateMonitorNarrationEnd({
      ...baseMonitorInput(lastExplica0, "exec-2"),
      dedup,
    });
    assert.equal(second.kind, "deduped");
    const onHoja = evaluateMonitorNarrationEnd(baseMonitorInput(hoja0, "exec-3"));
    assert.equal(onHoja.kind, "await_moderator");
    const dedupHoja = onHoja.kind === "await_moderator" ? onHoja.dedup : null;
    const again = evaluateMonitorNarrationEnd({
      ...baseMonitorInput(hoja0, "exec-4"),
      dedup: dedupHoja,
    });
    assert.equal(again.kind, "deduped");
  });

  it("4. señal antigua tras cambiar de paso", () => {
    const d = evaluateMonitorNarrationEnd({
      ...baseMonitorInput(lastExplica0),
      currentStepIndex: hoja0,
    });
    assert.equal(d.kind, "ignore");
    if (d.kind === "ignore") assert.equal(d.reason, "step_changed");
  });

  it("5. explica intermedio avanza a la siguiente diapositiva de la misma sección", () => {
    const mid = pasos.findIndex((p) => p.tipo === "explica" && p.sectionIndex === 0);
    const d = evaluateMonitorNarrationEnd(baseMonitorInput(mid));
    assert.equal(d.kind, "navigate_next_slide");
    if (d.kind !== "navigate_next_slide") return;
    assert.equal(d.targetStep, mid + 1);
    assert.equal(pasos[d.targetStep]?.tipo, "explica");
    const targetPaso = pasos[d.targetStep];
    if (targetPaso?.tipo === "explica") {
      assert.equal(targetPaso.sectionIndex, 0);
    }
    const again = evaluateMonitorNarrationEnd({
      ...baseMonitorInput(mid),
      dedup: d.dedup,
    });
    assert.equal(again.kind, "deduped");
  });

  it("5a. tres diapositivas avanzan dentro de la sección y la última espera", () => {
    const three: typeof pasos = [
      { tipo: "explica", sectionIndex: 0, chartIndex: 0, chartId: "plantilla" },
      { tipo: "explica", sectionIndex: 0, chartIndex: 1, chartId: "procesos" },
      { tipo: "explica", sectionIndex: 0, chartIndex: 2, chartId: "tier" },
      { tipo: "hoja", sectionIndex: 0 },
      { tipo: "explica", sectionIndex: 1, chartIndex: 0, chartId: "salini" },
    ];
    const first = evaluateMonitorNarrationEnd({ ...baseMonitorInput(0), pasos: three });
    const second = evaluateMonitorNarrationEnd({ ...baseMonitorInput(1, "exec-b"), pasos: three });
    const last = evaluateMonitorNarrationEnd({ ...baseMonitorInput(2, "exec-c"), pasos: three });
    const wait = evaluateMonitorNarrationEnd({ ...baseMonitorInput(3, "exec-d"), pasos: three });
    assert.equal(first.kind, "navigate_next_slide");
    assert.equal(second.kind, "navigate_next_slide");
    assert.equal(last.kind, "navigate_hoja");
    assert.equal(wait.kind, "await_moderator");
    if (first.kind === "navigate_next_slide") assert.equal(first.targetStep, 1);
    if (second.kind === "navigate_next_slide") assert.equal(second.targetStep, 2);
    if (last.kind === "navigate_hoja") assert.equal(last.targetStep, 3);
    assert.notEqual(wait.kind, "navigate_next_slide");
  });

  it("5b. una sola diapositiva termina en la hoja de la sección, no en la siguiente", () => {
    const only: typeof pasos = [
      { tipo: "inicio" },
      { tipo: "explica", sectionIndex: 0, chartIndex: 0, chartId: "plantilla" },
      { tipo: "hoja", sectionIndex: 0 },
      { tipo: "explica", sectionIndex: 1, chartIndex: 0, chartId: "salini" },
    ];
    const d = evaluateMonitorNarrationEnd({
      ...baseMonitorInput(1),
      pasos: only,
    });
    assert.equal(d.kind, "navigate_hoja");
    if (d.kind === "navigate_hoja") assert.equal(d.targetStep, 2);
    const wait = evaluateMonitorNarrationEnd({
      ...baseMonitorInput(2),
      pasos: only,
    });
    assert.equal(wait.kind, "await_moderator");
  });

  it("6. hoja activa implica espera del moderador", () => {
    const d = evaluateMonitorNarrationEnd(baseMonitorInput(hoja0));
    assert.equal(d.kind, "await_moderator");
  });

  it("7–8. claridad en script no avanza sola; pregunta es otro canal", () => {
    const sec = script.sections[0];
    const lastChart = [...sec.pointIds]
      .reverse()
      .find((id) => script.points.find((x) => x.id === id)?.kind === "chart");
    assert.ok(lastChart);
    const sheet = script.points.find((p) => p.sectionId === sec.id && p.kind === "full_sheet");
    const clarity = script.points.find((p) => p.sectionId === sec.id && p.kind === "clarity_check");
    assert.ok(sheet && clarity);
    const goSheet = evaluateScriptNarrationEnd({
      pointId: lastChart!,
      execId: "e1",
      currentPointId: lastChart!,
      runtimeExecId: "e1",
      script,
      dedupAnchorPointId: null,
      narrationFinished: true,
    });
    assert.equal(goSheet.kind, "go_sheet");
    const goClarity = evaluateScriptNarrationEnd({
      pointId: sheet!.id,
      execId: "e2",
      currentPointId: sheet!.id,
      runtimeExecId: "e2",
      script,
      dedupAnchorPointId: null,
      narrationFinished: true,
    });
    assert.equal(goClarity.kind, "go_clarity");
  });

  it("11. continuar desde hoja válida", () => {
    const m = mayContinueSection({
      stepIndex: hoja0,
      awaitingModerator: true,
      role: "moderador",
      pasos,
    });
    assert.equal(m.ok, true);
    assert.equal(m.targetStep, firstStepOfNextSection(0, pasos));
  });

  it("12. continuar fuera de espera", () => {
    const mid = pasos.findIndex((p) => p.tipo === "explica");
    const m = mayContinueSection({
      stepIndex: mid,
      awaitingModerator: false,
      role: "moderador",
      pasos,
    });
    assert.equal(m.ok, false);
  });

  it("13. doble pulsación de continuación", () => {
    const now = 10_000;
    assert.equal(shouldBlockDuplicateContinue(null, now), false);
    assert.equal(shouldBlockDuplicateContinue(now - 500, now), true);
    assert.equal(shouldBlockDuplicateContinue(now - 3_000, now), false);
  });

  it("14. última sección continúa al cierre", () => {
    const lastHoja = pasos.reduce(
      (acc, p, i) => (p.tipo === "hoja" ? i : acc),
      -1,
    );
    const target = continueSectionTargetStep(lastHoja, pasos);
    assert.equal(pasos[target!]?.tipo, "cierre");
  });

  it("15. exploración individual no dispara cierre (punto distinto)", () => {
    const sec = script.sections[0];
    const lastChart = [...sec.pointIds]
      .reverse()
      .find((id) => script.points.find((x) => x.id === id)?.kind === "chart");
    const d = evaluateScriptNarrationEnd({
      pointId: lastChart!,
      execId: "e1",
      currentPointId: "intro",
      runtimeExecId: "e1",
      script,
      dedupAnchorPointId: null,
      narrationFinished: true,
    });
    assert.equal(d.kind, "ignore");
  });

  it("16. salir de hoja limpia espera", () => {
    const next = firstStepOfNextSection(0, pasos)!;
    const r = reconcileMonitorAwaitOnNavigate({ prevStep: hoja0, nextStep: next, pasos });
    assert.equal(r.awaitingModerator, false);
    assert.equal(r.clearDedup, true);
  });

  it("continuar en app React desde claridad", () => {
    const clarity = script.points.find((p) => p.kind === "clarity_check");
    assert.ok(clarity);
    const c = scriptContinueTarget(script, clarity!.id);
    assert.equal(c.ok, true);
    assert.ok(c.pointId);
  });

  it("continuar en app React desde hoja completa", () => {
    const sheet = script.points.find((p) => p.kind === "full_sheet");
    assert.ok(sheet);
    const c = scriptContinueTarget(script, sheet!.id);
    assert.equal(c.ok, true);
    assert.ok(c.pointId);
  });
});
