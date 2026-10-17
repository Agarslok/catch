import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runToolLoopWithGenerator, MAX_TOOL_ITERATIONS } from "./run-with-tools";
import { executeMonitorAiTool } from "./tools/execute";

describe("tool loop", () => {
  it("ejecuta una función y luego responde texto", async () => {
    let calls = 0;
    const result = await runToolLoopWithGenerator("¿Cuál es la rotación del mercado?", async (_c, withTools) => {
      calls++;
      if (withTools && calls === 1) {
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
      return { ok: true, round: { type: "text", text: "La rotación del mercado es 9,86%." } };
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.match(result.body.message, /rotación/i);
    assert.equal(calls, 2);
  });

  it("rechaza argumentos de herramienta inválidos vía execute", () => {
    const r = executeMonitorAiTool("get_section_summary", { sectionKey: "invalid" });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "INVALID_SECTION");
  });

  it("agota iteraciones si el modelo solo pide herramientas", async () => {
    let calls = 0;
    const result = await runToolLoopWithGenerator("pregunta", async () => {
      calls++;
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
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "AI_EMPTY_RESPONSE");
    assert.equal(calls, MAX_TOOL_ITERATIONS);
  });
});
