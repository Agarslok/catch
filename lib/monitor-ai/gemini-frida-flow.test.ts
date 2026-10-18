import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMonitorPasos } from "@/lib/meeting/monitor-pasos";
import { decideStepEnter } from "@/lib/meeting/monitor-narration-step-enter";
import { planMonitorNarration } from "@/lib/meeting/monitor-narration-plan";
import { mergeIncomingGlobalView } from "@/lib/meeting/meeting-state-sync";
import { runMonitorAiInterpret } from "./interpret";
import { defaultControllerSnapshot } from "./action-contract";
import { applyPresentationEffects } from "./presentation-controller-effects";

function applyAsModerator(stepIndex: number, effects: Parameters<typeof applyPresentationEffects>[0]) {
  let pos = stepIndex;
  const r = applyPresentationEffects(
    effects,
    { role: "moderador", stepIndex: pos, stepCount: buildMonitorPasos().length },
    {
      moveModerator(target) {
        if (target === pos) return false;
        pos = target;
        return true;
      },
    },
  );
  return { ...r, pos };
}

describe("flujo Gemini → controlador → narración (sin proveedor)", () => {
  const pasos = buildMonitorPasos();
  const last = pasos.length - 1;

  it("«Avanza» produce next_slide, mueve el punto y deja narración del paso nuevo", async () => {
    const r = await runMonitorAiInterpret({
      meetingId: "demo",
      instruction: "Avanza",
      snapshot: defaultControllerSnapshot({ stepIndex: 0, stepCount: pasos.length }),
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.body.message, "Siguiente punto.");
    assert.equal(r.body.meta.providerCalled, false);
    assert.ok(r.body.effects.some((e) => e.kind === "navigate"));
    const applied = applyAsModerator(0, r.body.effects);
    assert.equal(applied.navigated, true);
    assert.equal(applied.posBefore, 0);
    assert.equal(applied.posAfter, 1);
    assert.equal(applied.pos, 1);
    assert.deepEqual(applied.narrationIntents, []);
    const plan = planMonitorNarration(applied.pos);
    const enter = decideStepEnter({ stepIndex: applied.pos, plan, generation: 2 });
    assert.equal(enter.skip, false);
    assert.equal(enter.speak, true);
    assert.ok(enter.speakText && enter.speakText.length > 10);
  });

  it("«Avanza» en el último punto no navega", async () => {
    const r = await runMonitorAiInterpret({
      meetingId: "demo",
      instruction: "Avanza",
      snapshot: defaultControllerSnapshot({ stepIndex: last, stepCount: pasos.length }),
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.body.effects.length, 0);
    assert.ok(r.body.clarificationRequest);
    const applied = applyAsModerator(last, r.body.effects);
    assert.equal(applied.navigated, false);
    assert.equal(applied.pos, last);
  });

  it("visitante no puede ejecutar navigate aunque el efecto exista", () => {
    let pos = 3;
    const r = applyPresentationEffects(
      [{ kind: "navigate", targetStep: 4 }],
      { role: "cliente", stepIndex: pos, stepCount: pasos.length },
      {
        moveModerator(target) {
          pos = target;
          return true;
        },
      },
    );
    assert.equal(r.navigated, false);
    assert.equal(pos, 3);
    assert.equal(r.skipped[0]?.reason, "visitor_forbidden");
  });

  it("exploración local no pisa el estado global al fusionar vacío", () => {
    const merged = mergeIncomingGlobalView(
      { awaitingModerator: false, munFilter: "total" },
      undefined,
    );
    assert.equal(merged.awaitingModerator, false);
    assert.equal(merged.munFilter, "total");
  });
});
