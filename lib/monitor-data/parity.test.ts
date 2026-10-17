import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getMonitorDataset, getDemoClient, getMonitorEmpresas } from "./dataset";
import { mercado } from "./market";
import { promSinCeros, serieRotIndices } from "./stats";
import { refMercado, refPromSinCeros, refSerieRot } from "./reference-stats";
import {
  getMarketMetricQuery,
  compareClientToMarketQuery,
  getSectionSummary,
  MonitorDataQueryError,
} from "./queries";
import { FILTER_ALL } from "./types";

describe("parity: stats vs HTML reference", () => {
  const empresas = getMonitorEmpresas();
  const datos = getMonitorDataset();
  const ULT = datos.bimestres.length - 1;

  it("promSinCeros rotación último bimestre (muestra completa)", () => {
    const a = promSinCeros(empresas.map((e) => e.rot[ULT]));
    const b = refPromSinCeros(empresas.map((e) => e.rot[ULT]));
    assert.equal(a, b);
  });

  it("serieRot total último bimestre", () => {
    const a = serieRotIndices(empresas, datos.bimestres.length).total[ULT];
    const b = refSerieRot(empresas, datos.bimestres.length)[ULT];
    assert.equal(a, b);
  });

  it("mercado() con filtro tier Tier 1", () => {
    const f = { tier: "Tier 1", tamano: FILTER_ALL, proceso: FILTER_ALL };
    const a = mercado(empresas, { tier: "Tier 1" });
    const b = refMercado(empresas, f);
    assert.equal(a.filtersApplied, b.aplicado);
    assert.equal(a.M.length, b.M.length);
  });

  it("mercado() con filtro que deja < MIN_EMPRESAS usa muestra completa", () => {
    const a = mercado(empresas, { proceso: "vidrios_laminados" });
    assert.equal(a.filtersApplied, false);
    assert.equal(a.M.length, empresas.length);
    assert.ok(a.filterSubsetCount < 5);
  });
});

describe("parity: EMP_39 cliente demo", () => {
  it("rotación cliente último bimestre", () => {
    const cli = getDemoClient();
    const ULT = getMonitorDataset().bimestres.length - 1;
    const q = getMarketMetricQuery("client_turnover_total", ULT);
    assert.equal(q.value, cli.rot[ULT]);
  });
});

describe("queries: null vs cero", () => {
  it("métrica con valor numérico vs ausente", () => {
    const q = getMarketMetricQuery("turnover_total");
    assert.ok(q.value !== null && q.value > 0);
    assert.throws(
      () => getMarketMetricQuery("turnover_total", 999),
      (e) => e instanceof MonitorDataQueryError && e.code === "INVALID_BIMESTRE_INDEX",
    );
  });
});

describe("queries: invalid args", () => {
  it("rechaza sección inválida", () => {
    assert.throws(
      () => getSectionSummary("noexiste"),
      (e) => e instanceof MonitorDataQueryError && e.code === "INVALID_SECTION",
    );
  });

  it("rechaza métrica de comparación inválida", () => {
    assert.throws(
      () => compareClientToMarketQuery("market_headcount"),
      (e) => e instanceof MonitorDataQueryError && e.code === "INVALID_METRIC_FOR_COMPARE",
    );
  });

  it("resumen de sección indicadores", () => {
    const s = getSectionSummary("indicadores");
    assert.equal(s.sectionKey, "indicadores");
    assert.equal(s.filtersApplied, true);
    assert.ok(s.kpis.length >= 4);
  });
});
