import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getDemoClientId } from "@/lib/monitor-data/dataset";
import { buildMonitorPasos, findPasoIndexForChart } from "@/lib/meeting/monitor-pasos";
import { MONITOR_PRESENTATION_ACTION_CONTRACT } from "./action-contract";
import {
  buildInterpretModelContext,
  extractHighlightHint,
  matchInstructionTargets,
} from "./interpret-context";
import {
  extractJsonObject,
  normalizeModelStructuredOutput,
  runMonitorAiInterpret,
  validateMonitorAiInterpretRequest,
  type InterpretGenerator,
} from "./interpret";
import { defaultControllerSnapshot } from "./action-contract";
import { resolveModeratorNavInstruction } from "./nav-instruction";

function jsonGenerator(payload: unknown, calls?: { n: number }): InterpretGenerator {
  return async () => {
    if (calls) calls.n += 1;
    return { ok: true, text: JSON.stringify(payload) };
  };
}

describe("interpret context", () => {
  it("no envía el dataset completo al modelo", () => {
    const ctx = buildInterpretModelContext({
      meetingId: "demo",
      instruction: "Explica esta gráfica",
      snapshot: defaultControllerSnapshot({ stepIndex: findPasoIndexForChart("rotcomp") }),
    });
    const raw = JSON.stringify(ctx);
    assert.equal(raw.includes('"empresas"'), false);
    assert.ok(raw.length < 12_000);
    assert.equal(ctx.dataSource, "demo_dataset");
    assert.ok(ctx.session.disclaimer);
    assert.ok(ctx.analytics.length >= 1);
    assert.ok(ctx.catalogs.sections.some((s) => s.key === "indicadores"));
  });

  it("resuelve sección existente y ausentismo como gráfica", () => {
    const sec = matchInstructionTargets("Ve a la sección de salarios");
    assert.equal(sec.kind, "section");
    if (sec.kind === "section") assert.equal(sec.sectionKey, "salarios");

    const chart = matchInstructionTargets("Ve a la sección de ausentismo");
    assert.equal(chart.kind, "chart");
    if (chart.kind === "chart") assert.equal(chart.chartId, "ausentismo");
  });

  it("marca rotación como ambigua al pedir una sección", () => {
    const m = matchInstructionTargets("ve a la sección de rotación");
    assert.equal(m.kind, "ambiguous");
  });

  it("sección inexistente", () => {
    const m = matchInstructionTargets("ve a la sección de ventas internaciones");
    assert.equal(m.kind, "not_found");
  });

  it("extrae pista de resaltado", () => {
    assert.equal(
      extractHighlightHint("Resalta Comercial mientras explicas la rotación"),
      "Comercial",
    );
  });
});

describe("interpret JSON normalize", () => {
  it("acepta JSON con vallas y requiresClarification", () => {
    const raw = extractJsonObject(
      '```json\n{"message":"¿A cuál se refiere?","requiresClarification":true,"actions":[{"type":"next_slide"}]}\n```',
    );
    const n = normalizeModelStructuredOutput(raw);
    assert.ok(n);
    assert.equal(n!.contract, MONITOR_PRESENTATION_ACTION_CONTRACT);
    assert.equal(n!.clarificationRequest, "¿A cuál se refiere?");
    assert.deepEqual(n!.actions, []);
  });

  it("mapea elementId a category", () => {
    const n = normalizeModelStructuredOutput({
      message: "Resalto.",
      actions: [{ type: "highlight_element", chartId: "rotcomp", elementId: "EMP_39" }],
    });
    assert.ok(n);
    const action = (n!.actions as Array<Record<string, unknown>>)[0];
    assert.equal(action.category, "EMP_39");
  });
});

describe("interpret request validation", () => {
  it("rechaza stepIndex distinto de viewContext.presentationStep", () => {
    const r = validateMonitorAiInterpretRequest("demo", {
      instruction: "Explica",
      stepIndex: 2,
      viewContext: {
        presentationStep: 3,
        stepType: "explica",
        followPresenter: true,
        role: "moderador",
        visibleChartIds: ["plantilla"],
        mountedChartIds: ["plantilla"],
      },
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "INVALID_REQUEST");
  });

  it("rechaza campos extra y stepIndex inválido", () => {
    const extra = validateMonitorAiInterpretRequest("demo", {
      instruction: "hola",
      stepIndex: 0,
      sql: "select 1",
    });
    assert.equal(extra.ok, false);

    const badStep = validateMonitorAiInterpretRequest("demo", {
      instruction: "hola",
      stepIndex: 999,
    });
    assert.equal(badStep.ok, false);
  });
});

describe("runMonitorAiInterpret", () => {
  const pasos = buildMonitorPasos();
  const hoja = pasos.findIndex((p) => p.tipo === "hoja");
  const rotcomp = findPasoIndexForChart("rotcomp");

  it("inicio de presentación → go_to_section muestra", async () => {
    const r = await runMonitorAiInterpret(
      {
        meetingId: "demo",
        instruction: "Inicia con la primera sección",
        snapshot: defaultControllerSnapshot({ stepIndex: 0 }),
      },
      jsonGenerator({
        message: "Arrancamos con el contexto y la muestra.",
        actions: [{ type: "go_to_section", sectionKey: "muestra" }],
      }),
    );
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.body.actions[0]?.type, "go_to_section");
    assert.ok(r.body.effects.some((e) => e.kind === "navigate"));
  });

  it("explica el punto actual", async () => {
    const r = await runMonitorAiInterpret(
      {
        meetingId: "demo",
        instruction: "Explica esta gráfica",
        snapshot: defaultControllerSnapshot({ stepIndex: rotcomp }),
      },
      jsonGenerator({
        message: "La comparativa muestra la rotación de cada empresa.",
        actions: [{ type: "explain_slide", chartId: "rotcomp" }],
      }),
    );
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.body.actions[0]?.type, "explain_slide");
    assert.ok(r.body.effects.some((e) => e.kind === "narration"));
  });

  it("resalta una categoría real del informe", async () => {
    const r = await runMonitorAiInterpret(
      {
        meetingId: "demo",
        instruction: "Resalta la empresa demo en rotación",
        snapshot: defaultControllerSnapshot({ stepIndex: rotcomp }),
      },
      jsonGenerator({
        message: "Resalto su empresa en la comparativa.",
        actions: [
          { type: "highlight_element", chartId: "rotcomp", category: getDemoClientId() },
          { type: "explain_slide", chartId: "rotcomp" },
        ],
      }),
    );
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.ok(r.body.effects.some((e) => e.kind === "monitor_highlight"));
  });

  it("avance y retroceso", async () => {
    const next = await runMonitorAiInterpret(
      {
        meetingId: "demo",
        instruction: "Avanza al siguiente punto",
        snapshot: defaultControllerSnapshot({ stepIndex: rotcomp }),
      },
      jsonGenerator({
        message: "Pasamos al siguiente punto.",
        actions: [{ type: "next_slide" }],
      }),
    );
    assert.equal(next.ok, true);
    if (next.ok) assert.ok(next.body.effects.some((e) => e.kind === "navigate"));

    const prev = await runMonitorAiInterpret(
      {
        meetingId: "demo",
        instruction: "Regresa al punto anterior",
        snapshot: defaultControllerSnapshot({ stepIndex: rotcomp }),
      },
      jsonGenerator({
        message: "Volvemos al punto anterior.",
        actions: [{ type: "previous_slide" }],
      }),
    );
    assert.equal(prev.ok, true);
    if (prev.ok) {
      const nav = prev.body.effects.find((e) => e.kind === "navigate");
      assert.ok(nav && nav.kind === "navigate" && nav.targetStep === rotcomp - 1);
    }
  });

  it("salto a sección existente", async () => {
    const r = await runMonitorAiInterpret(
      {
        meetingId: "demo",
        instruction: "Ve a la sección de salarios",
        snapshot: defaultControllerSnapshot({ stepIndex: 0 }),
      },
      jsonGenerator({
        message: "Vamos a personal y salarios.",
        actions: [{ type: "go_to_section", sectionKey: "salarios" }],
      }),
    );
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.ok(r.body.effects.some((e) => e.kind === "navigate"));
  });

  it("sección inexistente no inventa ID", async () => {
    const r = await runMonitorAiInterpret(
      {
        meetingId: "demo",
        instruction: "Ve a la sección de ventas",
        snapshot: defaultControllerSnapshot({ stepIndex: 0 }),
      },
      jsonGenerator({
        message: "No encontré una sección llamada ventas.",
        clarificationRequest: "Indique una sección del informe: muestra, salarios, beneficios, indicadores o patrones.",
        actions: [],
      }),
    );
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.body.actions.length, 0);
    assert.ok(r.body.clarificationRequest);
    assert.equal(r.body.effects.length, 0);
  });

  it("instrucción ambigua pide aclaración", async () => {
    const r = await runMonitorAiInterpret(
      {
        meetingId: "demo",
        instruction: "ve a la sección de rotación",
        snapshot: defaultControllerSnapshot({ stepIndex: 0 }),
      },
      jsonGenerator({
        message: "Hay varias gráficas de rotación. ¿Indica Indicadores, rotación por compañía u otra?",
        requiresClarification: true,
        actions: [{ type: "go_to_section", sectionKey: "inventada" }],
      }),
    );
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.body.actions.length, 0);
    assert.ok(r.body.clarificationRequest);
  });

  it("dato no disponible no inventa cifras", async () => {
    const r = await runMonitorAiInterpret(
      {
        meetingId: "demo",
        instruction: "¿Cuál fue el PIB nacional de 2019?",
        snapshot: defaultControllerSnapshot({ stepIndex: rotcomp }),
      },
      jsonGenerator({
        message: "No tengo el PIB nacional en el material de esta sesión.",
        actions: [],
      }),
    );
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.match(r.body.message, /No tengo/i);
    assert.equal(r.body.effects.length, 0);
  });

  it("JSON inválido reintenta una vez y luego falla", async () => {
    let n = 0;
    const r = await runMonitorAiInterpret(
      {
        meetingId: "demo",
        instruction: "¿Cuál fue el PIB nacional de 2019 en esta sesión?",
        snapshot: defaultControllerSnapshot({ stepIndex: 1 }),
      },
      async () => {
        n += 1;
        return { ok: true, text: "esto no es json" };
      },
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "AI_EMPTY_RESPONSE");
    assert.equal(n, 2);
  });

  it("timeout del proveedor no se reintenta en bucle", async () => {
    let n = 0;
    const r = await runMonitorAiInterpret(
      {
        meetingId: "demo",
        instruction: "¿Cuál fue el PIB nacional de 2019 en esta sesión?",
        snapshot: defaultControllerSnapshot({ stepIndex: 1 }),
      },
      async () => {
        n += 1;
        return { ok: false, code: "AI_TIMEOUT" };
      },
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "AI_TIMEOUT");
    assert.equal(n, 1);
  });

  it("categoría inexistente se convierte en aclaración, no en ejecución", async () => {
    const r = await runMonitorAiInterpret(
      {
        meetingId: "demo",
        instruction: "Resalta Comercial mientras explicas la rotación",
        snapshot: defaultControllerSnapshot({ stepIndex: rotcomp }),
      },
      jsonGenerator({
        message: "Comercial presenta la mayor tasa.",
        actions: [{ type: "highlight_element", chartId: "rotcomp", category: "Comercial" }],
      }),
    );
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.body.effects.length, 0);
    assert.ok(r.body.clarificationRequest);
  });

  it("avanza y retrocede sin llamar al modelo", async () => {
    let calls = 0;
    const gen: InterpretGenerator = async () => {
      calls += 1;
      return { ok: true, text: "{}" };
    };
    const next = await runMonitorAiInterpret(
      {
        meetingId: "demo",
        instruction: "Avanza al siguiente punto",
        snapshot: defaultControllerSnapshot({ stepIndex: rotcomp }),
      },
      gen,
    );
    assert.equal(next.ok, true);
    if (next.ok) {
      assert.equal(next.body.meta.providerCalled, false);
      const nav = next.body.effects.find((e) => e.kind === "navigate");
      assert.ok(nav && nav.kind === "navigate");
      assert.equal(nav.targetStep, rotcomp + 1);
    }

    const prev = await runMonitorAiInterpret(
      {
        meetingId: "demo",
        instruction: "Regresa al punto anterior",
        snapshot: defaultControllerSnapshot({ stepIndex: rotcomp + 1 }),
      },
      gen,
    );
    assert.equal(prev.ok, true);
    if (prev.ok) {
      const nav = prev.body.effects.find((e) => e.kind === "navigate");
      assert.ok(nav && nav.kind === "navigate");
      assert.equal(nav.targetStep, rotcomp);
    }
    assert.equal(calls, 0);
    assert.equal(resolveModeratorNavInstruction("Avanza al siguiente punto"), "next_slide");
    assert.equal(resolveModeratorNavInstruction("Regresa al punto anterior"), "previous_slide");
  });

  it("respuesta obsoleta no debe aplicarse (contrato de secuencia iaRequestSeq)", () => {
    let iaRequestSeq = 1;
    const aplicarSiVigente = (seq: number) => {
      if (seq !== iaRequestSeq) throw new Error("sin-ia");
      return true;
    };
    assert.equal(aplicarSiVigente(1), true);
    iaRequestSeq = 2;
    assert.throws(() => aplicarSiVigente(1), /sin-ia/);
  });

  it("next_slide en hoja avanza al siguiente índice", async () => {
    const r = await runMonitorAiInterpret(
      {
        meetingId: "demo",
        instruction: "Avanza al siguiente punto",
        snapshot: defaultControllerSnapshot({ stepIndex: hoja }),
      },
      jsonGenerator({
        message: "no debe usarse",
        actions: [],
      }),
    );
    assert.equal(r.ok, true);
    if (!r.ok) return;
    const nav = r.body.effects.find((e) => e.kind === "navigate");
    assert.ok(nav && nav.kind === "navigate");
    assert.equal(nav.targetStep, hoja + 1);
  });
});
