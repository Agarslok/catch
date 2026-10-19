import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bumpHandoffCycleOnRestart,
  createHandoffCycleState,
  isPresentationHandoffPoint,
  resetHandoffAnnouncementIfLeft,
  shouldAnnounceHandoff,
} from "./presentation-handoff";
import type { ScriptPoint } from "./script-types";

describe("presentation-handoff", () => {
  it("detecta el punto de cierre del guion", () => {
    assert.equal(isPresentationHandoffPoint({ kind: "closing" } as ScriptPoint), true);
    assert.equal(isPresentationHandoffPoint({ kind: "chart" } as ScriptPoint), false);
  });

  it("anuncia una sola vez por visita al cierre", () => {
    let state = createHandoffCycleState();
    const first = shouldAnnounceHandoff(state, true);
    assert.equal(first.announce, true);
    state = first.state;
    const second = shouldAnnounceHandoff(state, true);
    assert.equal(second.announce, false);
  });

  it("vuelve a anunciar tras salir del cierre sin reiniciar", () => {
    let state = createHandoffCycleState();
    state = shouldAnnounceHandoff(state, true).state;
    state = resetHandoffAnnouncementIfLeft(state, true, false);
    const again = shouldAnnounceHandoff(state, true);
    assert.equal(again.announce, true);
  });

  it("reinicio desde cierre incrementa el ciclo", () => {
    let state = createHandoffCycleState();
    state = shouldAnnounceHandoff(state, true).state;
    state = bumpHandoffCycleOnRestart(state);
    assert.equal(state.cycle, 1);
    const afterRestart = shouldAnnounceHandoff(state, true);
    assert.equal(afterRestart.announce, true);
  });
});
