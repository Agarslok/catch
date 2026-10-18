import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isMissingSchemaColumnError,
  isValidVisitorParticipantId,
  normalizeVisitorDisplayName,
} from "./visitor-register";

describe("visitor-register", () => {
  it("rechaza nombre vacío o solo espacios", () => {
    assert.equal(normalizeVisitorDisplayName(""), null);
    assert.equal(normalizeVisitorDisplayName("   "), null);
    assert.equal(normalizeVisitorDisplayName(" Ana "), "Ana");
  });

  it("valida participantId", () => {
    assert.equal(isValidVisitorParticipantId("short"), false);
    assert.equal(isValidVisitorParticipantId("v-abc12345"), true);
  });

  it("detecta columna display_name ausente", () => {
    assert.equal(isMissingSchemaColumnError({ code: "42703", message: "column" }), true);
    assert.equal(
      isMissingSchemaColumnError({
        code: "PGRST204",
        message: "Could not find the 'display_name' column of 'meeting_participants'",
      }),
      true,
    );
    assert.equal(isMissingSchemaColumnError({ code: "23505", message: "duplicate" }), false);
  });
});
