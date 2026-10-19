import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mergeIncomingGlobalView,
  nextAppliedEventSeq,
  readSectionAwaitFromGlobalView,
  shouldApplyMeetingStateRow,
  sortMeetingStateRowsBySeq,
} from "./meeting-state-sync";

describe("meeting state sync (Fase 9)", () => {
  it("acepta eventos con event_seq mayor", () => {
    assert.equal(shouldApplyMeetingStateRow(3, { event_seq: 4 }), true);
    assert.equal(shouldApplyMeetingStateRow(4, { event_seq: 4 }), false);
    assert.equal(shouldApplyMeetingStateRow(5, { event_seq: 4 }), false);
  });

  it("hidratación inicial acepta la primera fila", () => {
    assert.equal(shouldApplyMeetingStateRow(-1, { event_seq: 0 }), true);
  });

  it("evento sin event_seq se aplica (modo local)", () => {
    assert.equal(shouldApplyMeetingStateRow(10, {}), true);
  });

  it("ordena cola pendiente por event_seq", () => {
    const sorted = sortMeetingStateRowsBySeq([
      { event_seq: 9, current_step: 2 },
      { event_seq: 7, current_step: 1 },
      { event_seq: 8, current_step: 1 },
    ]);
    assert.deepEqual(
      sorted.map((r) => r.event_seq),
      [7, 8, 9],
    );
  });

  it("nextAppliedEventSeq avanza el contador local", () => {
    assert.equal(nextAppliedEventSeq(2, { event_seq: 5 }), 5);
    assert.equal(nextAppliedEventSeq(5, {}), 5);
  });

  it("global_view remoto actualiza awaitingModerator a false", () => {
    const merged = mergeIncomingGlobalView(
      { awaitingModerator: true, sectionAwaitSectionId: "sec-a" },
      { awaitingModerator: false, sectionAwaitSectionId: null },
    );
    assert.equal(merged.awaitingModerator, false);
    assert.equal(merged.sectionAwaitSectionId, null);
  });

  it("cierre de sección Fase 8 legible desde global_view", () => {
    const awaitInfo = readSectionAwaitFromGlobalView({
      awaitingModerator: true,
      sectionAwaitSectionId: "sec-rotacion",
      sectionAwaitSectionLabel: "Rotación",
    });
    assert.equal(awaitInfo.awaitingModerator, true);
    assert.equal(awaitInfo.sectionId, "sec-rotacion");
  });

  it("exploración local no altera global_view al fusionar vacío", () => {
    const merged = mergeIncomingGlobalView(
      { awaitingModerator: true, munFilter: "total" },
      undefined,
    );
    assert.equal(merged.awaitingModerator, true);
    assert.equal(merged.munFilter, "total");
  });

  it("evento duplicado/atrasado no revierte secuencia", () => {
    let applied = 10;
    const stale = { event_seq: 9, current_step: 0 };
    const fresh = { event_seq: 11, current_step: 3 };
    assert.equal(shouldApplyMeetingStateRow(applied, stale), false);
    assert.equal(shouldApplyMeetingStateRow(applied, fresh), true);
    applied = nextAppliedEventSeq(applied, fresh);
    assert.equal(applied, 11);
  });

  it("reconexión: fila vigente con seq alto se aplica tras desconexión", () => {
    assert.equal(shouldApplyMeetingStateRow(4, { event_seq: 12 }), true);
  });
});
