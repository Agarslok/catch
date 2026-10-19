import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { executeMonitorAiTool } from "@/lib/monitor-ai/tools/execute";
import {
  defaultControllerSnapshot,
  validateMonitorAiStructuredResponse,
} from "@/lib/monitor-ai/action-contract";
import { applyPresentationEffects } from "@/lib/monitor-ai/presentation-controller-effects";
import { runMonitorAiInterpret } from "@/lib/monitor-ai/interpret";
import { shouldApplyMeetingStateRow } from "./meeting-state-sync";
import { evaluateMonitorNarrationEnd } from "./section-flow";
import { buildMonitorPasos } from "./monitor-pasos";
import { scriptContinueTarget } from "./section-flow";
import { generateSessionScript } from "./script";
import {
  abortAdvance,
  beginAdvance,
  commitAdvance,
  emptyAdvanceLock,
  invalidatePendingOnPause,
  isConfirmedNarrationEnd,
  mapAiErrorToRecovery,
  pendingMatchesGeneration,
  recoveryNotice,
  shouldSkipRetryAfterPersist,
} from "./presentation-recovery";

describe("presentation recovery (Fase 10)", () => {
  const pasos = buildMonitorPasos();
  const lastExplica0 = pasos.findIndex(
    (p, i) =>
      p.tipo === "explica" &&
      p.sectionIndex === 0 &&
      pasos.filter((x) => x.tipo === "explica" && x.sectionIndex === 0).length &&
      i ===
        pasos.reduce(
          (acc, x, idx) => (x.tipo === "explica" && x.sectionIndex === 0 ? idx : acc),
          -1,
        ),
  );

  it("respuesta inválida de IA no produce efectos de navegación", async () => {
    const r = await runMonitorAiInterpret(
      {
        meetingId: "demo",
        instruction: "ve a una gráfica que no existe xyzzy",
        snapshot: defaultControllerSnapshot({ stepIndex: 1 }),
      },
      async () => ({
        ok: true,
        text: JSON.stringify({
          contract: "catch.monitor.presentation.actions.v1",
          message: "voy",
          actions: [{ type: "go_to_section", chartId: "no-existe" }],
        }),
      }),
    );
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.body.effects.length, 0);
    assert.equal(r.body.meta.currentStep, 1);
  });

  it("error de IA no se reintenta en bucle", async () => {
    let n = 0;
    const r = await runMonitorAiInterpret(
      {
        meetingId: "demo",
        instruction: "¿Cuál fue el PIB nacional de 2019 en esta sesión?",
        snapshot: defaultControllerSnapshot({ stepIndex: 1 }),
      },
      async () => {
        n += 1;
        return { ok: false, code: "AI_PROVIDER_ERROR" };
      },
    );
    assert.equal(r.ok, false);
    assert.equal(n, 1);
    assert.equal(mapAiErrorToRecovery("AI_PROVIDER_ERROR"), "ai_provider");
  });

  it("consulta inválida no inventa datos", () => {
    const r = executeMonitorAiTool("get_section_summary", { sectionKey: "nope" });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.ok(r.error);
  });

  it("gráfica inexistente no cambia el punto", () => {
    const v = validateMonitorAiStructuredResponse(
      {
        contract: "catch.monitor.presentation.actions.v1",
        message: "salto",
        actions: [{ type: "go_to_section", chartId: "grafica-fantasma" }],
      },
      defaultControllerSnapshot({ stepIndex: 4 }),
    );
    assert.equal(v.ok, false);
  });

  it("avatar inactivo deja un aviso recuperable sin mover el punto", () => {
    const n = recoveryNotice("avatar_inactive");
    assert.equal(n.stayOnCurrentPoint, true);
    assert.match(n.actionHint, /Repita|continúe|Conecte/i);
  });

  it("temporizador no confirma el fin de narración ni cierra la sección", () => {
    assert.equal(isConfirmedNarrationEnd("timer_estimate", true), false);
    const d = evaluateMonitorNarrationEnd({
      stepIndex: lastExplica0,
      execId: "e1",
      currentStepIndex: lastExplica0,
      runtimeExecId: "e1",
      pasos,
      dedup: null,
      narrationFinished: true,
      endSource: "timer_estimate",
    });
    assert.equal(d.kind, "ignore");
    assert.equal(d.reason, "unconfirmed_timer");
  });

  it("finalización duplicada produce una sola transición", () => {
    const first = evaluateMonitorNarrationEnd({
      stepIndex: lastExplica0,
      execId: "e1",
      currentStepIndex: lastExplica0,
      runtimeExecId: "e1",
      pasos,
      dedup: null,
      narrationFinished: true,
      endSource: "moderator",
    });
    assert.equal(first.kind, "navigate_hoja");
    const second = evaluateMonitorNarrationEnd({
      stepIndex: lastExplica0,
      execId: "e2",
      currentStepIndex: lastExplica0,
      runtimeExecId: "e2",
      pasos,
      dedup: first.kind === "navigate_hoja" ? first.dedup : null,
      narrationFinished: true,
      endSource: "moderator",
    });
    assert.equal(second.kind, "deduped");
  });

  it("dos órdenes simultáneas de avance: una sola entra", () => {
    let lock = emptyAdvanceLock(0);
    const a = beginAdvance(lock, 3);
    assert.equal(a.ok, true);
    if (!a.ok) return;
    lock = a.lock;
    const b = beginAdvance(lock, 4);
    assert.equal(b.ok, false);
    if (!b.ok) assert.equal(b.reason, "advance_in_flight");
  });

  it("pausa invalida una preparación pendiente", () => {
    let lock = emptyAdvanceLock(1);
    const a = beginAdvance(lock, 5);
    assert.equal(a.ok, true);
    if (!a.ok) return;
    lock = a.lock;
    assert.equal(pendingMatchesGeneration(lock, a.generation, "live"), true);
    lock = invalidatePendingOnPause(lock);
    assert.equal(pendingMatchesGeneration(lock, a.generation, "live"), false);
    assert.equal(pendingMatchesGeneration(lock, a.generation, "paused"), false);
  });

  it("reintento tras persistir el mismo paso no duplica", () => {
    assert.equal(
      shouldSkipRetryAfterPersist({ persistedStep: 7, intendedStep: 7 }),
      true,
    );
    let lock = emptyAdvanceLock(7);
    lock = commitAdvance(lock, lock.generation, 7);
    const again = beginAdvance(lock, 7);
    assert.equal(again.ok, false);
  });

  it("reconexión: event_seq atrasado no revierte", () => {
    assert.equal(shouldApplyMeetingStateRow(12, { event_seq: 9 }), false);
    assert.equal(shouldApplyMeetingStateRow(12, { event_seq: 13 }), true);
  });

  it("visitante no ejecuta navigate (efecto no autorizado)", () => {
    const r = applyPresentationEffects(
      [{ kind: "navigate", targetStep: 8 }],
      { role: "cliente", stepIndex: 2 },
      { moveModerator: () => true },
    );
    assert.equal(r.navigated, false);
    assert.equal(r.skipped[0]?.reason, "visitor_forbidden");
  });

  it("pausa impide publicar un navigate pendiente", () => {
    let moved = 0;
    const r = applyPresentationEffects(
      [{ kind: "navigate", targetStep: 6 }],
      { role: "moderador", stepIndex: 2, presentationStatus: "paused" },
      { moveModerator: () => {
        moved += 1;
        return true;
      } },
    );
    assert.equal(moved, 0);
    assert.equal(r.navigated, false);
  });

  it("next_slide en pausa se rechaza en el contrato", () => {
    const v = validateMonitorAiStructuredResponse(
      {
        contract: "catch.monitor.presentation.actions.v1",
        message: "avanza",
        actions: [{ type: "next_slide" }],
      },
      defaultControllerSnapshot({ stepIndex: 3, presentationStatus: "paused" }),
    );
    assert.equal(v.ok, false);
  });

  it("abortar generación no deja el lock colgado", () => {
    let lock = emptyAdvanceLock(0);
    const a = beginAdvance(lock, 2);
    assert.equal(a.ok, true);
    if (!a.ok) return;
    lock = abortAdvance(a.lock, a.generation);
    const b = beginAdvance(lock, 3);
    assert.equal(b.ok, true);
  });

  it("Fase 8: continuar desde claridad sigue disponible", () => {
    const script = generateSessionScript("rec-test");
    const clarity = script.points.find((p) => p.kind === "clarity_check");
    assert.ok(clarity);
    const c = scriptContinueTarget(script, clarity!.id);
    assert.equal(c.ok, true);
  });

  it("mensajes de recuperación no revelan secretos", () => {
    for (const kind of [
      "ai_invalid",
      "ai_provider",
      "data_query",
      "unauthorized",
    ] as const) {
      const n = recoveryNotice(kind);
      assert.equal(/api[_-]?key|sk-|secret/i.test(n.detail), false);
      assert.equal(n.stayOnCurrentPoint, true);
    }
  });
});
