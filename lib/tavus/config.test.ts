import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tavusConfigPresence, tavusIsConfigured } from "./config";

describe("tavus config", () => {
  it("no expone valores, solo presencia", () => {
    const checks = tavusConfigPresence();
    assert.equal(typeof checks.hasApiKey, "boolean");
    assert.equal(typeof checks.hasReplicaId, "boolean");
    assert.equal(typeof checks.hasPersonaId, "boolean");
    assert.equal(tavusIsConfigured(), checks.hasApiKey && checks.hasReplicaId && checks.hasPersonaId);
  });
});
