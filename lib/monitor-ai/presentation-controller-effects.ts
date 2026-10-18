import { buildMonitorPasos } from "@/lib/meeting/monitor-pasos";
import { evaluateNarrationAdvanceGate } from "@/lib/meeting/monitor-narration-gate";
import type { MonitorAiAction } from "./types";
import type { PresentationExecutableEffect } from "./action-contract";

export type ControllerEffectSkipReason =
  | "visitor_forbidden"
  | "invalid_effect_shape"
  | "presentation_status_not_wired"
  | "unsupported_kind"
  | "navigate_rejected";

export type SkippedEffect = {
  effect: PresentationExecutableEffect;
  reason: ControllerEffectSkipReason;
};

export type PresentationEffectDispatch = {
  moveModerator(target: number): boolean;
  afterSectionContinue?(): void;
  onNarration?(intent: "explain" | "repeat" | "ask_questions"): void;
};

export type PresentationEffectApplyResult = {
  posBefore: number;
  posAfter: number;
  navigated: boolean;
  highlight: MonitorAiAction | null;
  narrationIntents: Array<"explain" | "repeat" | "ask_questions">;
  skipped: SkippedEffect[];
};

export type PresentationEffectContext = {
  role: string;
  stepIndex: number;
  stepCount?: number;
  presentationStatus?: "live" | "paused";
};

function isModeratorRole(role: string): boolean {
  return role === "moderador";
}

function clampStep(target: number, stepCount: number): number {
  const max = Math.max(0, stepCount - 1);
  return Math.max(0, Math.min(max, Math.trunc(target)));
}

/** Sanitiza el payload `effects` del endpoint antes de tocar el controlador. */
export function normalizePresentationEffects(raw: unknown): PresentationExecutableEffect[] {
  if (!Array.isArray(raw)) return [];
  const out: PresentationExecutableEffect[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const kind = (item as { kind?: string }).kind;
    switch (kind) {
      case "monitor_highlight": {
        const action = (item as { action?: unknown }).action;
        if (!action || typeof action !== "object") continue;
        const type = (action as { type?: string }).type;
        if (type !== "highlight" && type !== "clear_highlight") continue;
        out.push({ kind: "monitor_highlight", action: action as MonitorAiAction });
        break;
      }
      case "navigate": {
        const targetStep = (item as { targetStep?: unknown }).targetStep;
        if (!Number.isInteger(targetStep)) continue;
        out.push({ kind: "navigate", targetStep: targetStep as number });
        break;
      }
      case "set_presentation_status": {
        const status = (item as { status?: unknown }).status;
        if (status !== "live" && status !== "paused") continue;
        out.push({ kind: "set_presentation_status", status });
        break;
      }
      case "narration": {
        const intent = (item as { intent?: unknown }).intent;
        if (intent !== "explain" && intent !== "repeat" && intent !== "ask_questions") continue;
        out.push({ kind: "narration", intent });
        break;
      }
      case "section_continue":
        out.push({ kind: "section_continue" });
        break;
      default:
        break;
    }
  }
  return out;
}

/**
 * Aplica efectos ya validados en servidor a través del controlador (nunca escribe S.pos directamente).
 * El rol debe provenir del controlador / auth, no de la IA.
 */
export function applyPresentationEffects(
  effects: PresentationExecutableEffect[],
  ctx: PresentationEffectContext,
  dispatch: PresentationEffectDispatch,
): PresentationEffectApplyResult {
  const stepCount = ctx.stepCount ?? buildMonitorPasos().length;
  const posBefore = ctx.stepIndex;
  let posAfter = ctx.stepIndex;
  let navigated = false;
  let highlight: MonitorAiAction | null = null;
  const narrationIntents: Array<"explain" | "repeat" | "ask_questions"> = [];
  const skipped: SkippedEffect[] = [];
  const moderator = isModeratorRole(ctx.role);
  const paused = ctx.presentationStatus === "paused";
  const hasNavigate = effects.some((e) => e.kind === "navigate");

  for (const effect of effects) {
    switch (effect.kind) {
      case "monitor_highlight":
        highlight = effect.action;
        break;
      case "narration":
        if (hasNavigate && moderator) {
          break;
        }
        narrationIntents.push(effect.intent);
        dispatch.onNarration?.(effect.intent);
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
        dispatch.afterSectionContinue?.();
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
        const target = clampStep(effect.targetStep, stepCount);
        if (navigated || target === posAfter) {
          skipped.push({ effect, reason: "navigate_rejected" });
          continue;
        }
        const moved = dispatch.moveModerator(target);
        if (moved) {
          navigated = true;
          posAfter = target;
        } else skipped.push({ effect, reason: "navigate_rejected" });
        break;
      }
      default:
        skipped.push({
          effect: effect as PresentationExecutableEffect,
          reason: "unsupported_kind",
        });
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

/** Posición tras navegar (simulación / pruebas cuando moveModerator actualiza estado externo). */
export function posAfterPresentationEffects(
  stepIndex: number,
  effects: PresentationExecutableEffect[],
  stepCount?: number,
): number {
  const count = stepCount ?? buildMonitorPasos().length;
  let pos = stepIndex;
  for (const effect of effects) {
    if (effect.kind === "navigate" && Number.isInteger(effect.targetStep)) {
      pos = clampStep(effect.targetStep, count);
    }
  }
  return pos;
}

/** La narración no puede avanzar desde hoja; el moderador sí (control manual / next_slide validado). */
export function narrationMayAdvanceFromStep(stepIndex: number, role: string): boolean {
  const gate = evaluateNarrationAdvanceGate({
    stepIndex,
    role: role === "moderador" ? "moderador" : "visitor",
    intent: "narration",
  });
  return gate.mayAdvance;
}
