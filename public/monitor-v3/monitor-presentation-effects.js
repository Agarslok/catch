/**
 * Adaptador cliente: efectos validados (catch.monitor.presentation.actions.v1) → controlador HTML.
 * Lógica espejo de lib/monitor-ai/presentation-controller-effects.ts
 */
(function () {
  function isModeratorRole(role) {
    return role === "moderador";
  }

  function normalizePresentationEffects(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      switch (item.kind) {
        case "monitor_highlight": {
          const action = item.action;
          if (!action || typeof action !== "object") continue;
          if (action.type !== "highlight" && action.type !== "clear_highlight") continue;
          out.push({ kind: "monitor_highlight", action });
          break;
        }
        case "navigate":
          if (Number.isInteger(item.targetStep)) {
            out.push({ kind: "navigate", targetStep: item.targetStep });
          }
          break;
        case "set_presentation_status":
          if (item.status === "live" || item.status === "paused") {
            out.push({ kind: "set_presentation_status", status: item.status });
          }
          break;
        case "narration":
          if (item.intent === "explain" || item.intent === "repeat" || item.intent === "ask_questions") {
            out.push({ kind: "narration", intent: item.intent });
          }
          break;
        case "section_continue":
          out.push({ kind: "section_continue" });
          break;
        default:
          break;
      }
    }
    return out;
  }

  function applyPresentationEffects(effects, ctx, dispatch) {
    const moderator = isModeratorRole(ctx.role);
    const paused = ctx.presentationStatus === "paused";
    const posBefore = typeof ctx.stepIndex === "number" ? ctx.stepIndex : 0;
    const stepCount = typeof ctx.stepCount === "number" && ctx.stepCount > 0 ? ctx.stepCount : 1;
    let posAfter = posBefore;
    let navigated = false;
    let highlight = null;
    const narrationIntents = [];
    const skipped = [];
    const hasNavigate = effects.some((e) => e.kind === "navigate");
    function clampStep(target) {
      const max = Math.max(0, stepCount - 1);
      return Math.max(0, Math.min(max, Math.trunc(target)));
    }

    for (const effect of effects) {
      switch (effect.kind) {
        case "monitor_highlight":
          highlight = effect.action;
          break;
        case "narration":
          if (hasNavigate && moderator) break;
          narrationIntents.push(effect.intent);
          if (dispatch.onNarration) dispatch.onNarration(effect.intent);
          break;
        case "section_continue":
          if (!moderator) {
            skipped.push({ effect, reason: "visitor_forbidden" });
            continue;
          }
          if (paused) {
            skipped.push({ effect, reason: "navigate_rejected" });
            continue;
          }
          if (dispatch.afterSectionContinue) dispatch.afterSectionContinue();
          break;
        case "set_presentation_status":
          skipped.push({ effect, reason: "presentation_status_not_wired" });
          break;
        case "navigate": {
          if (!moderator) {
            skipped.push({ effect, reason: "visitor_forbidden" });
            continue;
          }
          if (paused) {
            skipped.push({ effect, reason: "navigate_rejected" });
            continue;
          }
          const target = clampStep(effect.targetStep);
          if (navigated || target === posAfter) {
            skipped.push({ effect, reason: "navigate_rejected" });
            continue;
          }
          if (dispatch.moveModerator(target)) {
            navigated = true;
            posAfter = target;
          } else skipped.push({ effect, reason: "navigate_rejected" });
          break;
        }
        default:
          skipped.push({ effect, reason: "unsupported_kind" });
      }
    }

    return {
      posBefore,
      posAfter,
      navigated,
      highlight,
      narrationIntents,
      skipped,
    };
  }

  window.CatchPresentationEffects = {
    normalizePresentationEffects,
    applyPresentationEffects,
  };
})();
