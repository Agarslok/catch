import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildVisitorSessionSummaries,
  formatDurationSeconds,
  resolveVisitorPresence,
  VISITOR_PRESENCE_STALE_MS,
} from "./participant-summaries";
import type { InteractionEventRow, SessionRegistryRow } from "./types";

describe("participant-summaries", () => {
  it("formatea duración", () => {
    assert.equal(formatDurationSeconds(9), "9 s");
    assert.equal(formatDurationSeconds(75), "1 min 15 s");
    assert.equal(formatDurationSeconds(3600), "1 h");
  });

  it("calcula inicio, fin y secciones por visitante", () => {
    const events: InteractionEventRow[] = [
      {
        id: "1",
        client_event_id: "a",
        meeting_id: "m",
        session_id: "s1",
        participant_id: "p1",
        participant_role: "visitor",
        event_type: "session.join",
        metadata: { display_name: "Ana" },
        schema_version: "1.0",
        created_at: "2026-10-18T15:00:00.000Z",
      },
      {
        id: "2",
        client_event_id: "b",
        meeting_id: "m",
        session_id: "s1",
        participant_id: "p1",
        participant_role: "visitor",
        event_type: "presentation.navigated_forward",
        metadata: { section_name: "Beneficios" },
        schema_version: "1.0",
        created_at: "2026-10-18T15:05:00.000Z",
      },
      {
        id: "3",
        client_event_id: "c",
        meeting_id: "m",
        session_id: "s1",
        participant_id: "p1",
        participant_role: "visitor",
        event_type: "question.asked",
        metadata: { section_name: "Indicadores" },
        schema_version: "1.0",
        created_at: "2026-10-18T15:10:00.000Z",
      },
    ];
    const sessions: SessionRegistryRow[] = [
      {
        session_id: "s1",
        meeting_id: "m",
        participant_id: "p1",
        participant_role: "visitor",
        joined_at: "2026-10-18T15:00:00.000Z",
        left_at: "2026-10-18T15:12:00.000Z",
        schema_version: "1.0",
      },
    ];
    const [row] = buildVisitorSessionSummaries(events, sessions, { p1: "Ana" });
    assert.equal(row.display_name, "Ana");
    assert.equal(row.duration_seconds, 12 * 60);
    assert.deepEqual(row.sections, ["Beneficios", "Indicadores"]);
    assert.equal(row.questions_asked, 1);
    assert.equal(row.clicks, 0);
    assert.equal(row.still_active, false);
    assert.equal(row.presence, "left");
    assert.equal(row.presence_label, "Desconectado");
  });

  it("unifica recargas en una sola identidad", () => {
    const events: InteractionEventRow[] = [
      {
        id: "1",
        client_event_id: "j1",
        meeting_id: "m",
        session_id: "tab-a",
        participant_id: "p1",
        participant_role: "visitor",
        event_type: "session.join",
        metadata: { display_name: "Ana" },
        schema_version: "1.0",
        created_at: "2026-10-18T15:00:00.000Z",
      },
      {
        id: "2",
        client_event_id: "j2",
        meeting_id: "m",
        session_id: "tab-b",
        participant_id: "p1",
        participant_role: "visitor",
        event_type: "session.join",
        metadata: { display_name: "Ana" },
        schema_version: "1.0",
        created_at: "2026-10-18T15:01:00.000Z",
      },
    ];
    const sessions: SessionRegistryRow[] = [
      {
        session_id: "tab-a",
        meeting_id: "m",
        participant_id: "p1",
        participant_role: "visitor",
        joined_at: "2026-10-18T15:00:00.000Z",
        left_at: "2026-10-18T15:01:00.000Z",
        last_seen_at: "2026-10-18T15:01:00.000Z",
        schema_version: "1.0",
      },
      {
        session_id: "tab-b",
        meeting_id: "m",
        participant_id: "p1",
        participant_role: "visitor",
        joined_at: "2026-10-18T15:01:05.000Z",
        left_at: null,
        last_seen_at: "2026-10-18T15:02:00.000Z",
        schema_version: "1.0",
      },
    ];
    const rows = buildVisitorSessionSummaries(events, sessions, { p1: "Ana" }, Date.parse("2026-10-18T15:02:10.000Z"));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].participant_id, "p1");
    assert.equal(rows[0].presence, "connected");
    assert.equal(rows[0].still_active, true);
  });

  it("marca ausencia de heartbeat como desconexión temporal, no como salida", () => {
    assert.equal(
      resolveVisitorPresence({
        latestLeftAt: null,
        lastSeenAt: "2026-10-18T15:00:00.000Z",
        nowMs: Date.parse("2026-10-18T15:00:00.000Z") + VISITOR_PRESENCE_STALE_MS + 1,
      }),
      "away",
    );
    assert.equal(
      resolveVisitorPresence({
        latestLeftAt: null,
        lastSeenAt: "2026-10-18T15:00:00.000Z",
        nowMs: Date.parse("2026-10-18T15:00:10.000Z"),
      }),
      "connected",
    );
  });

  it("session.leave confirma la salida", () => {
    assert.equal(
      resolveVisitorPresence({
        latestLeftAt: "2026-10-18T15:12:00.000Z",
        lastSeenAt: "2026-10-18T15:12:00.000Z",
        nowMs: Date.parse("2026-10-18T15:12:05.000Z"),
      }),
      "left",
    );
  });

  it("counts element.clicked separately from questions and detail.opened", () => {
    const base = {
      meeting_id: "m",
      session_id: "s1",
      participant_id: "p1",
      participant_role: "visitor" as const,
      schema_version: "1.0",
    };
    const events: InteractionEventRow[] = [
      {
        ...base,
        id: "1",
        client_event_id: "c1",
        event_type: "element.clicked",
        chart_id: "rotacion-tier",
        element_label: "Tier 1",
        metadata: { category: "Tier 1" },
        created_at: "2026-10-18T15:00:01.000Z",
      },
      {
        ...base,
        id: "2",
        client_event_id: "c2",
        event_type: "element.clicked",
        chart_id: "rotacion-tier",
        element_label: "Tier 1",
        metadata: { category: "Tier 1" },
        created_at: "2026-10-18T15:00:02.000Z",
      },
      {
        ...base,
        id: "3",
        client_event_id: "d1",
        event_type: "detail.opened",
        created_at: "2026-10-18T15:00:03.000Z",
      },
      {
        ...base,
        id: "4",
        client_event_id: "q1",
        event_type: "question.asked",
        created_at: "2026-10-18T15:00:04.000Z",
      },
    ];
    const [row] = buildVisitorSessionSummaries(events, [], { p1: "Ana" });
    assert.equal(row.clicks, 2);
    assert.equal(row.questions_asked, 1);
  });
});
