import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMonitorPasos, findPasoIndexForChart } from "@/lib/meeting/monitor-pasos";
import {
  defaultControllerSnapshot,
  validateMonitorAiStructuredResponse,
} from "./action-contract";
import { resolveDirectModeratorInstruction } from "./direct-instruction";
import { matchInstructionTargets } from "./interpret-context";
import { runMonitorAiInterpret } from "./interpret";
import { applyPresentationEffects } from "./presentation-controller-effects";

function applyNav(stepIndex: number, effects: Parameters<typeof applyPresentationEffects>[0]) {
  let pos = stepIndex;
  let moves = 0;
  const r = applyPresentationEffects(
    effects,
    { role: "moderador", stepIndex: pos, stepCount: buildMonitorPasos().length },
    {
      moveModerator(target) {
        if (target === pos) return false;
        pos = target;
        moves += 1;
        return true;
      },
    },
  );
  return { ...r, pos, moves };
}

describe("resolveDirectModeratorInstruction", () => {
  it("repite sin proponer navegación", () => {
    const d = resolveDirectModeratorInstruction("Repite la explicación");
    assert.equal(d?.kind, "actions");
    if (d?.kind === "actions") {
      assert.deepEqual(d.actions, [{ type: "repeat_explanation" }]);
    }
  });

  it("resalta categoría en la gráfica del paso actual sin modelo", () => {
    const plantilla = findPasoIndexForChart("plantilla");
    const snap = defaultControllerSnapshot({ stepIndex: plantilla });
    const d = resolveDirectModeratorInstruction("Resalta Administrativo", snap);
    assert.equal(d?.kind, "actions");
    if (d?.kind === "actions") {
      assert.deepEqual(d.actions, [
        { type: "highlight_element", chartId: "plantilla", category: "Administrativo" },
      ]);
    }
    const validated = validateMonitorAiStructuredResponse(
      {
        contract: "catch.monitor.presentation.actions.v1",
        message: d?.kind === "actions" ? d.message : "",
        actions: d?.kind === "actions" ? d.actions : [],
      },
      { ...snap, view: undefined },
    );
    assert.equal(validated.ok, true);
    if (validated.ok) {
      assert.equal(validated.effects.length, 1);
      assert.equal(validated.effects[0].kind, "monitor_highlight");
    }
  });

  it("acepta «repite» y «vuelve a explicar»", () => {
    assert.equal(resolveDirectModeratorInstruction("repite")?.kind, "actions");
    const d = resolveDirectModeratorInstruction("vuelve a explicar");
    assert.equal(d?.kind, "actions");
    if (d?.kind === "actions") assert.equal(d.actions[0]?.type, "repeat_explanation");
  });

  it("marca pausa global como no disponible", () => {
    const d = resolveDirectModeratorInstruction("Pausa la presentación");
    assert.equal(d?.kind, "unavailable");
  });

  it("sección ambigua pide aclaración", () => {
    const d = resolveDirectModeratorInstruction("Ve a la sección de rotación");
    assert.equal(d?.kind, "clarification");
  });

  it("sección inexistente pide aclaración", () => {
    const d = resolveDirectModeratorInstruction("Ve a la sección de ventas");
    assert.equal(d?.kind, "clarification");
  });
});

describe("named destinations (Fase 7.3)", () => {
  const salarios = findPasoIndexForChart("salini");
  const cuando = findPasoIndexForChart("cuandosevan");

  it("sección existente y única", async () => {
    const r = await runMonitorAiInterpret({
      meetingId: "demo",
      instruction: "Ve a la sección de salarios",
      snapshot: defaultControllerSnapshot({ stepIndex: 0 }),
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.body.actions[0]?.type, "go_to_section");
    const nav = r.body.effects.find((e) => e.kind === "navigate");
    assert.ok(nav && nav.kind === "navigate");
    assert.equal(nav.targetStep, salarios);
    const applied = applyNav(0, r.body.effects);
    assert.equal(applied.moves, 1);
    assert.equal(applied.pos, salarios);
  });

  it("gráfica existente y única (cuándo se van)", async () => {
    assert.equal(matchInstructionTargets("Ve a la sección de cuándo se van").kind, "chart");
    const r = await runMonitorAiInterpret({
      meetingId: "demo",
      instruction: "Ve a la sección de cuándo se van",
      snapshot: defaultControllerSnapshot({ stepIndex: 0 }),
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    const action = r.body.actions[0];
    if (action?.type === "go_to_section") assert.equal(action.chartId, "cuandosevan");
    const nav = r.body.effects.find((e) => e.kind === "navigate");
    assert.ok(nav && nav.kind === "navigate");
    assert.equal(nav.targetStep, cuando);
    assert.notEqual(nav.targetStep, salarios);
  });

  it("gráfica de salarios es ambigua entre varias gráficas", () => {
    const m = matchInstructionTargets("Muéstrame la gráfica de salarios");
    assert.equal(m.kind, "ambiguous");
  });

  it("una pregunta que ya trae la diapositiva no pide aclarar sección o gráfica", () => {
    const q =
      "En la diapositiva actual (paso 2, sección «Contexto y muestra») («Empleados por tipo de personal»), en la gráfica «Empleados por tipo de personal» (plantilla), seleccioné barra «Operativo». ¿Qué representa y cómo debe interpretarse según los datos de esta visualización?";
    assert.equal(matchInstructionTargets(q).kind, "none");
    assert.equal(resolveDirectModeratorInstruction(q), null);
  });

  it("si la sección y la gráfica ya son la diapositiva actual, no pide elegir", () => {
    const q = "En la sección Contexto y muestra, la gráfica Empleados por tipo de personal, ¿qué representa el operativo?";
    const plantilla = findPasoIndexForChart("plantilla");
    assert.equal(matchInstructionTargets(q).kind, "ambiguous");
    assert.equal(
      resolveDirectModeratorInstruction(q, defaultControllerSnapshot({ stepIndex: plantilla })),
      null,
    );
  });

  it("destino inexistente", async () => {
    const r = await runMonitorAiInterpret({
      meetingId: "demo",
      instruction: "Ve a la sección de ventas internaciones",
      snapshot: defaultControllerSnapshot({ stepIndex: 0 }),
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.body.effects.length, 0);
    assert.ok(r.body.clarificationRequest);
  });

  it("destino ambiguo no elige la primera coincidencia", async () => {
    const r = await runMonitorAiInterpret({
      meetingId: "demo",
      instruction: "Ve a la sección de rotación",
      snapshot: defaultControllerSnapshot({ stepIndex: 0 }),
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.body.effects.length, 0);
    assert.ok(r.body.clarificationRequest);
    assert.match(r.body.clarificationRequest, /gráfica|sección/i);
  });

  it("regresa a la sección anterior desde indicadores", async () => {
    const indicadores = findPasoIndexForChart("rotserie");
    const r = await runMonitorAiInterpret({
      meetingId: "demo",
      instruction: "Regresa a la sección anterior",
      snapshot: defaultControllerSnapshot({ stepIndex: indicadores }),
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    const nav = r.body.effects.find((e) => e.kind === "navigate");
    assert.ok(nav && nav.kind === "navigate");
    assert.equal(nav.targetStep, findPasoIndexForChart("paquete"));
  });

  it("no navega dos veces al mismo destino", async () => {
    const r = await runMonitorAiInterpret({
      meetingId: "demo",
      instruction: "Ve a la sección de salarios",
      snapshot: defaultControllerSnapshot({ stepIndex: salarios }),
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.body.effects.filter((e) => e.kind === "navigate").length, 0);
    const applied = applyNav(salarios, r.body.effects);
    assert.equal(applied.moves, 0);
    assert.equal(applied.pos, salarios);
  });
});

describe("runMonitorAiInterpret direct paths", () => {
  const pasos = buildMonitorPasos();
  const hoja = pasos.findIndex((p) => p.tipo === "hoja");
  const rotcomp = findPasoIndexForChart("rotserie");

  it("continúa sección en hoja cuando el gate lo permite", async () => {
    const r = await runMonitorAiInterpret({
      meetingId: "demo",
      instruction: "Ya respondimos las preguntas; continúa",
      snapshot: defaultControllerSnapshot({ stepIndex: hoja }),
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.ok(r.body.effects.some((e) => e.kind === "section_continue"));
    assert.ok(r.body.effects.some((e) => e.kind === "navigate"));
    assert.equal(r.body.meta.providerCalled, false);
    const applied = applyNav(hoja, r.body.effects);
    assert.equal(applied.moves, 1);
    assert.equal(applied.pos, hoja + 1);
  });

  it("sigamos con la presentación exige awaitingModerator", async () => {
    const r = await runMonitorAiInterpret({
      meetingId: "demo",
      instruction: "Sigamos con la presentación",
      snapshot: defaultControllerSnapshot({ stepIndex: 2 }),
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.body.effects.length, 0);
    assert.ok(r.body.clarificationRequest);
  });

  it("rechaza continuar cuando no hay espera de moderador", async () => {
    const r = await runMonitorAiInterpret({
      meetingId: "demo",
      instruction: "Ya respondimos las preguntas; continúa",
      snapshot: defaultControllerSnapshot({ stepIndex: 2 }),
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.body.effects.length, 0);
    assert.ok(r.body.clarificationRequest);
  });

  it("segunda continuación no vuelve a avanzar", async () => {
    const first = await runMonitorAiInterpret({
      meetingId: "demo",
      instruction: "Continúa con la siguiente sección",
      snapshot: defaultControllerSnapshot({ stepIndex: hoja }),
    });
    assert.equal(first.ok, true);
    if (!first.ok) return;
    const after = applyNav(hoja, first.body.effects);
    const second = await runMonitorAiInterpret({
      meetingId: "demo",
      instruction: "Continúa con la siguiente sección",
      snapshot: defaultControllerSnapshot({ stepIndex: after.pos }),
    });
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.body.effects.length, 0);
    const appliedAgain = applyNav(after.pos, second.body.effects);
    assert.equal(appliedAgain.moves, 0);
    assert.equal(appliedAgain.pos, after.pos);
  });

  it("repite sin efectos de navegación", async () => {
    const r = await runMonitorAiInterpret({
      meetingId: "demo",
      instruction: "Repite la explicación",
      snapshot: defaultControllerSnapshot({ stepIndex: rotcomp }),
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.ok(r.body.effects.every((e) => e.kind !== "navigate"));
    assert.ok(r.body.effects.some((e) => e.kind === "narration"));
    const applied = applyNav(rotcomp, r.body.effects);
    assert.equal(applied.moves, 0);
    assert.equal(applied.pos, rotcomp);
    assert.deepEqual(applied.narrationIntents, ["repeat"]);
  });

  it("navegación no dispara narración extra en el mismo lote", () => {
    let spoken = 0;
    let pos = 2;
    const r = applyPresentationEffects(
      [
        { kind: "narration", intent: "explain" },
        { kind: "navigate", targetStep: 5 },
      ],
      { role: "moderador", stepIndex: pos, stepCount: pasos.length },
      {
        moveModerator(target) {
          pos = target;
          return true;
        },
        onNarration() {
          spoken += 1;
        },
      },
    );
    assert.equal(r.navigated, true);
    assert.equal(spoken, 0);
    assert.equal(r.narrationIntents.length, 0);
  });

  it("avance y retroceso", async () => {
    const next = await runMonitorAiInterpret({
      meetingId: "demo",
      instruction: "Avanza al siguiente punto",
      snapshot: defaultControllerSnapshot({ stepIndex: rotcomp }),
    });
    assert.equal(next.ok, true);
    if (next.ok) {
      const applied = applyNav(rotcomp, next.body.effects);
      assert.equal(applied.pos, rotcomp + 1);
    }
    const prev = await runMonitorAiInterpret({
      meetingId: "demo",
      instruction: "Regresa al punto anterior",
      snapshot: defaultControllerSnapshot({ stepIndex: rotcomp }),
    });
    assert.equal(prev.ok, true);
    if (prev.ok) {
      const applied = applyNav(rotcomp, prev.body.effects);
      assert.equal(applied.pos, rotcomp - 1);
    }
  });

  it("inicia la presentación ≠ vuelve al inicio", async () => {
    const start = await runMonitorAiInterpret({
      meetingId: "demo",
      instruction: "Inicia la presentación",
      snapshot: defaultControllerSnapshot({ stepIndex: 0 }),
    });
    assert.equal(start.ok, true);
    if (start.ok) {
      const nav = start.body.effects.find((e) => e.kind === "navigate");
      assert.ok(nav && nav.kind === "navigate");
      assert.equal(nav.targetStep, findPasoIndexForChart("plantilla"));
      assert.equal(start.body.actions[0]?.type, "go_to_section");
    }

    const back = await runMonitorAiInterpret({
      meetingId: "demo",
      instruction: "Vuelve al inicio",
      snapshot: defaultControllerSnapshot({ stepIndex: rotcomp }),
    });
    assert.equal(back.ok, true);
    if (back.ok) {
      const nav = back.body.effects.find((e) => e.kind === "navigate");
      assert.ok(nav && nav.kind === "navigate");
      assert.equal(nav.targetStep, 0);
      assert.equal(back.body.actions.length, 0);
    }
  });

  it("visitante no puede go_to_section ni gráfica", () => {
    const v = validateMonitorAiStructuredResponse(
      {
        contract: "catch.monitor.presentation.actions.v1",
        message: "Voy.",
        actions: [{ type: "go_to_section", chartId: "ausentismo", sectionKey: "indicadores" }],
      },
      defaultControllerSnapshot({ role: "visitor", stepIndex: 0 }),
    );
    assert.equal(v.ok, false);
  });

  it("pausa no reporta efectos exitosos", async () => {
    const r = await runMonitorAiInterpret({
      meetingId: "demo",
      instruction: "Pausa la presentación",
      snapshot: defaultControllerSnapshot({ stepIndex: 2 }),
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.body.effects.length, 0);
    assert.ok(r.body.clarificationRequest);
  });
});
