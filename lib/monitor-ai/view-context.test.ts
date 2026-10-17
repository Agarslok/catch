import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getDemoClientId } from "@/lib/monitor-data/dataset";
import { finalizeHighlightForResponse } from "./validate-highlight";
import {
  highlightAllowedForView,
  parseMonitorAiViewContext,
  resolveHighlightDeliveryStatus,
  type MonitorAiViewContext,
} from "./view-context";
import type { MonitorChartId } from "./types";

const baseView = {
  presentationStep: 5,
  stepType: "explica" as const,
  followPresenter: true,
  role: "cliente",
  sectionIndex: 3,
  primaryChartId: "rotcomp" as const,
  visibleChartIds: ["rotcomp" as const],
  mountedChartIds: ["rotcomp" as const],
};

describe("view context", () => {
  it("parsea viewContext válido", () => {
    const v = parseMonitorAiViewContext(baseView);
    assert.ok(v);
    assert.deepEqual(v!.visibleChartIds, ["rotcomp"]);
  });

  it("parsea visibleCharts y chartSurface", () => {
    const v = parseMonitorAiViewContext({
      ...baseView,
      primaryChartId: "plantilla",
      visibleChartIds: ["plantilla"],
      mountedChartIds: [],
      chartSurface: "table",
      visibleCharts: [
        {
          chartId: "plantilla",
          title: "Empleados por tipo de personal",
          subtitle: "Suma de la muestra",
          mounted: false,
        },
      ],
    });
    assert.ok(v);
    assert.equal(v!.chartSurface, "table");
    assert.equal(v!.visibleCharts?.[0]?.subtitle, "Suma de la muestra");
  });

  it("rechaza campos extra en viewContext", () => {
    assert.equal(parseMonitorAiViewContext({ ...baseView, hack: true }), null);
  });

  it("barra visible y montada: applied", () => {
    const action = {
      type: "highlight" as const,
      target: {
        chartId: "rotcomp" as const,
        category: getDemoClientId(),
        seriesKey: "",
        datasetIndex: 0,
        index: 0,
      },
    };
    const r = finalizeHighlightForResponse(action, baseView);
    assert.equal(r.status, null);
    assert.ok(r.action);
  });

  it("elemento en otra gráfica: not_visible", () => {
    const action = {
      type: "highlight" as const,
      target: { chartId: "mixcontrata" as const, category: "Reposición de bajas" },
    };
    const r = finalizeHighlightForResponse(action, baseView);
    assert.equal(r.status, "not_visible");
    assert.equal(r.action, null);
  });

  it("gráfica visible: el servidor entrega action (montaje lo valida el cliente)", () => {
    const view: MonitorAiViewContext = { ...baseView, mountedChartIds: [] };
    const r = finalizeHighlightForResponse(
      {
        type: "highlight",
        target: { chartId: "rotcomp", category: getDemoClientId() },
      },
      view,
    );
    assert.ok(r.action);
    assert.equal(resolveHighlightDeliveryStatus("rotcomp", view), "not_visible");
  });

  it("inicio sin gráficas: no highlight", () => {
    const view = {
      ...baseView,
      stepType: "inicio" as const,
      visibleChartIds: [],
      mountedChartIds: [],
      primaryChartId: null,
    };
    assert.equal(highlightAllowedForView("rotcomp", view), false);
  });

  it("hoja con varias gráficas visibles", () => {
    const view: MonitorAiViewContext = {
      ...baseView,
      stepType: "hoja",
      primaryChartId: null,
      visibleChartIds: ["rotserie", "mixcontrata", "rotcomp"] as MonitorChartId[],
      mountedChartIds: ["rotserie", "mixcontrata", "rotcomp"] as MonitorChartId[],
    };
    assert.equal(highlightAllowedForView("mixcontrata", view), true);
    const pie = finalizeHighlightForResponse(
      {
        type: "highlight",
        target: { chartId: "mixcontrata", category: "Reposición de bajas" },
      },
      view,
    );
    assert.equal(pie.status, null);
    assert.ok(pie.action);
  });
});
