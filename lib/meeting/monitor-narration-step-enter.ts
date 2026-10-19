import type { MonitorAiAction, MonitorChartElementRef } from "@/lib/monitor-ai/types";
import { preparePlanNarrationEcho } from "./monitor-narration-echo";
import type { MonitorNarrationPlan } from "./monitor-narration-plan";
import {
  beginNarrationExecution,
  createNarrationExecutionId,
  isStaleNarrationCallback,
  type NarrationRuntimeState,
  type NarrationRuntimeStatus,
} from "./monitor-narration-runtime";

export type StepEnterSkipReason =
  | "duplicate_step_enter"
  | "plan_mismatch"
  | "no_plan"
  | "stale_exec";

export type StepEnterDecision = {
  skip: boolean;
  reason?: StepEnterSkipReason;
  stepIndex: number;
  execId: string;
  echoId: string;
  speak: boolean;
  speakText: string | null;
  highlightAction: MonitorAiAction | null;
  awaitingModerator: boolean;
  runtimeStatus: NarrationRuntimeStatus;
};

function highlightActionFromRef(
  ref: MonitorChartElementRef | null | undefined,
): MonitorAiAction | null {
  if (!ref?.chartId) return null;
  return {
    type: "highlight",
    target: {
      chartId: ref.chartId,
      category: ref.category,
      seriesKey: ref.seriesKey,
      datasetIndex: ref.datasetIndex,
      index: ref.index,
    },
  };
}

export function planMatchesActiveStep(
  plan: MonitorNarrationPlan | null | undefined,
  stepIndex: number,
): boolean {
  return !!plan && plan.stepIndex === stepIndex && Number.isInteger(stepIndex) && stepIndex >= 0;
}

/**
 * Decide narración + resaltado al entrar en un punto.
 * No avanza el paso. Un mismo (stepIndex, generation) no se reejecuta.
 */
export function decideStepEnter(input: {
  stepIndex: number;
  plan: MonitorNarrationPlan | null | undefined;
  generation: number;
  lastApplied?: { stepIndex: number; generation: number } | null;
  now?: number;
}): StepEnterDecision {
  const { stepIndex, plan, generation, lastApplied, now = Date.now() } = input;
  const execId = createNarrationExecutionId(stepIndex, now);
  const echoId = `plan-enter-${stepIndex}-${generation}`;

  if (lastApplied && lastApplied.stepIndex === stepIndex && lastApplied.generation === generation) {
    return {
      skip: true,
      reason: "duplicate_step_enter",
      stepIndex,
      execId,
      echoId,
      speak: false,
      speakText: null,
      highlightAction: null,
      awaitingModerator: false,
      runtimeStatus: "idle",
    };
  }

  if (!plan) {
    return {
      skip: true,
      reason: "no_plan",
      stepIndex,
      execId,
      echoId,
      speak: false,
      speakText: null,
      highlightAction: null,
      awaitingModerator: false,
      runtimeStatus: "idle",
    };
  }

  if (!planMatchesActiveStep(plan, stepIndex)) {
    return {
      skip: true,
      reason: "plan_mismatch",
      stepIndex,
      execId,
      echoId,
      speak: false,
      speakText: null,
      highlightAction: null,
      awaitingModerator: false,
      runtimeStatus: "idle",
    };
  }

  const echo = preparePlanNarrationEcho(plan, stepIndex);
  const speakText = echo.ok ? echo.text : null;
  const awaitingModerator = plan.blockAdvance === true;
  const highlightAction = highlightActionFromRef(plan.highlightRef);

  let runtimeStatus: NarrationRuntimeStatus = "idle";
  if (speakText) {
    runtimeStatus = awaitingModerator ? "awaiting_moderator" : "speaking";
  } else if (awaitingModerator) {
    runtimeStatus = "awaiting_moderator";
  }

  return {
    skip: false,
    stepIndex,
    execId,
    echoId,
    speak: !!speakText,
    speakText,
    highlightAction,
    awaitingModerator,
    runtimeStatus,
  };
}

export function applyStepEnterToRuntime(
  decision: StepEnterDecision,
): NarrationRuntimeState {
  if (decision.skip || !decision.speak) {
    return {
      execId: decision.execId,
      status: decision.runtimeStatus,
      stepIndex: decision.stepIndex,
      echoId: decision.echoId,
      startedAt: null,
      paused: false,
    };
  }
  const started = beginNarrationExecution(decision.stepIndex, decision.echoId, Date.now());
  return {
    ...started,
    execId: decision.execId,
    status: decision.runtimeStatus,
  };
}

export function shouldIgnoreStepEnterCallback(
  state: NarrationRuntimeState,
  execId: string | null | undefined,
): boolean {
  return isStaleNarrationCallback(state, execId);
}
