/**
 * Identidad anónima del participante y registro de claridad vía API de reunión.
 * Se carga en el shell del monitor (cliente / móvil).
 */
(function () {
  const cfg = window.__CATCH_MONITOR_SYNC__;
  if (!cfg?.meetingId) return;
  const role = cfg.role || "cliente";
  if (role === "moderador") return;

  const meetingId = cfg.meetingId;
  const pidKey = `catch:monitor:${meetingId}:participantId`;
  const ptKey = `catch:monitor:${meetingId}:participantToken`;

  function getParticipantId() {
    try {
      let id = localStorage.getItem(pidKey);
      if (!id) {
        id = `m-${Math.random().toString(36).slice(2, 11)}`;
        localStorage.setItem(pidKey, id);
      }
      return id;
    } catch {
      return `m-${Date.now().toString(36)}`;
    }
  }

  async function ensureToken() {
    const participantId = getParticipantId();
    let existing = "";
    try {
      existing = localStorage.getItem(ptKey) || "";
    } catch {
      existing = "";
    }
    try {
      const res = await fetch(
        `/api/meeting/${encodeURIComponent(meetingId)}/participant-token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ participantId, existingToken: existing }),
        },
      );
      if (!res.ok) return { participantId, token: null };
      const data = await res.json();
      if (data.token) {
        try {
          localStorage.setItem(ptKey, data.token);
        } catch {
          /* ignore */
        }
        return { participantId, token: data.token };
      }
    } catch {
      /* ignore */
    }
    return { participantId, token: null };
  }

  async function postClarityVote(sectionKey, vote) {
    const { participantId } = await ensureToken();
    const res = await fetch(`/api/meeting/${encodeURIComponent(meetingId)}/clarity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participantId,
        sectionKey,
        vote,
      }),
    });
    return res.ok;
  }

  async function postQueueRequest(payload) {
    const { token, participantId } = await ensureToken();
    if (!token) return { ok: false };
    try {
      const res = await fetch(
        `/api/meeting/${encodeURIComponent(meetingId)}/questions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            participantId,
            participantToken: token,
            text: payload.text,
            sectionKey: payload.sectionKey ?? "general",
            sectionLabel: payload.sectionLabel ?? "General",
            presentationPointId: payload.presentationPointId,
            requestKind: payload.requestKind ?? "written_question",
            source: payload.source ?? "monitor_html",
            idempotencyKey: payload.idempotencyKey,
          }),
        },
      );
      if (!res.ok) return { ok: false };
      const data = await res.json();
      return { ok: true, question: data.question, duplicate: data.duplicate };
    } catch {
      return { ok: false };
    }
  }

  window.__CATCH_MONITOR_API__ = {
    meetingId,
    getParticipantId,
    ensureToken,
    postClarityVote,
    postQueueRequest,
  };
})();
