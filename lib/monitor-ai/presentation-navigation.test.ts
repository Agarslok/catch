import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMonitorPasos, findPasoIndexForChart } from "@/lib/meeting/monitor-pasos";
import {
  defaultControllerSnapshot,
  validateMonitorAiStructuredResponse,
} from "./action-contract";
import { stepAfterNavigateEffects } from "./presentation-navigation";
import { resolveModeratorNavInstruction } from "./nav-instruction";

describe("presentation navigation (consecutive interpret)", () => {
  const pasos = buildMonitorPasos();
  const start = findPasoIndexForChart("plantilla");
  const hoja = pasos.findIndex((p) => p.tipo === "hoja");
  const last = pasos.length - 1;

  function validateNext(stepIndex: number) {
    return validateMonitorAiStructuredResponse(
      {
        contract: "catch.monitor.presentation.actions.v1",
        message: "Avanzamos.",
        actions: [{ type: "next_slide" }],
      },
      defaultControllerSnapshot({ stepIndex, stepCount: pasos.length }),
    );
  }

  function validatePrev(stepIndex: number) {
    return validateMonitorAiStructuredResponse(
      {
        contract: "catch.monitor.presentation.actions.v1",
        message: "Retrocedemos.",
        actions: [{ type: "previous_slide" }],
      },
      defaultControllerSnapshot({ stepIndex, stepCount: pasos.length }),
    );
  }

  it("varias next_slide consecutivas usan el paso actualizado", () => {
    let step = start;
    for (let i = 0; i < 3; i++) {
      const v = validateNext(step);
      assert.equal(v.ok, true, `step ${step}`);
      if (!v.ok) return;
      step = stepAfterNavigateEffects(step, v.effects);
      assert.equal(step, start + i + 1);
    }
  });

  it("secuencia mixta avanzar y retroceder", () => {
    let step = start;
    const ops = [validateNext, validateNext, validatePrev, validateNext, validatePrev] as const;
    const expected = [start + 1, start + 2, start + 1, start + 2, start + 1];
    for (let i = 0; i < ops.length; i++) {
      const v = ops[i](step);
      assert.equal(v.ok, true);
      if (!v.ok) return;
      step = stepAfterNavigateEffects(step, v.effects);
      assert.equal(step, expected[i]);
    }
  });

  it("rechaza next_slide en el último paso sin mover", () => {
    const v = validateNext(last);
    assert.equal(v.ok, false);
    assert.equal(stepAfterNavigateEffects(last, []), last);
  });

  it("rechaza previous_slide en el primer paso", () => {
    const v = validatePrev(0);
    assert.equal(v.ok, false);
  });

  it("next_slide en hoja avanza como el botón Siguiente", () => {
    const v = validateNext(hoja);
    assert.equal(v.ok, true);
    if (!v.ok) return;
    assert.equal(stepAfterNavigateEffects(hoja, v.effects), hoja + 1);
  });

  it("detecta instrucciones de siguiente y anterior", () => {
    assert.equal(resolveModeratorNavInstruction("Avanza al siguiente punto"), "next_slide");
    assert.equal(resolveModeratorNavInstruction("Regresa al punto anterior"), "previous_slide");
    assert.equal(resolveModeratorNavInstruction("Explica esta gráfica"), null);
    assert.equal(resolveModeratorNavInstruction("Ve a la sección de salarios"), null);
  });

  it("visitante no puede next_slide", () => {
    const v = validateMonitorAiStructuredResponse(
      {
        contract: "catch.monitor.presentation.actions.v1",
        message: "Avanza.",
        actions: [{ type: "next_slide" }],
      },
      defaultControllerSnapshot({ stepIndex: start, role: "visitor" }),
    );
    assert.equal(v.ok, false);
  });

  it("dos peticiones simuladas no reutilizan el mismo stepIndex obsoleto", () => {
    let step = start;
    const first = validateNext(step);
    assert.equal(first.ok, true);
    if (!first.ok) return;
    step = stepAfterNavigateEffects(step, first.effects);
    const second = validateNext(step);
    assert.equal(second.ok, true);
    if (!second.ok) return;
    const nav = second.effects.find((e) => e.kind === "navigate");
    assert.ok(nav && nav.kind === "navigate");
    assert.equal(nav.targetStep, step + 1);
  });
});
