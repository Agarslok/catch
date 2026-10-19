import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ECharts } from "echarts";
import {
  applyEChartsCategoryHighlight,
  clearEChartsHighlight,
} from "./echarts-highlight-runtime";

describe("echarts highlight runtime", () => {
  it("resalta categoría existente vía dispatchAction", () => {
    const actions: unknown[] = [];
    const chart = {
      getOption: () => ({
        series: [{ data: [{ name: "Comercial" }, { name: "Operaciones" }] }],
      }),
      dispatchAction: (a: unknown) => actions.push(a),
    } as unknown as ECharts;
    const r = applyEChartsCategoryHighlight(chart, { category: "Comercial" });
    assert.equal(r.applied, true);
    assert.equal(actions.length, 2);
    assert.deepEqual(actions[0], { type: "downplay", seriesIndex: 0 });
    assert.deepEqual(actions[1], { type: "highlight", seriesIndex: 0, name: "Comercial" });
  });

  it("rechaza categoría ausente", () => {
    const actions: unknown[] = [];
    const chart = {
      getOption: () => ({ series: [{ data: [{ name: "A" }] }] }),
      dispatchAction: (a: unknown) => actions.push(a),
    } as unknown as ECharts;
    const r = applyEChartsCategoryHighlight(chart, { category: "Comercial" });
    assert.equal(r.applied, false);
    assert.equal(actions.length, 0);
  });

  it("clear downplay", () => {
    const actions: unknown[] = [];
    const chart = {
      getOption: () => ({ series: [{ data: [] }] }),
      dispatchAction: (a: unknown) => actions.push(a),
    } as unknown as ECharts;
    clearEChartsHighlight(chart);
    assert.deepEqual(actions, [{ type: "downplay", seriesIndex: 0 }]);
  });
});
