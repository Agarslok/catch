export const MONITOR_SESSION_PHASES = [
  "preparacion",
  "generando_informe",
  "revision_previa",
  "listo_para_iniciar",
  "reunion_activa",
  "cierre",
] as const;

export type MonitorSessionPhase = (typeof MONITOR_SESSION_PHASES)[number];

export function isMonitorSessionPhase(v: unknown): v is MonitorSessionPhase {
  return (
    typeof v === "string" &&
    (MONITOR_SESSION_PHASES as readonly string[]).includes(v)
  );
}

/** Visitante ve la reunión solo en estos estados. */
export function visitorSeesMeeting(phase: MonitorSessionPhase): boolean {
  return phase === "reunion_activa" || phase === "cierre";
}

/** Presentador en revisión privada antes de iniciar (incluye alias legacy). */
export function presenterInPreMeetingReview(
  phase: MonitorSessionPhase,
): boolean {
  return phase === "revision_previa" || phase === "listo_para_iniciar";
}

/** Presentador ve el dashboard (guion lateral + vista previa), sin publicar al visitante. */
export function presenterSeesDashboard(phase: MonitorSessionPhase): boolean {
  return (
    presenterInPreMeetingReview(phase) ||
    phase === "reunion_activa" ||
    phase === "cierre"
  );
}

/** Presentador puede publicar pasos al visitante (sync remoto). */
export function presenterMayPublishSteps(phase: MonitorSessionPhase): boolean {
  return phase === "reunion_activa" || phase === "cierre";
}

/** @deprecated Use presenterMayPublishSteps for sync; presenterSeesDashboard for UI. */
export function presenterDashboardReady(phase: MonitorSessionPhase): boolean {
  return presenterMayPublishSteps(phase);
}

export function resolveInitialMonitorSessionPhase(
  stored: unknown,
  currentStep: number,
  unlockedStep: number,
): MonitorSessionPhase {
  if (stored === "listo_para_iniciar") return "revision_previa";
  if (isMonitorSessionPhase(stored)) return stored;
  if (currentStep > 0 || unlockedStep > 0) return "reunion_activa";
  return "preparacion";
}
