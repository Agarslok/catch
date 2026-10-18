import type { MonitorChartElementRef } from "@/lib/monitor-ai/types";
import { getDemoClientId } from "@/lib/monitor-data/dataset";

/**
 * Sincronización narración ↔ highlight.
 *
 * Tavus/Daily no entrega marcas por palabra ni por frase dentro de un echo.
 * La única señal real es el borde de réplica (`started_speaking` / `stopped_speaking`).
 * Por eso cada hallazgo es un segmento propio: el highlight se activa al
 * `started_speaking` de ESE segmento, no al entrar a la diapositiva ni con un
 * temporizador estimado a partir del texto.
 *
 * Precisión real: inicio del enunciado del hallazgo (no palabra ni milisegundo).
 */

export type NarrationCueSegment = {
  id: string;
  text: string;
  /** Se activa al started_speaking de este segmento. null = sin highlight. */
  highlight: MonitorChartElementRef | null;
};

export type NarrationPlaybackStatus = "idle" | "speaking" | "done" | "cancelled";

export type NarrationPlayback = {
  execId: string;
  stepIndex: number;
  segments: NarrationCueSegment[];
  cursor: number;
  status: NarrationPlaybackStatus;
  heardStart: boolean;
  highlightAppliedFor: number;
};

export function spokenHighlightLabel(ref: MonitorChartElementRef): string {
  const category = ref.category?.trim() || "";
  if (!category) return "este dato";
  if (category === getDemoClientId()) return "su empresa";
  return category;
}

export function findingCueText(ref: MonitorChartElementRef, index: number): string {
  const label = spokenHighlightLabel(ref);
  if (index === 0) {
    return `Fíjate en ${label}: es el dato que señalo ahora en la gráfica.`;
  }
  return `Ahora fíjate en ${label}: también lo señalo en la gráfica.`;
}

/** El primer segmento es contexto, sin highlight. Cada hallazgo va después. */
export function buildNarrationCueSegments(
  speakText: string | null | undefined,
  highlights: Array<MonitorChartElementRef | null | undefined>,
): NarrationCueSegment[] {
  const lead = typeof speakText === "string" ? speakText.trim() : "";
  const cues = highlights.filter((h): h is MonitorChartElementRef => !!h?.chartId);
  if (!lead && !cues.length) return [];
  const segments: NarrationCueSegment[] = [];
  if (lead) {
    segments.push({ id: "lead", text: lead, highlight: null });
  }
  cues.forEach((ref, i) => {
    segments.push({
      id: `cue-${i}`,
      text: findingCueText(ref, i),
      highlight: ref,
    });
  });
  if (!segments.length) return [];
  if (!lead && segments[0]) {
    segments[0] = { ...segments[0], id: "cue-0" };
  }
  return segments;
}

export function createNarrationPlayback(
  execId: string,
  stepIndex: number,
  segments: NarrationCueSegment[],
): NarrationPlayback {
  return {
    execId,
    stepIndex,
    segments,
    cursor: -1,
    status: "idle",
    heardStart: false,
    highlightAppliedFor: -1,
  };
}

export type NarrationSegmentDispatch = {
  echoId: string;
  text: string;
  segmentIndex: number;
};

function dispatchNext(playback: NarrationPlayback): NarrationSegmentDispatch | null {
  if (playback.status === "cancelled" || playback.status === "done") return null;
  const next = playback.cursor + 1;
  if (next >= playback.segments.length) {
    playback.status = "done";
    return null;
  }
  const segment = playback.segments[next];
  if (!segment?.text?.trim()) {
    playback.status = "done";
    return null;
  }
  playback.cursor = next;
  playback.status = "speaking";
  playback.heardStart = false;
  return {
    echoId: `${playback.execId}-seg-${next}`,
    text: segment.text.trim(),
    segmentIndex: next,
  };
}

/** Primer enunciado al entrar al paso. No incluye highlight. */
export function startNarrationPlayback(
  playback: NarrationPlayback,
): NarrationSegmentDispatch | null {
  if (playback.cursor >= 0 || playback.status === "cancelled") return null;
  return dispatchNext(playback);
}

/**
 * Ignora un fin de réplica si esa réplica nunca avisó que empezó
 * (evita adelantar el hallazgo por un stopped espurio).
 */
export function onNarrationReplicaStopped(
  playback: NarrationPlayback,
): NarrationSegmentDispatch | null {
  if (playback.status !== "speaking" || !playback.heardStart) return null;
  return dispatchNext(playback);
}

/** Highlight del segmento que acaba de empezar a hablarse. Una sola vez. */
export function onNarrationReplicaStarted(
  playback: NarrationPlayback,
): MonitorChartElementRef | null {
  if (playback.status !== "speaking" || playback.cursor < 0) return null;
  playback.heardStart = true;
  if (playback.highlightAppliedFor === playback.cursor) return null;
  const segment = playback.segments[playback.cursor];
  if (!segment?.highlight) return null;
  playback.highlightAppliedFor = playback.cursor;
  return segment.highlight;
}

export function cancelNarrationPlayback(playback: NarrationPlayback | null | undefined): void {
  if (!playback) return;
  playback.status = "cancelled";
}
