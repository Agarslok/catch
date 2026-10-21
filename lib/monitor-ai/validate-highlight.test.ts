import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getDemoClientId, getMonitorDataset } from "@/lib/monitor-data/dataset";
import { MONITOR_CHART_IDS } from "./catalog";
import {
  chartHasHighlightCatalog,
  demoClientRotcompHighlight,
  enumerateHighlightElements,
  resolveMonitorHighlightTarget,
} from "./highlight-catalog";
import {
  authorizeHighlightRequest,
  buildClearActionFromProposal,
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

  it("resalta segmento existente en mixcontrata (barras apiladas)", () => {
    const datos = getMonitorDataset();
    const ult = datos.bimestres[datos.bimestres.length - 1];
    const ref = resolveMonitorHighlightTarget("mixcontrata", {
      category: ult,
      seriesKey: "Reposición de bajas",
    });
    assert.ok(ref);
    assert.equal(ref!.datasetIndex, 0);
  });

  it("resalta un factor del diagrama de bosque", () => {
    const ref = resolveMonitorHighlightTarget("salrot", {
      category: "Salario inicial sobre el mercado",
    });
    assert.ok(ref);
    assert.equal(ref!.datasetIndex, 1);
    assert.equal(ref!.seriesKey, "Salario inicial sobre el mercado");
  });

  it("cada chartId del monitor tiene catálogo de resaltado", () => {
    for (const id of MONITOR_CHART_IDS) {
      assert.equal(chartHasHighlightCatalog(id), true, id);
      assert.ok(enumerateHighlightElements(id).length > 0, id);
    }
  });

  it("resalta proceso y negociación (incl. No aplica)", () => {
    const proc = resolveMonitorHighlightTarget("procesos", { category: "Metalmecánica" });
    assert.ok(proc);
    const neg = resolveMonitorHighlightTarget("negociacion", { category: "No aplica" });
    assert.ok(neg);
  });

  it("rechaza categoría inexistente en gráfica actual", () => {
    const ref = resolveMonitorHighlightTarget("plantilla", { category: "Comercial" });
    assert.equal(ref, null);
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

  it("clear reemplaza highlight en la misma respuesta", () => {
    const hi = buildHighlightActionFromProposal({
      chartId: "rotcomp",
      category: getDemoClientId(),
    });
    const clr = buildClearActionFromProposal({});
    assert.equal(hi.ok, true);
    assert.equal(clr.ok, true);
    if (hi.ok && clr.ok) {
      const merged = mergeHighlightAction(hi.action, clr.action);
      assert.equal(merged?.type, "clear_highlight");
    }
  });

  it("no adopta un segundo resaltado (duplicado en la misma respuesta)", () => {
    const first = buildHighlightActionFromProposal({
      chartId: "rotcomp",
      category: getDemoClientId(),
    });
    const ult = getMonitorDataset().bimestres.at(-1)!;
    const second = buildHighlightActionFromProposal({
      chartId: "mixcontrata",
      category: ult,
      seriesKey: "Posiciones nuevas",
    });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (first.ok && second.ok) {
      const merged = mergeHighlightAction(first.action, second.action);
      assert.ok(merged?.target);
      if (merged?.target) assert.equal(merged.target.chartId, "rotcomp");
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
