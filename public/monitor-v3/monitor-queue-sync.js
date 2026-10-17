/**
 * Cola unificada del moderador vía API de reunión + Realtime (event_seq en meeting_state).
 */
(function () {
  const cfg = window.__CATCH_MONITOR_SYNC__;
  if (!cfg?.meetingId) return;

  const CHANNEL = "catch-live-v1";
  const bc = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL) : null;

  let lastEventSeq = -1;
  let fetchInFlight = false;

  function mapRow(row) {
    return {
      id: row.id,
      participantId: row.participant_id,
      kind: row.request_kind || "written_question",
      source: row.source || "unknown",
      texto: row.text || "",
      seccion: row.section_key,
      seccionNombre: row.section_label,
      ts: Date.parse(row.created_at) || Date.now(),
      status:
        row.status === "open"
          ? "pending"
          : row.status === "answered"
            ? "attended"
            : "dismissed",
      respuesta: row.answer_text || "",
    };
  }

  async function fetchQueue() {
    if (fetchInFlight) return;
    fetchInFlight = true;
    try {
      const headers = {};
      if (cfg.role === "moderador" && cfg.presenterToken) {
        headers["x-presenter-token"] = cfg.presenterToken;
      } else {
        return;
      }
      const res = await fetch(
        `/api/meeting/${encodeURIComponent(cfg.meetingId)}/questions`,
        { headers },
      );
      if (!res.ok) return;
      const data = await res.json();
      const items = (data.questions || []).map(mapRow);
      bc?.postMessage({ tipo: "cola", data: { items } });
    } catch {
      /* ignore */
    } finally {
      fetchInFlight = false;
    }
  }

  window.__CATCH_MONITOR_QUEUE__ = {
    refresh: fetchQueue,
    onEventSeq(seq) {
      if (typeof seq !== "number" || seq < 0) return;
      if (seq === lastEventSeq) return;
      lastEventSeq = seq;
      if (cfg.role === "moderador") void fetchQueue();
    },
    boot(seq) {
      if (typeof seq === "number") lastEventSeq = seq;
      if (cfg.role === "moderador") void fetchQueue();
    },
  };

  if (cfg.role === "moderador") {
    setInterval(() => void fetchQueue(), 12000);
  }
})();
