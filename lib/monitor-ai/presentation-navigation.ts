import { buildMonitorPasos } from "@/lib/meeting/monitor-pasos";
import type { PresentationExecutableEffect } from "./action-contract";

/** Aplica efectos de navegación sobre un índice de paso (misma convención que S.pos / PASOS). */
export function stepAfterNavigateEffects(
  stepIndex: number,
  effects: PresentationExecutableEffect[],
): number {
  const max = buildMonitorPasos().length - 1;
  let pos = stepIndex;
  for (const effect of effects) {
    if (effect.kind === "navigate" && Number.isInteger(effect.targetStep)) {
      pos = effect.targetStep;
    }
  }
  return Math.max(0, Math.min(max, pos));
}
