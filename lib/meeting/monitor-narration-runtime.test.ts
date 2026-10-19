import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMonitorPasos } from "./monitor-pasos";
import { evaluateNarrationAdvanceGate } from "./monitor-narration-gate";
import {
  attemptNarrationAdvance,
  beginNarrationExecution,
  isStaleNarrationCallback,
  mergeAwaitingModeratorFlag,
  narrationMayAutoAdvance,
  applyNarrationPause,
} from "./monitor-narration-runtime";
import { planNarrationEchoId } from "./monitor-narration-echo";

describe("monitor narration runtime (Fase 6)", () => {
  const hoja = buildMonitorPasos().findIndex((p) => p.tipo === "hoja");

  it("cada ejecución tiene execId único", () => {
    const a = beginNarrationExecution(3, planNarrationEchoId(3), 1000);
    const b = beginNarrationExecution(3, planNarrationEchoId(3), 1001);
    assert.notEqual(a.execId, b.execId);
  });

  it("callbacks obsoletos se ignoran", () => {
    const state = beginNarrationExecution(5, "plan-narr-5");
    assert.equal(isStaleNarrationCallback(state, state.execId), false);
    assert.equal(isStaleNarrationCallback(state, "narr-exec-5-0"), true);
  });

  it("no hay auto-avance sin señal del proveedor", () => {
    const state = beginNarrationExecution(2, "plan-narr-2");
    assert.equal(narrationMayAutoAdvance(state), false);
    const attempt = attemptNarrationAdvance(state, state.execId, false);
    assert.equal(attempt.advanced, false);
    assert.equal(attempt.reason, "no_provider_end_signal");
  });

  it("pausa bloquea avance pendiente", () => {
    let state = beginNarrationExecution(2, "plan-narr-2");
    state = applyNarrationPause(state);
    const attempt = attemptNarrationAdvance(state, state.execId, false);
    assert.equal(attempt.reason, "paused");
  });

  it("hoja exige autorización del moderador (gate + runtime)", () => {
    const gate = evaluateNarrationAdvanceGate({
      stepIndex: hoja,
      role: "moderador",
      intent: "narration",
    });
    assert.equal(gate.awaitingModerator, true);
    let state = beginNarrationExecution(hoja, planNarrationEchoId(hoja));
    state = mergeAwaitingModeratorFlag(state, true);
    const attempt = attemptNarrationAdvance(state, state.execId, true);
    assert.equal(attempt.reason, "awaiting_moderator");
  });
});
