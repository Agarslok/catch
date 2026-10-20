import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { performTavusRaiseHand, TAVUS_RAISE_HAND_ECHO } from "./raise-hand";

describe("performTavusRaiseHand", () => {
  it("interrumpe y envía eco de escucha cuando Tavus está activo", () => {
    let interrupted = false;
    let echoed = "";
    const result = performTavusRaiseHand({
      tavusActive: true,
      interruptSpeech: () => {
        interrupted = true;
        return true;
      },
      speakEcho: (text) => {
        echoed = text;
        return true;
      },
    });
    assert.equal(interrupted, true);
    assert.equal(echoed, TAVUS_RAISE_HAND_ECHO);
    assert.equal(result.echoSent, true);
  });

  it("solo interrumpe si no hay sesión Tavus", () => {
    const result = performTavusRaiseHand({
      tavusActive: false,
      interruptSpeech: () => true,
      speakEcho: () => true,
    });
    assert.equal(result.echoSent, false);
    assert.equal(result.tavusActive, false);
  });
});
