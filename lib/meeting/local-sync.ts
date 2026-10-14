const channelName = "catch-live";

export type LocalSyncMessage =
  | { type: "step"; s: number; max: number }
  | { type: "q" };

export function getLocalStepKeys(meetingId: string) {
  const p = `catch:${meetingId}:`;
  return {
    step: `${p}step`,
    max: `${p}max`,
    questions: `${p}questions`,
  };
}

export function readLocalStep(meetingId: string, totalSteps: number): number {
  if (typeof window === "undefined") return 0;
  const { step } = getLocalStepKeys(meetingId);
  try {
    const v = parseInt(localStorage.getItem(step) ?? "0", 10);
    if (Number.isNaN(v)) return 0;
    return Math.min(totalSteps - 1, Math.max(0, v));
  } catch {
    return 0;
  }
}

export function readLocalMax(meetingId: string, totalSteps: number): number {
  if (typeof window === "undefined") return 0;
  const { max } = getLocalStepKeys(meetingId);
  try {
    const v = parseInt(localStorage.getItem(max) ?? "0", 10);
    if (Number.isNaN(v)) return 0;
    return Math.min(totalSteps - 1, Math.max(0, v));
  } catch {
    return 0;
  }
}

export function writeLocalStep(
  meetingId: string,
  step: number,
  unlocked: number,
): void {
  if (typeof window === "undefined") return;
  const { step: kStep, max: kMax } = getLocalStepKeys(meetingId);
  try {
    localStorage.setItem(kStep, String(step));
    localStorage.setItem(kMax, String(unlocked));
  } catch {
    /* ignore */
  }
}

export function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
    return null;
  }
  return new BroadcastChannel(channelName);
}
