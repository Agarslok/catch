import type { MonitorNarrationPlan } from "./monitor-narration-plan";

export type PlanNarrationEchoSkipReason =
  | "empty_speak_text"
  | "invalid_plan";

export type PlanNarrationEchoReady = {
  ok: true;
  text: string;
  echoId: string;
  stepIndex: number;
};

export type PlanNarrationEchoSkipped = {
  ok: false;
  reason: PlanNarrationEchoSkipReason;
  stepIndex: number;
};

/** Id estable por paso: `speakEcho` ignora reenvíos con el mismo echoId. */
export function planNarrationEchoId(stepIndex: number): string {
  return `plan-narr-${stepIndex}`;
}

/**
 * Prepara texto del plan para conversation.echo (sin Tavus ni DOM).
 * No avanza pasos ni muta estado de reunión.
 */
export function preparePlanNarrationEcho(
  plan: MonitorNarrationPlan | null | undefined,
  stepIndex: number,
): PlanNarrationEchoReady | PlanNarrationEchoSkipped {
  if (!plan || typeof plan.speakText !== "string") {
    return { ok: false, reason: "invalid_plan", stepIndex };
  }
  const text = plan.speakText.trim();
  if (!text) {
    return { ok: false, reason: "empty_speak_text", stepIndex };
  }
  return {
    ok: true,
    text,
    echoId: planNarrationEchoId(stepIndex),
    stepIndex,
  };
}
