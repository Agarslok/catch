import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mergePrepFaqsIntoGlobalView,
  prepFaqsFromGlobalView,
} from "./prep-faqs-persist";
import { applyChartActionToGlobalView } from "./global-view";

describe("prep-faqs meeting_state fallback", () => {
  it("reads pregunta/respuesta from global_view without mixing meetings", () => {
    const items = prepFaqsFromGlobalView({
      prepFaqs: [{ id: "1", pregunta: "P", respuesta: "R" }],
    });
    assert.equal(items.length, 1);
    assert.equal(items[0]?.question, "P");
    assert.equal(prepFaqsFromGlobalView({ munFilter: "total" }).length, 0);
  });

  it("merges FAQs into global_view without dropping other keys", () => {
    const next = mergePrepFaqsIntoGlobalView(
      { monitorSessionPhase: "reunion_activa", munFilter: "total" },
      [{ id: "a", question: "Q", answer: "A" }],
    );
    assert.equal(next.monitorSessionPhase, "reunion_activa");
    assert.deepEqual(next.prepFaqs, [{ id: "a", question: "Q", answer: "A" }]);
  });

  it("keeps FAQs when a chart reset_view clears graphic state", () => {
    const faqs = [{ id: "a", question: "Q", answer: "A" }];
    const reset = applyChartActionToGlobalView(
      { munFilter: "total", prepFaqs: faqs },
      { type: "reset_view", scope: "global" },
    );
    assert.equal(reset.munFilter, undefined);
    assert.deepEqual(reset.prepFaqs, faqs);
  });
});
