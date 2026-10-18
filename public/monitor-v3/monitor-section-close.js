/**
 * Cierre de sección (Fase 8) — espejo de lib/meeting/section-flow.ts para el HTML del monitor.
 * Requiere PASOS global (monitor-en-vivo-catch.html).
 */
(function () {
  function lastExplicaStep(sectionIndex) {
    var last = -1;
    PASOS.forEach(function (p, i) {
      if (p.tipo === "explica" && p.s === sectionIndex) last = i;
    });
    return last;
  }

  function hojaStep(sectionIndex) {
    return PASOS.findIndex(function (p) {
      return p.tipo === "hoja" && p.s === sectionIndex;
    });
  }

  function isLastExplica(stepIndex) {
    var p = PASOS[stepIndex];
    if (!p || p.tipo !== "explica") return false;
    return stepIndex === lastExplicaStep(p.s);
  }

  function estimateNarrationDurationMs(text) {
    var t = String(text || "").trim();
    if (!t) return 0;
    var words = t.split(/\s+/).length;
    return Math.min(45000, Math.max(1200, words * 380));
  }

  function isConfirmedEnd(source, finished) {
    if (!finished) return false;
    if (source === "timer_estimate") return false;
    return true;
  }

  function evaluateNarrationEnd(input) {
    if (!isConfirmedEnd(input.endSource, input.narrationFinished)) {
      return {
        kind: "ignore",
        reason: input.endSource === "timer_estimate" ? "unconfirmed_timer" : "narration_not_finished",
      };
    }
    if (!input.execId || !input.runtimeExecId || input.execId !== input.runtimeExecId) {
      return { kind: "ignore", reason: "stale_exec_id" };
    }
    if (input.currentStepIndex !== input.stepIndex) {
      return { kind: "ignore", reason: "step_changed" };
    }
    var paso = PASOS[input.stepIndex];
    if (!paso) return { kind: "ignore", reason: "invalid_step" };
    var dedup = input.dedup;

    if (paso.tipo === "explica" && !isLastExplica(input.stepIndex)) {
      var next = PASOS[input.stepIndex + 1];
      if (next && next.tipo === "explica" && next.s === paso.s) {
        if (dedup && dedup.anchorStep === input.stepIndex && dedup.execId === input.execId) {
          return { kind: "deduped", reason: "already_advanced_slide" };
        }
        return {
          kind: "navigate_next_slide",
          targetStep: input.stepIndex + 1,
          sectionIndex: paso.s,
          dedup: { anchorStep: input.stepIndex, sectionIndex: paso.s, execId: input.execId },
        };
      }
      return { kind: "ignore", reason: "no_same_section_slide" };
    }

    if (paso.tipo === "explica" && isLastExplica(input.stepIndex)) {
      var hoja = hojaStep(paso.s);
      if (hoja < 0) return { kind: "ignore", reason: "no_hoja" };
      if (dedup && dedup.anchorStep === input.stepIndex && dedup.sectionIndex === paso.s) {
        return { kind: "deduped", reason: "already_closed" };
      }
      return {
        kind: "navigate_hoja",
        targetStep: hoja,
        sectionIndex: paso.s,
        dedup: { anchorStep: input.stepIndex, sectionIndex: paso.s, execId: input.execId },
      };
    }

    if (paso.tipo === "hoja") {
      if (dedup && dedup.anchorStep === input.stepIndex && dedup.sectionIndex === paso.s) {
        return { kind: "deduped", reason: "already_awaiting" };
      }
      return {
        kind: "await_moderator",
        sectionIndex: paso.s,
        atStep: input.stepIndex,
        dedup: { anchorStep: input.stepIndex, sectionIndex: paso.s, execId: input.execId },
      };
    }

    return { kind: "ignore", reason: "not_section_boundary" };
  }

  function continueTarget(stepIndex) {
    var paso = PASOS[stepIndex];
    if (!paso || paso.tipo !== "hoja") return null;
    var nextSec = paso.s + 1;
    var next = PASOS.findIndex(function (p) {
      return p.tipo === "explica" && p.s === nextSec;
    });
    if (next >= 0) return next;
    var cierre = PASOS.findIndex(function (p) {
      return p.tipo === "cierre";
    });
    return cierre >= 0 ? cierre : null;
  }

  function shouldBlockDuplicateContinue(lastAt, now) {
    if (lastAt == null) return false;
    return now - lastAt < 2500;
  }

  window.CatchSectionClose = {
    estimateNarrationDurationMs,
    evaluateNarrationEnd,
    continueTarget,
    shouldBlockDuplicateContinue,
  };
})();
