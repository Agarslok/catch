import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { VisitorSessionSummary } from "@/lib/analytics/participant-summaries";
import {
  dedupeVisitorsByParticipantId,
  meetingParticipationHistoryVisible,
  rosterDurationDisplay,
  rosterPresenceLabel,
} from "./participant-roster-view";

function sampleVisitor(overrides: Partial<VisitorSessionSummary> = {}): VisitorSessionSummary {
  return {
    participant_id: "p1",
    display_name: "Ana",
    joined_at: "2026-10-18T15:00:00.000Z",
    left_at: null,
    last_seen_at: "2026-10-18T15:10:00.000Z",
    duration_seconds: 600,
    duration_label: "10 min",
    still_active: false,
    presence: "away",
    presence_label: "Desconectado",
    sections: ["Beneficios"],
    questions_asked: 1,
    clicks: 2,
    event_count: 5,
    ...overrides,
  };
}

describe("participant-roster-view", () => {
  it("no muestra historial durante reunión activa", () => {
    assert.equal(meetingParticipationHistoryVisible("reunion_activa", false), false);
    assert.equal(rosterDurationDisplay(sampleVisitor(), false).kind, "hidden");
  });

  it("muestra historial en fase cierre o paso de cierre", () => {
    assert.equal(meetingParticipationHistoryVisible("cierre", false), true);
    assert.equal(meetingParticipationHistoryVisible("reunion_activa", true), true);
  });

  it("no inventa duración sin salida registrada", () => {
    const d = rosterDurationDisplay(sampleVisitor({ left_at: null }), true);
    assert.equal(d.kind, "unconfirmed");
    if (d.kind === "unconfirmed") {
      assert.match(d.message, /sin salida registrada/i);
    }
  });

  it("muestra duración confirmada con left_at", () => {
    const d = rosterDurationDisplay(
      sampleVisitor({ left_at: "2026-10-18T15:12:00.000Z", duration_label: "12 min" }),
      true,
    );
    assert.equal(d.kind, "confirmed");
    if (d.kind === "confirmed") assert.equal(d.label, "12 min");
  });

  it("conserva participantes desconectados en historial", () => {
    const label = rosterPresenceLabel(sampleVisitor({ presence: "left", left_at: "x" }), true);
    assert.equal(label, "Salida registrada");
  });

  it("deduplica por participant_id al finalizar más de una vez", () => {
    const a = sampleVisitor({ participant_id: "p1", joined_at: "2026-10-18T15:00:00.000Z" });
    const b = sampleVisitor({
      participant_id: "p1",
      joined_at: "2026-10-18T14:00:00.000Z",
      display_name: "Dup",
    });
    const out = dedupeVisitorsByParticipantId([a, b]);
    assert.equal(out.length, 1);
    assert.equal(out[0].display_name, "Dup");
  });

  it("aisla por meetingId vía datos de entrada distintos", () => {
    const m1 = sampleVisitor({ participant_id: "a" });
    const m2 = sampleVisitor({ participant_id: "b" });
    assert.equal(dedupeVisitorsByParticipantId([m1, m2]).length, 2);
  });
});
