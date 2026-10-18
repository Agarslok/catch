/**
 * Reproductor de segmentos de narración (espejo de lib/meeting/monitor-narration-cues.ts).
 * El highlight no se aplica aquí: solo se devuelve cuando la réplica de ese segmento empieza.
 */
(function () {
  function createPlayback(execId, stepIndex, segments) {
    return {
      execId,
      stepIndex,
      segments: Array.isArray(segments) ? segments : [],
      cursor: -1,
      status: "idle",
      heardStart: false,
      highlightAppliedFor: -1,
    };
  }

  function dispatchNext(playback) {
    if (!playback || playback.status === "cancelled" || playback.status === "done") return null;
    const next = playback.cursor + 1;
    if (next >= playback.segments.length) {
      playback.status = "done";
      return null;
    }
    const segment = playback.segments[next];
    const text = segment && typeof segment.text === "string" ? segment.text.trim() : "";
    if (!text) {
      playback.status = "done";
      return null;
    }
    playback.cursor = next;
    playback.status = "speaking";
    playback.heardStart = false;
    return {
      echoId: playback.execId + "-seg-" + next,
      text,
      segmentIndex: next,
    };
  }

  function start(playback) {
    if (!playback || playback.cursor >= 0 || playback.status === "cancelled") return null;
    return dispatchNext(playback);
  }

  function onReplicaStopped(playback) {
    if (!playback || playback.status !== "speaking" || !playback.heardStart) return null;
    return dispatchNext(playback);
  }

  function onReplicaStarted(playback) {
    if (!playback || playback.status !== "speaking" || playback.cursor < 0) return null;
    playback.heardStart = true;
    if (playback.highlightAppliedFor === playback.cursor) return null;
    const segment = playback.segments[playback.cursor];
    if (!segment || !segment.highlight) return null;
    playback.highlightAppliedFor = playback.cursor;
    return segment.highlight;
  }

  function cancel(playback) {
    if (!playback) return;
    playback.status = "cancelled";
  }

  window.CatchNarrationCues = {
    createPlayback,
    start,
    onReplicaStopped,
    onReplicaStarted,
    cancel,
  };
})();
