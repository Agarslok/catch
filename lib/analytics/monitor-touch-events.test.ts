import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  chartElementClickFields,
  monitorTouchEventType,
  totalElementClicks,
} from "./monitor-touch-events";

describe("monitor chart clicks", () => {
  it("maps a real chart tap to element.clicked with chart and category", () => {
    const fields = chartElementClickFields({
      chartId: "rotacion-tier",
      category: "Tier 1",
      chartTitle: "Rotación por tier",
      sectionIndex: 0,
      sectionName: "Rotación",
    });
    assert.equal(fields.event_type, "element.clicked");
    assert.equal(fields.chart_id, "rotacion-tier");
    assert.equal(fields.element_id, "Tier 1");
    assert.equal(fields.metadata.category, "Tier 1");
    assert.equal(monitorTouchEventType("grafico"), "element.clicked");
  });

  it("does not treat justificacion/glossary as clicks", () => {
    assert.equal(monitorTouchEventType("justificacion"), "detail.opened");
    assert.equal(monitorTouchEventType("glosario"), "detail.opened");
    assert.equal(monitorTouchEventType("ia"), "question.asked");
  });

  it("counts repeated legitimate clicks and ignores other event types", () => {
    const types = [
      "element.clicked",
      "detail.opened",
      "question.asked",
      "element.clicked",
    ];
    assert.equal(totalElementClicks(types), 2);
  });
});
