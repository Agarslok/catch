import {
  findSectionStartStep,
  MONITOR_PRESENTATION_ACTION_CONTRACT,
  type PresentationActionProposal,
  type PresentationControllerSnapshot,
  validateMonitorAiStructuredResponse,
} from "./action-contract";
import {
  MONITOR_SECTION_KEYS,
  isMonitorChartId,
  sectionKeyForIndex,
} from "./catalog";
import { extractHighlightHint, matchInstructionTargets } from "./interpret-context";
import { resolveModeratorNavInstruction } from "./nav-instruction";
import { buildMonitorPasos } from "@/lib/meeting/monitor-pasos";
import { planMonitorNarration } from "@/lib/meeting/monitor-narration-plan";
import type { MonitorChartId, MonitorSectionIndex } from "./types";

export type DirectInstructionResolution =
  | {
      kind: "actions";
      message: string;
      actions: PresentationActionProposal[];
      completion?: "complete" | "needs_confirmation";
    }
  | {
      kind: "jump";
      message: string;
      targetStep: number;
    }
  | {
      kind: "clarification";
      message: string;
      clarificationRequest: string;
    }
  | {
      kind: "unavailable";
      message: string;
      clarificationRequest: string;
    };

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function currentSectionIndex(stepIndex: number): MonitorSectionIndex | null {
  const paso = buildMonitorPasos()[stepIndex];
  if (!paso) return null;
  if (paso.tipo === "explica" || paso.tipo === "hoja") return paso.sectionIndex;
  if (paso.tipo === "cierre") {
    return (MONITOR_SECTION_KEYS.length - 1) as MonitorSectionIndex;
  }
  return null;
}

function wantsContinueSection(f: string): boolean {
  if (/\b(sigamos|seguir|seguimos)\b/.test(f) && /\b(presentacion|informe|seccion)\b/.test(f)) {
    return true;
  }
  if (/\b(continue|continua|continuar|continuemos)\b/.test(f)) {
    if (/\b(pregunta|respondimos|seccion|presentacion)\b/.test(f)) return true;
    if (/^(continue|continua|continuar|continuemos)$/.test(f)) return true;
  }
  if (/\b(termina|terminar|finaliza|finalizar)\b/.test(f) && /\b(explicacion|seccion)\b/.test(f)) {
    return true;
  }
  if (/\b(pasemos a la siguiente seccion|continua con la siguiente seccion)\b/.test(f)) {
    return true;
  }
  return false;
}

function wantsFinishPresentation(f: string): boolean {
  return (
    /\b(finaliza|finalizar|termina|terminar)\b/.test(f) &&
    /\b(presentacion|sesion|reunion)\b/.test(f)
  );
}

function wantsRepeat(f: string): boolean {
  if (/^(repite|repetir)$/.test(f)) return true;
  if (/\b(repite|repetir)\b/.test(f)) return true;
  if (/\b(vuelve|volver)\s+a\s+explicar\b/.test(f)) return true;
  return false;
}

function wantsAskQuestions(f: string): boolean {
  return (
    /\b(pregunta|preguntas)\b/.test(f) &&
    /\b(abiertas|invita|alguna|tienen)\b/.test(f) &&
    !/\b(continua|continuar|respondimos)\b/.test(f)
  );
}

function wantsExplainCurrent(f: string): boolean {
  if (/\b(siguiente)\b/.test(f) && /\b(grafica|grafico|chart)\b/.test(f)) return false;
  if (/\b(ve|ir|vamos|seccion|inicia|iniciar)\b/.test(f)) return false;
  return (
    /\b(explica|explicar|describe|desglosa)\b/.test(f) &&
    (/\b(esta|actual|grafica|grafico|diapositiva|punto)\b/.test(f) || f.startsWith("explica"))
  );
}

function wantsNextChart(f: string): boolean {
  return (
    /\b(siguiente|proxima|proximo)\b/.test(f) &&
    /\b(grafica|grafico|visualizacion|chart)\b/.test(f)
  );
}

function wantsPreviousSection(f: string): boolean {
  return (
    /\bseccion\b/.test(f) &&
    /\b(anterior|previa)\b/.test(f) &&
    /\b(regresa|regresar|vuelve|volver|retrocede|atras)\b/.test(f)
  );
}

function wantsNextSectionJump(f: string): boolean {
  if (wantsContinueSection(f)) return false;
  return /\bseccion\b/.test(f) && /\b(siguiente|proxima)\b/.test(f) && /\b(avanza|avanzar|ir|ve|vamos)\b/.test(f);
}

function wantsStartPresentation(f: string): boolean {
  if (/\b(vuelve|volver|regresa|regresar)\b/.test(f) && /\binicio\b/.test(f)) return false;
  if (/\b(inicia|iniciar|empezar|comenzar|arranca)\b/.test(f) && /\b(presentacion|sesion|informe)\b/.test(f)) {
    return true;
  }
  if (/\b(primera seccion|primer apartado)\b/.test(f)) return true;
  return false;
}

function wantsReturnToStart(f: string): boolean {
  return (
    /\b(vuelve|volver|regresa|regresar)\b/.test(f) &&
    /\b(inicio|principio|comienzo)\b/.test(f) &&
    !/\b(punto|paso|seccion|grafica)\b/.test(f)
  );
}

function wantsPauseOrResume(f: string): boolean {
  return /\b(pausa|pausar|reanuda|reanudar|resume)\b/.test(f) && /\b(presentacion|sesion|narracion|avatar)\b/.test(f);
}

function wantsHighlightInstruction(f: string): boolean {
  return /\b(resalt|destac|marca|senal|ilumina)\w*/.test(f);
}

function chartIdForDirectHighlight(
  snapshot?: PresentationControllerSnapshot,
): MonitorChartId | null {
  if (!snapshot) return null;
  const paso = buildMonitorPasos()[snapshot.stepIndex];
  if (paso?.tipo === "explica") return paso.chartId;
  const view = snapshot.view;
  if (view?.primaryChartId && isMonitorChartId(view.primaryChartId)) {
    return view.primaryChartId;
  }
  if (
    view?.visibleChartIds?.length === 1 &&
    isMonitorChartId(view.visibleChartIds[0])
  ) {
    return view.visibleChartIds[0];
  }
  return null;
}

function namedDestination(instruction: string): DirectInstructionResolution | null {
  const match = matchInstructionTargets(instruction);
  if (match.kind === "ambiguous") {
    const labels = match.options.map((o) => `${o.type === "section" ? "sección" : "gráfica"} «${o.label}»`).join("; ");
    return {
      kind: "clarification",
      message: "Hay varias coincidencias en el informe.",
      clarificationRequest: `Indique a cuál se refiere: ${labels}.`,
    };
  }
  if (match.kind === "not_found") {
    return {
      kind: "clarification",
      message: "No encontré ese destino en la presentación.",
      clarificationRequest:
        "Use una sección del catálogo (muestra, salarios, beneficios, indicadores o patrones) o el nombre de una gráfica existente.",
    };
  }
  if (match.kind === "section") {
    return {
      kind: "actions",
      message: `Vamos a la sección ${match.sectionKey}.`,
      actions: [{ type: "go_to_section", sectionKey: match.sectionKey }],
      completion: "complete",
    };
  }
  if (match.kind === "chart") {
    return {
      kind: "actions",
      message: `Mostramos la gráfica ${match.chartId}.`,
      actions: [{ type: "go_to_section", sectionKey: match.sectionKey, chartId: match.chartId }],
      completion: "complete",
    };
  }
  return null;
}

/**
 * Resuelve instrucciones del moderador sin llamar al modelo cuando la intención es inequívoca.
 * No concede permisos; solo propone acciones del contrato existente.
 */
export function resolveDirectModeratorInstruction(
  instruction: string,
  snapshot?: PresentationControllerSnapshot,
): DirectInstructionResolution | null {
  const f = fold(instruction);
  if (!f) return null;
  const stepIndex = snapshot?.stepIndex ?? 0;

  if (wantsPauseOrResume(f)) {
    return {
      kind: "unavailable",
      message: "La pausa o reanudación global de la presentación no forma parte de este flujo.",
      clarificationRequest:
        "Las preguntas se hacen al cierre de cada sección. Use «continúa» cuando corresponda autorizar el siguiente tramo.",
    };
  }

  const highlightHint = extractHighlightHint(instruction);
  if (highlightHint && wantsHighlightInstruction(f) && snapshot) {
    const chartId = chartIdForDirectHighlight(snapshot);
    if (chartId) {
      const actions: PresentationActionProposal[] = [
        { type: "highlight_element", chartId, category: highlightHint },
      ];
      const validated = validateMonitorAiStructuredResponse(
        {
          contract: MONITOR_PRESENTATION_ACTION_CONTRACT,
          message: `Resalto «${highlightHint}» en la gráfica actual.`,
          actions,
          completion: "complete",
        },
        { ...snapshot, view: undefined },
      );
      if (
        validated.ok &&
        validated.effects.some((e) => e.kind === "monitor_highlight")
      ) {
        return {
          kind: "actions",
          message: `Resalto «${highlightHint}» en la gráfica actual.`,
          actions,
          completion: "complete",
        };
      }
    }
  }

  if (/\bstart_presentation\b/.test(f) || (/\b(inicia|iniciar)\b/.test(f) && /\bdesde cero\b/.test(f))) {
    return {
      kind: "unavailable",
      message: "Iniciar la presentación desde cero (start_presentation) sigue pendiente de cableado.",
      clarificationRequest:
        "«Inicia la presentación» abre la primera sección (muestra). «Vuelve al inicio» regresa al paso inicial de la sesión.",
    };
  }

  if (wantsRepeat(f)) {
    const plan = planMonitorNarration(stepIndex);
    if (!plan.speakText?.trim()) {
      return {
        kind: "clarification",
        message: "No hay una explicación disponible para repetir en este punto.",
        clarificationRequest: "Avance a una diapositiva con narración o use el control Siguiente.",
      };
    }
    return {
      kind: "actions",
      message: "Repito la explicación del punto actual.",
      actions: [{ type: "repeat_explanation" }],
      completion: "complete",
    };
  }

  if (wantsContinueSection(f)) {
    return {
      kind: "actions",
      message: "Continuamos con el siguiente punto de la presentación.",
      actions: [{ type: "continue_section" }],
      completion: "complete",
    };
  }

  if (wantsFinishPresentation(f)) {
    return {
      kind: "actions",
      message: "Vamos al cierre de la presentación.",
      actions: [{ type: "finish_presentation" }],
      completion: "complete",
    };
  }

  if (wantsPreviousSection(f)) {
    const current = currentSectionIndex(stepIndex);
    if (current == null || current <= 0) {
      return {
        kind: "clarification",
        message: "No hay una sección anterior a la que regresar.",
        clarificationRequest: "Ya está al inicio del informe o fuera de una sección.",
      };
    }
    const prev = (current - 1) as MonitorSectionIndex;
    return {
      kind: "actions",
      message: `Regresamos a ${sectionKeyForIndex(prev)}.`,
      actions: [{ type: "go_to_section", sectionKey: sectionKeyForIndex(prev), sectionIndex: prev }],
      completion: "complete",
    };
  }

  if (wantsNextSectionJump(f)) {
    const current = currentSectionIndex(stepIndex);
    if (current == null) {
      return {
        kind: "actions",
        message: "Empezamos por la primera sección del informe.",
        actions: [{ type: "go_to_section", sectionKey: "muestra" }],
        completion: "complete",
      };
    }
    if (current >= MONITOR_SECTION_KEYS.length - 1) {
      return {
        kind: "clarification",
        message: "No hay una sección siguiente.",
        clarificationRequest: "Ya está en la última sección del informe.",
      };
    }
    const next = (current + 1) as MonitorSectionIndex;
    const start = findSectionStartStep(next);
    if (start < 0) {
      return {
        kind: "clarification",
        message: "No encontré el inicio de esa sección.",
        clarificationRequest: "Use el nombre de una sección del catálogo.",
      };
    }
    return {
      kind: "actions",
      message: `Avanzamos a ${sectionKeyForIndex(next)}.`,
      actions: [{ type: "go_to_section", sectionKey: sectionKeyForIndex(next), sectionIndex: next }],
      completion: "complete",
    };
  }

  if (wantsAskQuestions(f)) {
    return {
      kind: "actions",
      message: "Invito a preguntas sobre este punto.",
      actions: [{ type: "ask_for_questions" }],
      completion: "complete",
    };
  }

  if (wantsNextChart(f)) {
    return {
      kind: "actions",
      message: "Avanzamos a la siguiente gráfica.",
      actions: [{ type: "next_slide" }],
      completion: "complete",
    };
  }

  if (wantsExplainCurrent(f)) {
    return {
      kind: "actions",
      message: "Explico el punto actual.",
      actions: [{ type: "explain_slide" }],
      completion: "complete",
    };
  }

  if (wantsReturnToStart(f)) {
    return {
      kind: "jump",
      message: "Volvemos al inicio de la sesión.",
      targetStep: 0,
    };
  }

  if (wantsStartPresentation(f)) {
    return {
      kind: "actions",
      message: "Empezamos por la primera sección del informe.",
      actions: [{ type: "go_to_section", sectionKey: "muestra" }],
      completion: "complete",
    };
  }

  const nav = resolveModeratorNavInstruction(instruction);
  if (nav) {
    return {
      kind: "actions",
      message: nav === "next_slide" ? "Siguiente punto." : "Punto anterior.",
      actions: [{ type: nav }],
      completion: "complete",
    };
  }

  const named = namedDestination(instruction);
  if (named) return named;

  return null;
}
