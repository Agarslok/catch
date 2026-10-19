import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMonitorPasos } from "./monitor-pasos";
import { planMonitorNarration } from "./monitor-narration-plan";
import {
  planNarrationEchoId,
  preparePlanNarrationEcho,
} from "./monitor-narration-echo";

describe("monitor narration echo (plan → Tavus)", () => {
  const pasos = buildMonitorPasos();
  const explica = pasos.findIndex((p) => p.tipo === "explica");
  const hoja = pasos.findIndex((p) => p.tipo === "hoja");

  it("paso explica produce speakText y echoId estable", () => {
    const plan = planMonitorNarration(explica);
    const prep = preparePlanNarrationEcho(plan, explica);
    assert.equal(prep.ok, true);
    if (!prep.ok) return;
    assert.ok(prep.text.length > 20);
    assert.equal(prep.echoId, planNarrationEchoId(explica));
  });

  it("paso hoja puede narrarse sin implicar avance", () => {
    const plan = planMonitorNarration(hoja);
    assert.equal(plan.blockAdvance, true);
    const prep = preparePlanNarrationEcho(plan, hoja);
    assert.equal(prep.ok, true);
    if (!prep.ok) return;
    assert.match(prep.text, /resumen de la sección/i);
  });

  it("speakText vacío no prepara eco", () => {
    const prep = preparePlanNarrationEcho(
      {
        stepIndex: 99,
        stepKind: "inicio",
        speakText: "   ",
        highlightRef: null,
        segments: [],
        blockAdvance: false,
      },
      99,
    );
    assert.equal(prep.ok, false);
    if (prep.ok) return;
    assert.equal(prep.reason, "empty_speak_text");
  });

  it("mismo paso reutiliza echoId (dedup en speakEcho)", () => {
    assert.equal(planNarrationEchoId(5), planNarrationEchoId(5));
    assert.notEqual(planNarrationEchoId(5), planNarrationEchoId(6));
  });
});
