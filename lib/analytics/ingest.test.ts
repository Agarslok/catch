import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isValidInteractionEvent } from "./ingest";
import type { InteractionEventInput } from "./types";

describe("analytics ingest", () => {
  it("valida eventos con tipos permitidos", () => {
    const ok: InteractionEventInput = {
      client_event_id: "c1",
      meeting_id: "m1",
      session_id: "s1",
      participant_id: "p1",
      participant_role: "visitor",
      event_type: "presentation.navigated_forward",
    };
    assert.equal(isValidInteractionEvent(ok), true);
    assert.equal(isValidInteractionEvent({ ...ok, event_type: "question.answered" }), true);
    assert.equal(
      isValidInteractionEvent({ ...ok, event_type: "not.real" as InteractionEventInput["event_type"] }),
      false,
    );
  });
});
