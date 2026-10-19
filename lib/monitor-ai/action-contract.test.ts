import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getDemoClientId } from "@/lib/monitor-data/dataset";
import { buildMonitorPasos } from "@/lib/meeting/monitor-pasos";
import { evaluateNarrationAdvanceGate } from "@/lib/meeting/monitor-narration-gate";
import {
  MONITOR_PRESENTATION_ACTION_CONTRACT,
  defaultControllerSnapshot,
  parseMonitorAiStructuredResponse,
  toLegacyMonitorAiAction,
  validateMonitorAiStructuredResponse,
} from "./action-contract";

function hojaStepIndex(): number {
  const pasos = buildMonitorPasos();
  return pasos.findIndex((p) => p.tipo === "hoja");
}

describe("monitor presentation action contract", () => {
  it("parsea respuesta con mensaje, refs y acciones", () => {
    const raw = {
      contract: MONITOR_PRESENTATION_ACTION_CONTRACT,
      message: "La rotación por empresa muestra la posición relativa.",
      refs: { chartId: "rotcomp", sectionKey: "indicadores", sectionIndex: 3 },
      actions: [
        {
          type: "highlight_element",
          chartId: "rotcomp",
          category: getDemoClientId(),
        },
        { type: "explain_slide", chartId: "rotcomp" },
      ],
      completion: "complete",
    };
    const parsed = parseMonitorAiStructuredResponse(raw);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.response.actions.length, 2);
    assert.equal(parsed.response.refs?.chartId, "rotcomp");
  });

  it("rechaza contrato o acción desconocida", () => {
    const badContract = parseMonitorAiStructuredResponse({ contract: "x", message: "hola" });
    assert.equal(badContract.ok, false);

    const badAction = parseMonitorAiStructuredResponse({
      contract: MONITOR_PRESENTATION_ACTION_CONTRACT,
      message: "hola",
      actions: [{ type: "run_javascript", code: "alert(1)" }],
    });
    assert.equal(badAction.ok, false);
  });

  it("permite solo aclaración sin acciones", () => {
    const r = parseMonitorAiStructuredResponse({
      contract: MONITOR_PRESENTATION_ACTION_CONTRACT,
      message: "¿A qué gráfica se refiere?",
      clarificationRequest: "Indique si habla de rotación por empresa o por área.",
    });
    assert.equal(r.ok, true);
    const validated = validateMonitorAiStructuredResponse(r.ok ? r.response : {}, defaultControllerSnapshot());
    assert.equal(validated.ok, true);
    if (validated.ok) {
      assert.equal(validated.effects.length, 0);
    }
  });

  it("valida highlight y lo convierte al contrato legacy highlight", () => {
    const ctx = defaultControllerSnapshot({ stepIndex: 15 });
    const raw = {
      contract: MONITOR_PRESENTATION_ACTION_CONTRACT,
      message: "Resalto su empresa en la comparativa de rotación.",
      actions: [
        { type: "highlight_element", chartId: "rotcomp", category: getDemoClientId() },
      ],
    };
    const v = validateMonitorAiStructuredResponse(raw, ctx);
    assert.equal(v.ok, true);
    if (!v.ok) return;
    assert.equal(v.effects.length, 1);
    assert.equal(v.effects[0].kind, "monitor_highlight");
    if (v.effects[0].kind === "monitor_highlight") {
      assert.equal(v.effects[0].action.type, "highlight");
    }
    const legacy = toLegacyMonitorAiAction(v.validatedActions[0].proposal);
    assert.ok(legacy);
    assert.equal(legacy!.type, "highlight");
  });

  it("rechaza elemento inexistente en gráfica válida", () => {
    const raw = {
      contract: MONITOR_PRESENTATION_ACTION_CONTRACT,
      message: "Intento resaltar Comercial en plantilla.",
      actions: [{ type: "highlight_element", chartId: "plantilla", category: "Comercial" }],
    };
    const v = validateMonitorAiStructuredResponse(raw, defaultControllerSnapshot());
    assert.equal(v.ok, false);
  });

  it("next_slide del moderador avanza también en hoja (como el botón Siguiente)", () => {
    const hoja = hojaStepIndex();
    const gate = evaluateNarrationAdvanceGate({
      stepIndex: hoja,
      role: "moderador",
      intent: "narration",
    });
    assert.equal(gate.awaitingModerator, true);

    const raw = {
      contract: MONITOR_PRESENTATION_ACTION_CONTRACT,
      message: "Avanzamos.",
      actions: [{ type: "next_slide" }],
    };
    const v = validateMonitorAiStructuredResponse(
      raw,
      defaultControllerSnapshot({ stepIndex: hoja }),
    );
    assert.equal(v.ok, true);
    if (!v.ok) return;
    const nav = v.effects.find((e) => e.kind === "navigate");
    assert.ok(nav && nav.kind === "navigate");
    assert.equal(nav.targetStep, hoja + 1);
  });

  it("acepta continue_section del moderador en hoja", () => {
    const hoja = hojaStepIndex();
    const raw = {
      contract: MONITOR_PRESENTATION_ACTION_CONTRACT,
      message: "Continuamos con la siguiente sección.",
      actions: [{ type: "continue_section" }],
    };
    const v = validateMonitorAiStructuredResponse(
      raw,
      defaultControllerSnapshot({ stepIndex: hoja }),
    );
    assert.equal(v.ok, true);
    if (!v.ok) return;
    assert.ok(v.effects.some((e) => e.kind === "section_continue"));
    assert.ok(v.effects.some((e) => e.kind === "navigate"));
  });

  it("rechaza continue_section de visitante", () => {
    const hoja = hojaStepIndex();
    const raw = {
      contract: MONITOR_PRESENTATION_ACTION_CONTRACT,
      message: "Sigo.",
      actions: [{ type: "continue_section" }],
    };
    const v = validateMonitorAiStructuredResponse(
      raw,
      defaultControllerSnapshot({ stepIndex: hoja, role: "visitor" }),
    );
    assert.equal(v.ok, false);
  });

  it("rechaza navegación de visitante", () => {
    const raw = {
      contract: MONITOR_PRESENTATION_ACTION_CONTRACT,
      message: "Siguiente.",
      actions: [{ type: "next_slide" }],
    };
    const v = validateMonitorAiStructuredResponse(
      raw,
      defaultControllerSnapshot({ role: "visitor" }),
    );
    assert.equal(v.ok, false);
  });

  it("go_to_section con clave válida produce navigate", () => {
    const raw = {
      contract: MONITOR_PRESENTATION_ACTION_CONTRACT,
      message: "Vamos a salarios.",
      actions: [{ type: "go_to_section", sectionKey: "salarios" }],
    };
    const v = validateMonitorAiStructuredResponse(raw, defaultControllerSnapshot());
    assert.equal(v.ok, true);
    if (!v.ok) return;
    const nav = v.effects.find((e) => e.kind === "navigate");
    assert.ok(nav && nav.kind === "navigate");
    assert.ok(nav.targetStep > 0);
  });

  it("rechaza sección inexistente", () => {
    const raw = {
      contract: MONITOR_PRESENTATION_ACTION_CONTRACT,
      message: "Ir allá.",
      actions: [{ type: "go_to_section", sectionKey: "no_existe" }],
    };
    const v = validateMonitorAiStructuredResponse(raw, defaultControllerSnapshot());
    assert.equal(v.ok, false);
  });

  it("pause y resume respetan moderador y estado", () => {
    const pauseOk = validateMonitorAiStructuredResponse(
      {
        contract: MONITOR_PRESENTATION_ACTION_CONTRACT,
        message: "Pausa.",
        actions: [{ type: "pause_presentation" }],
      },
      defaultControllerSnapshot({ presentationStatus: "live" }),
    );
    assert.equal(pauseOk.ok, true);

    const pauseVisitor = validateMonitorAiStructuredResponse(
      {
        contract: MONITOR_PRESENTATION_ACTION_CONTRACT,
        message: "Pausa.",
        actions: [{ type: "pause_presentation" }],
      },
      defaultControllerSnapshot({ role: "visitor" }),
    );
    assert.equal(pauseVisitor.ok, false);

    const resumeBad = validateMonitorAiStructuredResponse(
      {
        contract: MONITOR_PRESENTATION_ACTION_CONTRACT,
        message: "Resume.",
        actions: [{ type: "resume_presentation" }],
      },
      defaultControllerSnapshot({ presentationStatus: "live" }),
    );
    assert.equal(resumeBad.ok, false);
  });

  it("start_presentation sigue pendiente", () => {
    const v = validateMonitorAiStructuredResponse(
      {
        contract: MONITOR_PRESENTATION_ACTION_CONTRACT,
        message: "Empezar.",
        actions: [{ type: "start_presentation" }],
      },
      defaultControllerSnapshot(),
    );
    assert.equal(v.ok, false);
    if (!v.ok) assert.match(v.errors.join(" "), /not available/);
  });
});
