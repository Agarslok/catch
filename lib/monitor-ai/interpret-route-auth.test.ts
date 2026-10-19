import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { POST } from "@/app/api/monitor/[meetingId]/interpret/route";
import {
  createParticipantToken,
  createPresenterToken,
} from "@/lib/meeting/presenter-auth";
import { buildMonitorPasos } from "@/lib/meeting/monitor-pasos";

const meetingId = "demo-auth-meeting";
const participantId = "visitor-test-1";

function interpretRequest(headers: Record<string, string>, body: Record<string, unknown>) {
  const pasos = buildMonitorPasos();
  const payload = {
    instruction: "Avanza al siguiente punto",
    stepIndex: Math.min(2, pasos.length - 1),
    presentationStatus: "live",
    ...body,
  };
  const req = new Request(`http://localhost/api/monitor/${meetingId}/interpret`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(payload),
  });
  return POST(req, { params: Promise.resolve({ meetingId }) });
}

describe("POST /api/monitor/[meetingId]/interpret auth", () => {
  it("rechaza petición sin autenticación", async () => {
    const res = await interpretRequest({}, {});
    assert.equal(res.status, 401);
  });

  it("rechaza comandos globales de un participante", async () => {
    const token = createParticipantToken(meetingId, participantId);
    const res = await interpretRequest(
      { "x-participant-token": token },
      { participantId },
    );
    assert.equal(res.status, 403);
    const data = (await res.json()) as { error?: { code?: string } };
    assert.equal(data.error?.code, "FORBIDDEN");
  });

  it("acepta moderador con x-presenter-token", async () => {
    const token = createPresenterToken(meetingId);
    const res = await interpretRequest({ "x-presenter-token": token }, {});
    assert.equal(res.status, 200);
    const data = (await res.json()) as { effects?: unknown[] };
    assert.ok(Array.isArray(data.effects));
  });
});
