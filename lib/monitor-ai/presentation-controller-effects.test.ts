import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMonitorPasos } from "@/lib/meeting/monitor-pasos";
import { getDemoClientId } from "@/lib/monitor-data/dataset";
import {
  defaultControllerSnapshot,
  MONITOR_PRESENTATION_ACTION_CONTRACT,
  validateMonitorAiStructuredResponse,
} from "./action-contract";
import {
  applyPresentationEffects,
  narrationMayAdvanceFromStep,
  normalizePresentationEffects,
  posAfterPresentationEffects,
} from "./presentation-controller-effects";

describe("presentation controller effects adapter", () => {
  const pasos = buildMonitorPasos();
  const hoja = pasos.findIndex((p) => p.tipo === "hoja");

  it("normaliza efectos válidos del endpoint", () => {
    const raw = [
      { kind: "navigate", targetStep: 3 },
      {
        kind: "monitor_highlight",
        action: { type: "highlight", target: { chartId: "rotcomp", category: "x" } },
      },
      { kind: "narration", intent: "explain" },
      { kind: "section_continue" },
      { kind: "set_presentation_status", status: "paused" },
      { kind: "run_js", code: "alert(1)" },
    ];
    const norm = normalizePresentationEffects(raw);
    assert.equal(norm.length, 5);
    assert.equal(norm[0].kind, "navigate");
    assert.equal(norm[4].kind, "set_presentation_status");
  });

  it("aplica navigate solo vía moveModerator (moderador)", () => {
    let pos = 5;
    const r = applyPresentationEffects(
      [{ kind: "navigate", targetStep: 7 }],
      { role: "moderador", stepIndex: pos, stepCount: pasos.length },
      {
        moveModerator(target) {
          if (target === pos) return false;
          pos = target;
          return true;
        },
      },
    );
    assert.equal(r.navigated, true);
    assert.equal(pos, 7);
    assert.equal(r.posBefore, 5);
    assert.equal(r.posAfter, 7);
    assert.equal(r.skipped.length, 0);
  });

  it("visitante no ejecuta navigate ni section_continue", () => {
    let pos = 4;
    const r = applyPresentationEffects(
      [{ kind: "section_continue" }, { kind: "navigate", targetStep: 6 }],
      { role: "visitor", stepIndex: pos, stepCount: pasos.length },
      {
        moveModerator(target) {
          pos = target;
          return true;
        },
      },
    );
    assert.equal(r.navigated, false);
    assert.equal(pos, 4);
    assert.equal(r.skipped.length, 2);
    assert.ok(r.skipped.every((s) => s.reason === "visitor_forbidden"));
  });

  it("continue_section validado produce section_continue + navigate en orden", () => {
    const v = validateMonitorAiStructuredResponse(
      {
        contract: MONITOR_PRESENTATION_ACTION_CONTRACT,
        message: "Continuamos.",
        actions: [{ type: "continue_section" }],
      },
      defaultControllerSnapshot({ stepIndex: hoja }),
    );
    assert.equal(v.ok, true);
    if (!v.ok) return;
    let continued = false;
    let pos = hoja;
    applyPresentationEffects(v.effects, { role: "moderador", stepIndex: pos, stepCount: pasos.length }, {
      moveModerator(target) {
        pos = target;
        return true;
      },
      afterSectionContinue() {
        continued = true;
      },
    });
    assert.equal(continued, true);
    assert.equal(pos, hoja + 1);
  });

  it("next_slide en hoja: moderador navega; narración no puede auto-avanzar", () => {
    const v = validateMonitorAiStructuredResponse(
      {
        contract: MONITOR_PRESENTATION_ACTION_CONTRACT,
        message: "Siguiente.",
        actions: [{ type: "next_slide" }],
      },
      defaultControllerSnapshot({ stepIndex: hoja }),
    );
    assert.equal(v.ok, true);
    if (!v.ok) return;
    assert.equal(posAfterPresentationEffects(hoja, v.effects), hoja + 1);
    assert.equal(narrationMayAdvanceFromStep(hoja, "moderador"), false);
  });

  it("efectos inválidos del payload no se ejecutan", () => {
    const norm = normalizePresentationEffects([
      { kind: "navigate", targetStep: "bad" },
      null,
      { kind: "monitor_highlight", action: { type: "evil" } },
    ]);
    assert.equal(norm.length, 0);
    let pos = 2;
    const r = applyPresentationEffects(norm, { role: "moderador", stepIndex: pos }, {
      moveModerator(t) {
        pos = t;
        return true;
      },
    });
    assert.equal(pos, 2);
    assert.equal(r.navigated, false);
  });

  it("set_presentation_status se rechaza sin mutar posición", () => {
    let pos = 3;
    const r = applyPresentationEffects(
      [{ kind: "set_presentation_status", status: "paused" }],
      { role: "moderador", stepIndex: pos },
      {
        moveModerator(t) {
          pos = t;
          return true;
        },
      },
    );
    assert.equal(pos, 3);
    assert.equal(r.skipped[0]?.reason, "presentation_status_not_wired");
  });

  it("highlight legacy se expone para aplicarAccionResaltadoIA", () => {
    const v = validateMonitorAiStructuredResponse(
      {
        contract: MONITOR_PRESENTATION_ACTION_CONTRACT,
        message: "Resalto.",
        actions: [
          { type: "highlight_element", chartId: "rotcomp", category: getDemoClientId() },
        ],
      },
      defaultControllerSnapshot(),
    );
    assert.equal(v.ok, true);
    if (!v.ok) return;
    const r = applyPresentationEffects(v.effects, { role: "moderador", stepIndex: 0 }, {
      moveModerator() {
        return false;
      },
    });
    assert.ok(r.highlight);
    assert.equal(r.highlight!.type, "highlight");
  });

  it("moveModerator que rechaza no marca navigated", () => {
    const r = applyPresentationEffects(
      [{ kind: "navigate", targetStep: 9 }],
      { role: "moderador", stepIndex: 5, stepCount: pasos.length },
      { moveModerator: () => false },
    );
    assert.equal(r.navigated, false);
    assert.equal(r.skipped[0]?.reason, "navigate_rejected");
  });

  it("errores de ejecución no avanzan pasos inesperados", () => {
    let pos = 10;
    const v = validateMonitorAiStructuredResponse(
      {
        contract: MONITOR_PRESENTATION_ACTION_CONTRACT,
        message: "Mix.",
        actions: [
          { type: "highlight_element", chartId: "rotcomp", category: getDemoClientId() },
          { type: "next_slide" },
        ],
      },
      defaultControllerSnapshot({ stepIndex: 10 }),
    );
    assert.equal(v.ok, true);
    if (!v.ok) return;
    const r = applyPresentationEffects(v.effects, { role: "moderador", stepIndex: pos, stepCount: pasos.length }, {
      moveModerator(target) {
        if (target > pasos.length) return false;
        pos = target;
        return true;
      },
    });
    assert.equal(pos, 11);
    assert.equal(r.highlight?.type, "highlight");
  });
});
