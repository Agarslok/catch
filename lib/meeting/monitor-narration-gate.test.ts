import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMonitorPasos, findPasoIndexForChart } from "./monitor-pasos";
import { planMonitorNarration } from "./monitor-narration-plan";
import {
  applyModeratorManualAdvance,
  applyNarrationAdvanceAttempt,
  evaluateNarrationAdvanceGate,
  planAwaitsModerator,
} from "./monitor-narration-gate";

describe("monitor narration gate", () => {
  const pasos = buildMonitorPasos();
  const hojaIdx = pasos.findIndex((p) => p.tipo === "hoja");
  const explicaIdx = findPasoIndexForChart("plantilla");
  const cierreIdx = pasos.length - 1;

  it("paso hoja activa la espera de autorización", () => {
    const gate = evaluateNarrationAdvanceGate({
      stepIndex: hojaIdx,
      role: "moderador",
      intent: "narration",
    });
    assert.equal(gate.plan.stepKind, "hoja");
    assert.equal(gate.awaitingModerator, true);
    assert.equal(planAwaitsModerator(gate.plan), true);
    assert.equal(gate.mayAdvance, false);
    assert.equal(gate.reason, "awaiting_moderator");
  });

  it("calcular el plan no cambia S.pos", () => {
    const meeting = { pos: explicaIdx };
    planMonitorNarration(meeting.pos);
    evaluateNarrationAdvanceGate({
      stepIndex: meeting.pos,
      role: "moderador",
      intent: "narration",
    });
    assert.equal(meeting.pos, explicaIdx);
  });

  it("la espera no provoca un avance por sí sola", () => {
    const meeting = { pos: hojaIdx };
    const attempt = applyNarrationAdvanceAttempt(meeting, "moderador");
    assert.equal(attempt.ok, false);
    assert.equal(attempt.pos, hojaIdx);
    assert.equal(meeting.pos, hojaIdx);
    assert.equal(attempt.gate.awaitingModerator, true);
  });

  it("un visitante no puede autorizar el avance", () => {
    const meeting = { pos: hojaIdx };
    for (const role of ["cliente", "movil", "visitor"] as const) {
      const gate = evaluateNarrationAdvanceGate({
        stepIndex: hojaIdx,
        role,
        intent: "moderator_control",
      });
      assert.equal(gate.mayAdvance, false, role);
      assert.equal(gate.reason, "visitor_forbidden", role);
      const applied = applyModeratorManualAdvance(meeting, hojaIdx + 1, role);
      assert.equal(applied.ok, false);
      assert.equal(meeting.pos, hojaIdx);
    }
  });

  it("el moderador puede continuar con el control manual", () => {
    const meeting = { pos: hojaIdx };
    const target = hojaIdx + 1;
    const applied = applyModeratorManualAdvance(meeting, target, "moderador");
    assert.equal(applied.ok, true);
    assert.equal(applied.gate.reason, "ok");
    assert.equal(meeting.pos, target);
  });

  it("explica y cierre no activan la espera", () => {
    const explica = evaluateNarrationAdvanceGate({
      stepIndex: explicaIdx,
      role: "moderador",
      intent: "narration",
    });
    assert.equal(explica.plan.stepKind, "explica");
    assert.equal(explica.awaitingModerator, false);
    assert.equal(explica.mayAdvance, false);
    assert.equal(explica.reason, "narration_cannot_auto_advance");

    const cierre = evaluateNarrationAdvanceGate({
      stepIndex: cierreIdx,
      role: "moderador",
      intent: "narration",
    });
    assert.equal(cierre.plan.stepKind, "cierre");
    assert.equal(cierre.awaitingModerator, false);
    assert.equal(cierre.mayAdvance, false);
  });
});
