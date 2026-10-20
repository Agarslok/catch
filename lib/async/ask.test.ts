import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { buildAsyncChartQuestion, buildAsyncTextQuestion } from "./contextual-ask";
import { buildAsyncReportContext, runAsyncReportAsk } from "./ask";
import {
  adjacentAsyncExploreIndex,
  asyncExploreNavigablePointCount,
  resolveAsyncExplorePointId,
} from "./explore-nav";
import { generateSessionScript } from "@/lib/meeting/script";
import { normalizeTeamQuestionText } from "./team-question";

describe("modo asincrónico", () => {
  it("la pantalla inicial conserva las dos entradas y añade la tercera", () => {
    const page = readFileSync("app/page.tsx", "utf8");
    assert.match(page, /\/monitor\/\$\{DEFAULT_MEETING\}\/presenter/);
    assert.match(page, /\/monitor\/\$\{DEFAULT_MEETING\}\/visitor/);
    assert.match(page, /href="\/async"/);
    assert.match(page, /Modo asincrónico/);
  });

  it("el contexto usa el informe empaquetado y no una reunión", () => {
    const ctx = buildAsyncReportContext({
      chartFocus: "turnover_bimonthly",
      pointTitle: "Rotación",
    });
    assert.equal(ctx.source, "informe_empaquetado");
    assert.equal((ctx.chapter as { big: string }).big, "7.24%");
    assert.ok(Array.isArray((ctx.series as { rows: unknown }).rows));
    assert.equal("meetingId" in ctx, false);
  });

  it("devuelve la respuesta de Gemini sin efectos de presentación", async () => {
    const result = await runAsyncReportAsk(
      { question: "¿Cuál es la rotación?", chartFocus: "turnover_bimonthly" },
      async () => ({ ok: true, round: { type: "text", text: "La rotación es 7.24%." } }),
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.interpreter, "gemini");
      assert.match(result.answer, /7\.24%/);
      assert.equal("effects" in result, false);
    }
  });

  it("arma preguntas contextuales para gráfica y texto", () => {
    const meta = { step: 3, stepTotal: 18, sectionName: "Rotación", slideTitle: "Ene–Feb" };
    const chartQ = buildAsyncChartQuestion(meta, {
      kind: "chart",
      category: "León",
      chartTitle: "turnover_municipality",
      value: "8.2",
    });
    assert.match(chartQ, /Rotación/);
    assert.match(chartQ, /León/);
    const textQ = buildAsyncTextQuestion(meta, { kind: "text", selection: "rotación no controlada" });
    assert.match(textQ, /rotación no controlada/);
  });

  it("omite hoja completa y claridad en el recorrido asincrónico", () => {
    const script = generateSessionScript("async-test-nav");
    assert.ok(asyncExploreNavigablePointCount(script) < script.points.length);
    const clarity = script.points.find((p) => p.kind === "clarity_check");
    assert.ok(clarity);
    const resolved = resolveAsyncExplorePointId(script, clarity!.id);
    assert.notEqual(resolved, clarity!.id);
    const idx = script.points.findIndex((p) => p.id === clarity!.id);
    const next = adjacentAsyncExploreIndex(script, idx, 1);
    assert.notEqual(script.points[next].kind, "clarity_check");
    assert.notEqual(script.points[next].kind, "full_sheet");
  });

  it("normaliza preguntas al equipo Catch", () => {
    assert.equal(normalizeTeamQuestionText("  hola  "), "hola");
    assert.equal(normalizeTeamQuestionText(""), null);
  });

  it("rechaza una pregunta vacía", async () => {
    const result = await runAsyncReportAsk({ question: "   " });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "INVALID_REQUEST");
  });
});
