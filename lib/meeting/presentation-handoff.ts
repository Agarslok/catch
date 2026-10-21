import type { ScriptPoint } from "./script-types";

export const PRESENTATION_HANDOFF_HEADLINE = "Presentación finalizada";
export const PRESENTATION_HANDOFF_SUBLABEL = "Espacio de preguntas";
export const PRESENTATION_HANDOFF_NARRATIVE =
  "Sesión cerrada. Ahora cada empresa a su ritmo: 40 empresas y 35,128 empleados, mediana $340, rotación 8.1% (10.8% hace un año), 67% de las bajas antes del año, y 2026 entre 33% y 44%.";

export function isPresentationHandoffPoint(point: ScriptPoint | null | undefined): boolean {
  return point?.kind === "closing";
}

export type PresentationHandoffCycleState = {
  cycle: number;
  announcedCycle: number | null;
};

export function createHandoffCycleState(): PresentationHandoffCycleState {
  return { cycle: 0, announcedCycle: null };
}

/** Tras reiniciar la presentación desde el paso de cierre. */
export function bumpHandoffCycleOnRestart(
  state: PresentationHandoffCycleState,
): PresentationHandoffCycleState {
  return { cycle: state.cycle + 1, announcedCycle: state.announcedCycle };
}

export function markHandoffAnnounced(
  state: PresentationHandoffCycleState,
): PresentationHandoffCycleState {
  return { ...state, announcedCycle: state.cycle };
}

export function shouldAnnounceHandoff(
  state: PresentationHandoffCycleState,
  onHandoffPoint: boolean,
): { announce: boolean; state: PresentationHandoffCycleState } {
  if (!onHandoffPoint) {
    return { announce: false, state };
  }
  if (state.announcedCycle === state.cycle) {
    return { announce: false, state };
  }
  return { announce: true, state: markHandoffAnnounced(state) };
}

/** Permite volver a anunciar si el presentador retrocede y completa el recorrido otra vez. */
export function resetHandoffAnnouncementIfLeft(
  state: PresentationHandoffCycleState,
  wasOnHandoff: boolean,
  nowOnHandoff: boolean,
): PresentationHandoffCycleState {
  if (wasOnHandoff && !nowOnHandoff) {
    return { ...state, announcedCycle: null };
  }
  return state;
}
