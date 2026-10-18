/**
 * Identidad del visitante (nombre + UUID) y API de reunión.
 * Se carga en el shell del monitor (cliente / móvil).
 */
(function () {
  const cfg = window.__CATCH_MONITOR_SYNC__;
  if (!cfg?.meetingId) return;
  const role = cfg.role || "cliente";
  if (role === "moderador") return;

  const meetingId = cfg.meetingId;
  const actorKey = "catch:" + meetingId + ":actor";
  const ptKey = "catch:" + meetingId + ":pt";
  const attemptKey = "catch:" + meetingId + ":registerAttempt";

  function readActor() {
    try {
      const raw = localStorage.getItem(actorKey);
      if (!raw) return null;
      const o = JSON.parse(raw);
      if (o && o.id && o.name && String(o.name).trim()) return o;
    } catch {
      /* ignore */
    }
    return null;
  }

  function newParticipantId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return "m-" + Math.random().toString(36).slice(2, 11) + "-" + Date.now().toString(36);
  }

  function readAttempt() {
    try {
      const raw = localStorage.getItem(attemptKey);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function writeAttempt(attempt) {
    try {
      localStorage.setItem(attemptKey, JSON.stringify(attempt));
    } catch {
      /* ignore */
    }
  }

  function writeSession(actor, token) {
    try {
      localStorage.setItem(actorKey, JSON.stringify(actor));
      localStorage.setItem(ptKey, token);
      localStorage.removeItem(attemptKey);
    } catch {
      /* ignore */
    }
  }

  function getParticipantId() {
    const actor = readActor();
    return actor && actor.id ? actor.id : null;
  }

  async function registerViaParticipantToken(name, participantId, existingToken) {
    const res = await fetch(
      "/api/meeting/" + encodeURIComponent(meetingId) + "/participant-token",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId,
          existingToken: existingToken || undefined,
        }),
      },
    );
    const data = await res.json().catch(function () { return {}; });
    if (!res.ok || !data.token) {
      return { ok: false, error: data.error || "No se pudo registrar su ingreso." };
    }
    const actor = { id: data.participantId || participantId, name: name };
    writeSession(actor, data.token);
    return { ok: true, actor: actor, token: data.token };
  }

  async function registerVisitor(displayName) {
    const name = String(displayName || "").trim();
    if (!name) return { ok: false, error: "Escriba su nombre para continuar." };
    const prior = readAttempt();
    const participantId =
      prior && prior.displayName === name ? prior.participantId : newParticipantId();
    writeAttempt({ participantId, displayName: name });
    let existingToken = "";
    try {
      existingToken = localStorage.getItem(ptKey) || "";
    } catch {
      existingToken = "";
    }
    try {
      const res = await fetch(
        "/api/meeting/" + encodeURIComponent(meetingId) + "/visitor-register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: name,
            participantId,
            existingToken: existingToken || undefined,
          }),
        },
      );
      const data = await res.json().catch(function () { return {}; });
      if (res.ok && data.token) {
        const actor = {
          id: data.participantId || participantId,
          name: data.displayName || name,
        };
        writeSession(actor, data.token);
        return { ok: true, actor: actor, token: data.token };
      }
      if (res.status === 404 || res.status >= 500) {
        return registerViaParticipantToken(name, participantId, existingToken);
      }
      return { ok: false, error: data.error || "No se pudo registrar su ingreso." };
    } catch {
      try {
        return await registerViaParticipantToken(name, participantId, existingToken);
      } catch {
        return { ok: false, error: "Error de conexión. Intente de nuevo." };
      }
    }
  }

  async function ensureToken() {
    const actor = readActor();
    if (!actor?.id) return { participantId: null, token: null };
    let existing = "";
    try {
      existing = localStorage.getItem(ptKey) || "";
    } catch {
      existing = "";
    }
    if (existing) return { participantId: actor.id, token: existing };
    const reg = await registerVisitor(actor.name);
    if (!reg.ok) return { participantId: actor.id, token: null };
    return { participantId: actor.id, token: reg.token };
  }

  async function postClarityVote(sectionKey, vote) {
    const { participantId } = await ensureToken();
    if (!participantId) return false;
    const res = await fetch("/api/meeting/" + encodeURIComponent(meetingId) + "/clarity", {
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
    if (!token || !participantId) return { ok: false };
    try {
      const res = await fetch(
        "/api/meeting/" + encodeURIComponent(meetingId) + "/questions",
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

  const SESSION_KEY = "catch:analytics:session:" + meetingId;
  const queue = [];
  let flushTimer = null;

  function sessionId() {
    try {
      let id = sessionStorage.getItem(SESSION_KEY);
      if (!id) {
        id = "sess-" + (crypto.randomUUID ? crypto.randomUUID() : Date.now());
        sessionStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch {
      return "sess-html-" + Date.now();
    }
  }

  function excerpt(text, max) {
    const t = String(text || "").trim();
    if (t.length <= max) return t;
    return t.slice(0, max - 1) + "…";
  }

  async function flushQueue() {
    if (!queue.length) return;
    const { participantId, token } = await ensureToken();
    if (!participantId || !token) return;
    const events = queue.splice(0, queue.length);
    try {
      const res = await fetch("/api/meeting/" + encodeURIComponent(meetingId) + "/analytics/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-participant-id": participantId,
          "x-participant-token": token,
        },
        body: JSON.stringify({
          events,
          participant_token: token,
          participant_id: participantId,
        }),
        keepalive: true,
      });
      if (!res.ok) queue.unshift.apply(queue, events);
    } catch {
      queue.unshift.apply(queue, events);
    }
  }

  function track(eventType, fields) {
    const actor = readActor();
    if (!actor?.id) return;
    const meta = Object.assign({}, fields && fields.metadata ? fields.metadata : {});
    queue.push({
      client_event_id: "evt-" + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random()),
      meeting_id: meetingId,
      session_id: sessionId(),
      participant_id: actor.id,
      participant_role: "visitor",
      event_type: eventType,
      chart_id: (fields && fields.chart_id) || null,
      chart_type: (fields && fields.chart_type) || null,
      element_id: (fields && fields.element_id) || null,
      element_label: (fields && fields.element_label) || null,
      action: (fields && fields.action) || null,
      metadata: meta,
      schema_version: "1.0",
      timestamp: new Date().toISOString(),
    });
    const urgent = eventType === "session.join" || eventType === "session.leave"
      || eventType === "question.asked" || eventType === "question.answered"
      || eventType === "element.clicked" || String(eventType).indexOf("presentation.") === 0;
    if (urgent || queue.length >= 8) void flushQueue();
    else if (!flushTimer) {
      flushTimer = setTimeout(() => {
        flushTimer = null;
        void flushQueue();
      }, 1200);
    }
  }

  function trackFromTouch(tipo, detalle, seccion, sectionName) {
    const meta = {
      section_name: sectionName || null,
      section_index: seccion,
      detail: String(detalle || "").slice(0, 180),
    };
    if (tipo === "ia") {
      track("question.asked", { metadata: Object.assign({ question_text: excerpt(detalle, 240) }, meta) });
      return;
    }
    if (tipo === "grafico") {
      track("element.clicked", { chart_id: String(detalle || ""), element_label: String(detalle || ""), metadata: meta });
      return;
    }
    if (tipo === "filtro") {
      track("filter.changed", { metadata: meta });
      return;
    }
    if (tipo === "seccion") {
      track("presentation.section_selected", { metadata: meta });
      return;
    }
    if (tipo === "explorar") {
      track("explore.started", { metadata: meta });
      return;
    }
    if (tipo === "vista") {
      track("chart_type.changed", { metadata: meta });
      return;
    }
    track("detail.opened", { metadata: meta });
  }

  let sessionTrackingStarted = false;
  function startSessionTracking() {
    const actor = readActor();
    if (!actor?.id || sessionTrackingStarted) return;
    sessionTrackingStarted = true;
    track("session.join", { metadata: { role: "visitor", display_name: actor.name } });
    window.setInterval(() => {
      track("session.heartbeat", { metadata: { display_name: actor.name } });
    }, 20000);
    window.addEventListener("pagehide", () => {
      track("session.leave", { metadata: { display_name: actor.name } });
      void flushQueue();
    });
  }

  const prevRegister = registerVisitor;
  registerVisitor = async function (displayName) {
    const res = await prevRegister(displayName);
    if (res.ok) startSessionTracking();
    return res;
  };

  if (readActor()) startSessionTracking();

  window.__CATCH_MONITOR_API__ = {
    meetingId,
    readActor,
    registerVisitor,
    getParticipantId,
    ensureToken,
    postClarityVote,
    postQueueRequest,
    track,
    trackFromTouch,
    flushAnalytics: flushQueue,
  };

  try {
    window.dispatchEvent(new CustomEvent("catch-monitor-api-ready"));
  } catch {
    /* ignore */
  }
})();
