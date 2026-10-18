import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sendConversationEcho } from "./present-echo";

describe("sendConversationEcho", () => {
  it("envía una segunda intervención con echoId distinto", () => {
    const sent: string[] = [];
    const last = { current: null as string | null };
    const send = (payload: Record<string, unknown>) => {
      sent.push(String(payload.event_type || ""));
    };
    assert.equal(sendConversationEcho(send, "c1", "Primera diapositiva", last, "echo-a"), true);
    assert.equal(sendConversationEcho(send, "c1", "Segunda diapositiva", last, "echo-b"), true);
    assert.equal(last.current, "echo-b");
    assert.ok(sent.includes("conversation.echo"));
    assert.equal(sent.filter((t) => t === "conversation.echo").length, 2);
  });

  it("un error de envío no deja el echoId bloqueado", () => {
    const last = { current: null as string | null };
    let calls = 0;
    const send = () => {
      calls += 1;
      if (calls > 1) throw new Error("daily down");
    };
    assert.equal(sendConversationEcho(send, "c1", "Hola", last, "echo-1"), false);
    assert.equal(last.current, null);
    const okSend = () => {
      /* interrupt + echo */
    };
    assert.equal(sendConversationEcho(okSend, "c1", "Hola otra vez", last, "echo-1"), true);
    assert.equal(last.current, "echo-1");
  });
});
