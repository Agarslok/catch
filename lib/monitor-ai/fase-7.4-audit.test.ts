import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { POST as interpretPost } from "@/app/api/monitor/[meetingId]/interpret/route";
import { POST as monitorStatePost } from "@/app/api/monitor/[meetingId]/state/route";
import { POST as meetingStatePost } from "@/app/api/meeting/[meetingId]/state/route";
import { POST as chatPost } from "@/app/api/monitor/[meetingId]/chat/route";
import { buildMonitorPasos, findPasoIndexForChart } from "@/lib/meeting/monitor-pasos";
import {
  createParticipantToken,
  createPresenterToken,
} from "@/lib/meeting/presenter-auth";
import {
  MONITOR_PRESENTATION_ACTION_CONTRACT,
  defaultControllerSnapshot,
  parseMonitorAiStructuredResponse,
  validateMonitorAiStructuredResponse,
} from "./action-contract";
import {
  runMonitorAiInterpret,
  validateMonitorAiInterpretRequest,
} from "./interpret";
import { applyPresentationEffects } from "./presentation-controller-effects";

const meetingId = "audit-7-4-meeting";
const participantId = "visitor-audit-1";
const pasos = buildMonitorPasos();
const hoja = pasos.findIndex((p) => p.tipo === "hoja");
const rotcomp = findPasoIndexForChart("rotserie");
const cuando = findPasoIndexForChart("cuandosevan");
const salarios = findPasoIndexForChart("salini");

function interpretHttp(headers: Record<string, string>, body: Record<string, unknown>) {
  const req = new Request(`http://localhost/api/monitor/${meetingId}/interpret`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({
      instruction: "Avanza al siguiente punto",
      stepIndex: 2,
      presentationStatus: "live",
      ...body,
    }),
  });
  return interpretPost(req, { params: Promise.resolve({ meetingId }) });
}

function countMoves(stepIndex: number, effects: Parameters<typeof applyPresentationEffects>[0]) {
  let pos = stepIndex;
  let moves = 0;
  let narrations = 0;
  const r = applyPresentationEffects(
    effects,
    { role: "moderador", stepIndex: pos, stepCount: pasos.length },
    {
      moveModerator(target) {
        if (target === pos) return false;
        pos = target;
        moves += 1;
        return true;
      },
      onNarration() {
        narrations += 1;
      },
    },
  );
  return { ...r, pos, moves, narrations };
}

describe("Fase 7.4 HTTP autorización /interpret", () => {
  it("sin autenticación → 401 y sin effects", async () => {
    const res = await interpretHttp({}, {});
    assert.equal(res.status, 401);
    const data = (await res.json()) as { effects?: unknown; error?: { code?: string } };
    assert.equal(data.error?.code, "UNAUTHORIZED");
    assert.equal(data.effects, undefined);
  });

  it("participante autenticado → 403 sin effects", async () => {
    const token = createParticipantToken(meetingId, participantId);
    const res = await interpretHttp(
      { "x-participant-token": token },
      { participantId, role: "moderador" },
    );
    assert.equal(res.status, 403);
    const data = (await res.json()) as { effects?: unknown; error?: { code?: string } };
    assert.equal(data.error?.code, "FORBIDDEN");
    assert.equal(data.effects, undefined);
  });

  it("token de presentador inválido → 401", async () => {
    const res = await interpretHttp({ "x-presenter-token": "0".repeat(40) }, {});
    assert.equal(res.status, 401);
  });

  it("campo role en el cuerpo no concede permiso al visitante", async () => {
    const token = createParticipantToken(meetingId, participantId);
    const res = await interpretHttp(
      { "x-participant-token": token },
      { participantId, role: "moderador" },
    );
    assert.equal(res.status, 403);
  });

  it("viewContext.role no sustituye el rol autenticado del moderador", async () => {
    const token = createPresenterToken(meetingId);
    const res = await interpretHttp(
      { "x-presenter-token": token },
      {
        instruction: "Avanza al siguiente punto",
        stepIndex: 2,
        viewContext: {
          presentationStep: 2,
          stepType: "explica",
          followPresenter: true,
          role: "visitor",
          visibleChartIds: ["plantilla"],
          mountedChartIds: ["plantilla"],
        },
      },
    );
    assert.equal(res.status, 200);
    const data = (await res.json()) as { effects: Array<{ kind: string }> };
    assert.ok(data.effects.some((e) => e.kind === "navigate"));
  });

  it("moderador autorizado obtiene effects validados", async () => {
    const token = createPresenterToken(meetingId);
    const res = await interpretHttp({ "x-presenter-token": token }, {});
    assert.equal(res.status, 200);
    const data = (await res.json()) as {
      contract: string;
      effects: unknown[];
    };
    assert.equal(data.contract, MONITOR_PRESENTATION_ACTION_CONTRACT);
    assert.ok(Array.isArray(data.effects));
  });
});

describe("Fase 7.4 HTTP estado global (bypass de /interpret)", () => {
  it("POST /api/monitor/.../state sin token → 401", async () => {
    const req = new Request(`http://localhost/api/monitor/${meetingId}/state`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: 9 }),
    });
    const res = await monitorStatePost(req, { params: Promise.resolve({ meetingId }) });
    assert.equal(res.status, 401);
  });

  it("POST /api/monitor/.../state con token de participante → 401", async () => {
    const token = createParticipantToken(meetingId, participantId);
    const req = new Request(`http://localhost/api/monitor/${meetingId}/state`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-participant-token": token,
        "x-presenter-token": token,
      },
      body: JSON.stringify({ step: 9 }),
    });
    const res = await monitorStatePost(req, { params: Promise.resolve({ meetingId }) });
    assert.equal(res.status, 401);
  });

  it("POST /api/meeting/.../state sin presentador → 401", async () => {
    const req = new Request(`http://localhost/api/meeting/${meetingId}/state`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentStep: 4 }),
    });
    const res = await meetingStatePost(req, { params: Promise.resolve({ meetingId }) });
    assert.equal(res.status, 401);
  });

  it("chat de visitante no expone effects de presentación v1", async () => {
    const token = createParticipantToken(meetingId, participantId);
    const req = new Request(`http://localhost/api/monitor/${meetingId}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-participant-token": token,
      },
      body: JSON.stringify({
        question: "Avanza al siguiente punto",
        participantId,
      }),
    });
    const res = await chatPost(req, { params: Promise.resolve({ meetingId }) });
    if (res.status === 200) {
      const data = (await res.json()) as { contract?: string; effects?: unknown };
      assert.notEqual(data.contract, MONITOR_PRESENTATION_ACTION_CONTRACT);
      assert.equal(data.effects, undefined);
    } else {
      assert.ok([401, 403, 503, 502].includes(res.status));
    }
  });
});

describe("Fase 7.4 contrato e instrucciones", () => {
  it("rechaza role=visitor en validate aunque el cuerpo sea de moderador", () => {
    const r = validateMonitorAiInterpretRequest(
      "demo",
      { instruction: "Avanza al siguiente punto", stepIndex: 2 },
      "visitor",
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "FORBIDDEN");
  });

  it("runMonitorAiInterpret no ejecuta con snapshot visitor", async () => {
    const r = await runMonitorAiInterpret({
      meetingId: "demo",
      instruction: "Avanza al siguiente punto",
      snapshot: defaultControllerSnapshot({ role: "visitor", stepIndex: 2 }),
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "FORBIDDEN");
  });

  it("propuesta IA desconocida no produce effects", () => {
    const parsed = parseMonitorAiStructuredResponse({
      contract: MONITOR_PRESENTATION_ACTION_CONTRACT,
      message: "hack",
      actions: [{ type: "run_javascript", code: "alert(1)" }],
    });
    assert.equal(parsed.ok, false);
  });

  it("start_presentation pendiente no se ejecuta", () => {
    const v = validateMonitorAiStructuredResponse(
      {
        contract: MONITOR_PRESENTATION_ACTION_CONTRACT,
        message: "Start.",
        actions: [{ type: "start_presentation" }],
      },
      defaultControllerSnapshot(),
    );
    assert.equal(v.ok, false);
  });

  it("sección, gráfica, inexistente y ambiguo", async () => {
    const sec = await runMonitorAiInterpret({
      meetingId: "demo",
      instruction: "Ve a la sección de salarios",
      snapshot: defaultControllerSnapshot({ stepIndex: 0 }),
    });
    assert.equal(sec.ok, true);
    if (sec.ok) {
      const nav = sec.body.effects.find((e) => e.kind === "navigate");
      assert.ok(nav && nav.kind === "navigate");
      assert.equal(nav.targetStep, salarios);
    }

    const chart = await runMonitorAiInterpret({
      meetingId: "demo",
      instruction: "Ve a la sección de cuándo se van",
      snapshot: defaultControllerSnapshot({ stepIndex: 0 }),
    });
    assert.equal(chart.ok, true);
    if (chart.ok) {
      const nav = chart.body.effects.find((e) => e.kind === "navigate");
      assert.ok(nav && nav.kind === "navigate");
      assert.equal(nav.targetStep, cuando);
    }

    const missing = await runMonitorAiInterpret({
      meetingId: "demo",
      instruction: "Ve a la sección de ventas",
      snapshot: defaultControllerSnapshot({ stepIndex: 0 }),
    });
    assert.equal(missing.ok, true);
    if (missing.ok) assert.equal(missing.body.effects.length, 0);

    const amb = await runMonitorAiInterpret({
      meetingId: "demo",
      instruction: "Ve a la sección de rotación",
      snapshot: defaultControllerSnapshot({ stepIndex: 0 }),
    });
    assert.equal(amb.ok, true);
    if (amb.ok) assert.equal(amb.body.effects.length, 0);
  });

  it("avance, retroceso, repetir, inicio y volver al inicio", async () => {
    const next = await runMonitorAiInterpret({
      meetingId: "demo",
      instruction: "Avanza al siguiente punto",
      snapshot: defaultControllerSnapshot({ stepIndex: rotcomp }),
    });
    assert.equal(next.ok && next.body.effects.some((e) => e.kind === "navigate"), true);

    const prev = await runMonitorAiInterpret({
      meetingId: "demo",
      instruction: "Regresa al punto anterior",
      snapshot: defaultControllerSnapshot({ stepIndex: rotcomp }),
    });
    assert.equal(prev.ok, true);
    if (prev.ok) {
      const nav = prev.body.effects.find((e) => e.kind === "navigate");
      assert.ok(nav && nav.kind === "navigate");
      assert.equal(nav.targetStep, rotcomp - 1);
    }

    const repeat = await runMonitorAiInterpret({
      meetingId: "demo",
      instruction: "Repite la explicación",
      snapshot: defaultControllerSnapshot({ stepIndex: rotcomp }),
    });
    assert.equal(repeat.ok, true);
    if (repeat.ok) {
      assert.ok(repeat.body.effects.every((e) => e.kind !== "navigate"));
      assert.ok(repeat.body.effects.some((e) => e.kind === "narration"));
    }

    const start = await runMonitorAiInterpret({
      meetingId: "demo",
      instruction: "Inicia la presentación",
      snapshot: defaultControllerSnapshot({ stepIndex: 0 }),
    });
    assert.equal(start.ok, true);
    if (start.ok) {
      const nav = start.body.effects.find((e) => e.kind === "navigate");
      assert.ok(nav && nav.kind === "navigate");
      assert.equal(nav.targetStep, findPasoIndexForChart("plantilla"));
    }

    const home = await runMonitorAiInterpret({
      meetingId: "demo",
      instruction: "Vuelve al inicio",
      snapshot: defaultControllerSnapshot({ stepIndex: rotcomp }),
    });
    assert.equal(home.ok, true);
    if (home.ok) {
      const nav = home.body.effects.find((e) => e.kind === "navigate");
      assert.ok(nav && nav.kind === "navigate");
      assert.equal(nav.targetStep, 0);
    }
  });

  it("continuación respeta awaitingModerator y no se duplica", async () => {
    const ok = await runMonitorAiInterpret({
      meetingId: "demo",
      instruction: "Ya respondimos las preguntas; continúa",
      snapshot: defaultControllerSnapshot({ stepIndex: hoja }),
    });
    assert.equal(ok.ok, true);
    if (!ok.ok) return;
    const first = countMoves(hoja, ok.body.effects);
    assert.equal(first.moves, 1);

    const denied = await runMonitorAiInterpret({
      meetingId: "demo",
      instruction: "Sigamos con la presentación",
      snapshot: defaultControllerSnapshot({ stepIndex: 2 }),
    });
    assert.equal(denied.ok, true);
    if (denied.ok) assert.equal(denied.body.effects.length, 0);

    const second = await runMonitorAiInterpret({
      meetingId: "demo",
      instruction: "Continúa con la siguiente sección",
      snapshot: defaultControllerSnapshot({ stepIndex: first.pos }),
    });
    assert.equal(second.ok, true);
    if (second.ok) {
      const again = countMoves(first.pos, second.body.effects);
      assert.equal(again.moves, 0);
    }
  });
});

describe("Fase 7.4 ejecución sin duplicar eventos", () => {
  it("una navegación = un moveModerator", async () => {
    const r = await runMonitorAiInterpret({
      meetingId: "demo",
      instruction: "Ve a la sección de salarios",
      snapshot: defaultControllerSnapshot({ stepIndex: 0 }),
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    const applied = countMoves(0, r.body.effects);
    assert.equal(applied.moves, 1);
    assert.equal(applied.narrations, 0);
  });

  it("navigate + narration en el mismo lote no habla dos veces", () => {
    const applied = countMoves(2, [
      { kind: "narration", intent: "explain" },
      { kind: "navigate", targetStep: 5 },
    ]);
    assert.equal(applied.moves, 1);
    assert.equal(applied.narrations, 0);
  });

  it("destino actual no navega", async () => {
    const r = await runMonitorAiInterpret({
      meetingId: "demo",
      instruction: "Ve a la sección de salarios",
      snapshot: defaultControllerSnapshot({ stepIndex: salarios }),
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    const applied = countMoves(salarios, r.body.effects);
    assert.equal(applied.moves, 0);
  });

  it("visitante no mueve el controlador aunque reciba effects", () => {
    let pos = 4;
    let moves = 0;
    applyPresentationEffects(
      [{ kind: "navigate", targetStep: 10 }, { kind: "section_continue" }],
      { role: "visitor", stepIndex: pos, stepCount: pasos.length },
      {
        moveModerator(target) {
          pos = target;
          moves += 1;
          return true;
        },
      },
    );
    assert.equal(moves, 0);
    assert.equal(pos, 4);
  });

  it("el shell HTML ya no tiene navFallback de interpret", () => {
    const html = readFileSync(
      path.join(process.cwd(), "public/monitor-v3/monitor-en-vivo-catch.html"),
      "utf8",
    );
    assert.equal(html.includes("navFallback"), false);
  });
});

describe("Fase 7.4 gates y límites", () => {
  it("next_slide en el último paso no avanza", () => {
    const last = pasos.length - 1;
    const v = validateMonitorAiStructuredResponse(
      {
        contract: MONITOR_PRESENTATION_ACTION_CONTRACT,
        message: "Siguiente.",
        actions: [{ type: "next_slide" }],
      },
      defaultControllerSnapshot({ stepIndex: last, stepCount: pasos.length }),
    );
    assert.equal(v.ok, false);
  });

  it("previous_slide en el primero no retrocede", () => {
    const v = validateMonitorAiStructuredResponse(
      {
        contract: MONITOR_PRESENTATION_ACTION_CONTRACT,
        message: "Atrás.",
        actions: [{ type: "previous_slide" }],
      },
      defaultControllerSnapshot({ stepIndex: 0 }),
    );
    assert.equal(v.ok, false);
  });
});

describe("Fase 7.4 inspección de políticas Supabase (código, no runtime remoto)", () => {
  it("documenta que las migraciones actuales permiten escritura anon en meeting_state", () => {
    const sql = readFileSync(
      path.join(process.cwd(), "supabase/migrations/20260313180000_meeting_realtime.sql"),
      "utf8",
    );
    assert.match(sql, /meeting_state_insert_anon/);
    assert.match(sql, /for insert to anon, authenticated with check \(true\)/);
    assert.match(sql, /meeting_state_update_anon/);
  });
});
