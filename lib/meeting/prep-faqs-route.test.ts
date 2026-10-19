import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GET, PUT } from "@/app/api/meeting/[meetingId]/prep-faqs/route";
import { createPresenterToken } from "@/lib/meeting/presenter-auth";
import { prepFaqDbRows, prepFaqsFromPutBody } from "@/lib/meeting/prep-faqs";

const meetingA = "faq-meet-a";
const meetingB = "faq-meet-b";

function putRequest(meetingId: string, headers: Record<string, string>, body: unknown) {
  return PUT(
    new Request(`http://localhost/api/meeting/${meetingId}/prep-faqs`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ meetingId }) },
  );
}

describe("prep-faqs persistence helpers", () => {
  it("normalizes pregunta/respuesta on PUT body and isolates meeting_id in rows", () => {
    const items = prepFaqsFromPutBody(meetingA, {
      items: [{ id: "1", pregunta: "P", respuesta: "R" }],
    });
    assert.equal(items[0]?.question, "P");
    const rowsA = prepFaqDbRows(meetingA, items);
    const rowsB = prepFaqDbRows(meetingB, [{ id: "2", question: "Qb", answer: "Ab" }]);
    assert.ok(rowsA.every((r) => r.meeting_id === meetingA));
    assert.ok(rowsB.every((r) => r.meeting_id === meetingB));
    assert.equal(rowsA.some((r) => r.meeting_id === meetingB), false);
  });
});

describe("PUT /api/meeting/[meetingId]/prep-faqs auth", () => {
  it("rechaza escritura sin token de presentador", async () => {
    const res = await putRequest(meetingA, {}, { items: [] });
    assert.equal(res.status, 401);
  });

  it("rechaza token de otra reunión", async () => {
    const token = createPresenterToken(meetingB);
    const res = await putRequest(meetingA, { "x-presenter-token": token }, { items: [] });
    assert.equal(res.status, 401);
  });

  it("acepta presentador de la reunión (503 si no hay service role)", async () => {
    const token = createPresenterToken(meetingA);
    const res = await putRequest(
      meetingA,
      { "x-presenter-token": token },
      { items: [{ id: "1", question: "Q", answer: "A" }] },
    );
    assert.ok(res.status === 200 || res.status === 503);
    if (res.status === 503) {
      const data = (await res.json()) as { error?: string };
      assert.match(String(data.error ?? ""), /Supabase/i);
    }
  });
});

describe("GET /api/meeting/[meetingId]/prep-faqs", () => {
  it("no exige token de visitante (lectura de la reunión)", async () => {
    const res = await GET(new Request("http://localhost/api/meeting/faq-meet-a/prep-faqs"), {
      params: Promise.resolve({ meetingId: meetingA }),
    });
    assert.ok(res.status === 200 || res.status === 500 || res.status === 503);
  });
});
