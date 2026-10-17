import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getDemoClientId } from "@/lib/monitor-data/dataset";
import {
  demoClientRotcompHighlight,
  resolveMonitorHighlightTarget,
} from "./highlight-catalog";
import {
  authorizeHighlightRequest,
  buildHighlightActionFromProposal,
  hasOnlyAllowedHighlightKeys,
  mergeHighlightAction,
} from "./validate-highlight";
import { validateMonitorAiAction } from "./validate-response";
import { runToolLoopWithGenerator } from "./run-with-tools";

describe("highlight catalog", () => {
  it("resalta categoría Administrativo en plantilla", () => {
    const ref = resolveMonitorHighlightTarget("plantilla", { category: "Administrativo" });
    assert.ok(ref);
    assert.equal(ref!.category, "Administrativo");
    assert.equal(ref!.index, 1);
    assert.equal(ref!.datasetIndex, 0);
  });

  it("resalta barra existente en rotcomp (cliente demo)", () => {
    const ref = demoClientRotcompHighlight();
    assert.ok(ref);
    assert.equal(ref!.chartId, "rotcomp");
    assert.equal(ref!.category, getDemoClientId());
  });

  it("resalta segmento existente en mixcontrata (pie)", () => {
    const ref = resolveMonitorHighlightTarget("mixcontrata", {
      category: "Reposición de bajas",
    });
    assert.ok(ref);
    assert.equal(ref!.index, 0);
  });

  it("resalta punto existente en salrot (scatter)", () => {
    const ref = resolveMonitorHighlightTarget("salrot", { category: getDemoClientId() });
    assert.ok(ref);
    assert.equal(ref!.datasetIndex, 1);
    assert.equal(ref!.seriesKey, "Su empresa");
  });
});

describe("highlight validation", () => {
  it("rechaza tipo de acción no autorizado", () => {
    const r = validateMonitorAiAction({ type: "navigate", target: { chartId: "rotcomp" } });
    assert.equal(r.ok, false);
  });

  it("rechaza gráfica inexistente", () => {
    const r = buildHighlightActionFromProposal({
      chartId: "no_existe",
      category: "x",
    });
    assert.equal(r.ok, false);
  });

  it("rechaza elemento inexistente en gráfica válida", () => {
    const r = buildHighlightActionFromProposal({
      chartId: "rotcomp",
      category: "EMP_NO_REAL",
    });
    assert.equal(r.ok, false);
  });

  it("rechaza reunión incorrecta", () => {
    const r = authorizeHighlightRequest("a", "b", "moderador");
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "FORBIDDEN");
  });

  it("autoriza moderador y visitante en la misma reunión", () => {
    assert.equal(authorizeHighlightRequest("demo", "demo", "moderador").ok, true);
    assert.equal(authorizeHighlightRequest("demo", "demo", "visitor").ok, true);
  });

  it("rechaza campos inesperados en la propuesta", () => {
    assert.equal(
      hasOnlyAllowedHighlightKeys({
        chartId: "rotcomp",
        category: getDemoClientId(),
        evil: "drop table",
      }),
      false,
    );
    const r = buildHighlightActionFromProposal({
      chartId: "rotcomp",
      category: getDemoClientId(),
      evil: "x",
    } as Record<string, unknown>);
    assert.equal(r.ok, false);
  });

  it("acepta propuesta válida y normaliza target", () => {
    const r = buildHighlightActionFromProposal({
      chartId: "rotcomp",
      category: getDemoClientId(),
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.action.type, "highlight");
      assert.equal(r.action.target.chartId, "rotcomp");
    }
  });

  it("no adopta un segundo resaltado (duplicado en la misma respuesta)", () => {
    const first = buildHighlightActionFromProposal({
      chartId: "rotcomp",
      category: getDemoClientId(),
    });
    const second = buildHighlightActionFromProposal({
      chartId: "mixcontrata",
      category: "Posiciones nuevas",
    });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (first.ok && second.ok) {
      const merged = mergeHighlightAction(first.action, second.action);
      assert.equal(merged?.target.chartId, "rotcomp");
    }
  });
});

describe("chat sin resaltado", () => {
  it("pregunta normal conserva action null", async () => {
    let calls = 0;
    const result = await runToolLoopWithGenerator("¿Qué es rotación?", async () => {
      calls++;
      if (calls === 1) {
        return {
          ok: true,
          round: {
            type: "function_call",
            name: "get_market_metric",
            args: { metric: "turnover_total" },
            modelPart: {
              functionCall: { name: "get_market_metric", args: { metric: "turnover_total" } },
            },
          },
        };
      }
      return { ok: true, round: { type: "text", text: "La rotación mide las salidas de personal." } };
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.body.action, null);
      assert.match(result.body.message, /rotación/i);
    }
  });
});
