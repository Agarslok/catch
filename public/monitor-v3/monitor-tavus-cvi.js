/**
 * Tavus CVI + Daily para el Monitor HTML (Frida). Requiere daily-iframe.min.js antes de este script.
 * Presentador: crea/une la conversación y envía echo. Cliente/móvil: se une a la misma sala (solo recepción).
 */
(function () {
  const cfg = window.__CATCH_MONITOR_SYNC__;
  if (!cfg) return;

  const canControl = cfg.role === "moderador" && !!cfg.presenterToken;
  const isViewer = cfg.role === "cliente" || cfg.role === "movil";

  let configured = false;
  let status = "idle";
  let mode = "local";
  let errorMsg = "";
  let call = null;
  let conversationId = null;
  let starting = false;
  let lastEchoId = null;
  let joinedConversationUrl = null;
  let viewerJoinInFlight = false;
  let lastJoinCreds = null;
  let presenterPublishTimer = null;

  const bc =
    typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("catch-live-v1") : null;

  function errorMessageFromApiBody(data, fallback) {
    if (!data || typeof data !== "object") return fallback;
    const err = data.error;
    if (typeof err === "string" && err.trim()) return err.trim();
    if (err && typeof err === "object") {
      if (typeof err.message === "string" && err.message.trim()) return err.message.trim();
      try {
        const s = JSON.stringify(err);
        if (s && s !== "{}") return s;
      } catch {
        /* ignore */
      }
    }
    if (typeof data.message === "string" && data.message.trim()) return data.message.trim();
    return fallback;
  }

  function formatUnknownError(e, fallback) {
    if (e instanceof Error) {
      const m = e.message?.trim();
      if (m && m !== "[object Object]") return m;
    }
    if (e && typeof e === "object") {
      if (typeof e.errorMsg === "string" && e.errorMsg.trim()) return e.errorMsg.trim();
      if (typeof e.message === "string" && e.message.trim()) return e.message.trim();
      try {
        const s = JSON.stringify(e);
        if (s && s !== "{}") return s;
      } catch {
        /* ignore */
      }
    }
    if (typeof e === "string" && e.trim()) return e.trim();
    return fallback;
  }

  function dailyApi() {
    const D = window.DailyIframe;
    if (!D || typeof D.createCallObject !== "function") {
      throw new Error("Daily.js no está cargado. Recarga la página.");
    }
    return D;
  }

  function buildEcho(id, text) {
    return {
      message_type: "conversation",
      event_type: "conversation.echo",
      conversation_id: id,
      properties: { modality: "text", text, done: true },
    };
  }

  function buildInterrupt(id) {
    return {
      message_type: "conversation",
      event_type: "conversation.interrupt",
      conversation_id: id,
    };
  }

  function mp4Enabled() {
    return cfg.mp4Enabled === true;
  }

  function isConnected() {
    return status === "connected";
  }

  function statusText() {
    if (status === "starting") return isViewer ? "Conectando al avatar…" : "Iniciando sesión Tavus…";
    if (status === "connected") {
      return isViewer
        ? "Avatar en vivo · sincronizado con el presentador"
        : "Avatar conectado · voz de Gemini (sin micrófono a Tavus)";
    }
    if (status === "error") return errorMsg || "Error de conexión Tavus";
    if (status === "ended") return isViewer ? "Sesión del avatar finalizada" : "Sesión Tavus finalizada";
    if (mode === "tavus") return "Tavus";
    if (isViewer && configured) return "Esperando al avatar del presentador…";
    return mp4Enabled() ? "Video local (MP4)" : "Inicia sesión Tavus para ver a Frida";
  }

  function setHidden(el, hidden) {
    if (el && el.hidden !== hidden) el.hidden = hidden;
  }

  function readAvatarVolume() {
    try {
      const n = parseFloat(sessionStorage.getItem("catch-avatar-volume"));
      return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1;
    } catch {
      return 1;
    }
  }

  function applyVolumeToRemoteAudio() {
    const vol = readAvatarVolume();
    document.querySelectorAll("[data-tavus-remote-audio]").forEach((a) => {
      a.volume = vol;
    });
  }

  function remoteVideoEl() {
    return document.querySelector("[data-tavus-remote-video]");
  }

  function remoteAudioEl() {
    return document.querySelector("[data-tavus-remote-audio]");
  }

  function tryPlayRemoteMedia() {
    document.querySelectorAll("[data-tavus-remote-video]").forEach((el) => {
      if (!el.srcObject) return;
      el.hidden = false;
      el.muted = false;
      void el.play().catch(() => {});
    });
    const vol = readAvatarVolume();
    document.querySelectorAll("[data-tavus-remote-audio]").forEach((el) => {
      if (!el.srcObject) return;
      el.volume = vol;
      el.muted = false;
      void el.play().catch(() => {});
    });
    scheduleRefreshBars();
  }

  function attachRemoteTrack(track) {
    if (!track) return;
    if (track.kind === "video") {
      document.querySelectorAll("[data-tavus-remote-video]").forEach((el) => {
        el.srcObject = new MediaStream([track]);
        el.muted = false;
        el.hidden = false;
        void el.play().catch(() => {});
      });
      scheduleRefreshBars();
      return;
    }
    if (track.kind === "audio") {
      const vol = readAvatarVolume();
      document.querySelectorAll("[data-tavus-remote-audio]").forEach((el) => {
        el.srcObject = new MediaStream([track]);
        el.volume = vol;
        el.muted = false;
        void el.play().catch(() => {});
      });
    }
  }

  function syncRemoteMedia() {
    if (!call || status !== "connected") return;
    syncRemoteTracksNow(call);
    tryPlayRemoteMedia();
  }

  function wireCallObject(dailyCall) {
    dailyCall.on("track-started", (ev) => {
      if (!ev.participant || ev.participant.local || !ev.track) return;
      attachRemoteTrack(ev.track);
    });

    dailyCall.on("app-message", (ev) => {
      const data = ev && ev.data;
      if (!data || typeof data !== "object") return;
      const type = data.event_type || data.eventType || "";
      if (type === "conversation.replica.started_speaking") {
        try { window.__CATCH_NARRATION_ON_REPLICA_STARTED__?.(); } catch { /* ignore */ }
      } else if (type === "conversation.replica.stopped_speaking") {
        try { window.__CATCH_NARRATION_ON_REPLICA_IDLE__?.(); } catch { /* ignore */ }
      }
    });

    dailyCall.on("left-meeting", () => {
      status = "ended";
      mode = "local";
      joinedConversationUrl = null;
      scheduleRefreshBars();
    });

    dailyCall.on("error", (ev) => {
      errorMsg = formatUnknownError(ev, "Error en la llamada Daily");
      status = "error";
      mode = "local";
      joinedConversationUrl = null;
      scheduleRefreshBars();
    });
  }

  function syncRemoteTracksNow(dailyCall) {
    const participants = dailyCall.participants();
    Object.values(participants).forEach((p) => {
      if (!p || p.local) return;
      attachRemoteTrack(p.tracks?.video?.persistentTrack);
      attachRemoteTrack(p.tracks?.audio?.persistentTrack);
    });
  }

  async function joinDailyRoom(join) {
    const DailyIframe = dailyApi();
    if (!call) {
      call = DailyIframe.createCallObject({ subscribeToTracksAutomatically: true });
      wireCallObject(call);
    }

    await call.join({
      url: join.conversationUrl,
      ...(join.meetingToken ? { token: join.meetingToken } : {}),
      startVideoOff: true,
      startAudioOff: true,
    });

    try {
      await call.setLocalAudio(false);
    } catch {
      /* ignore */
    }

    syncRemoteTracksNow(call);
    joinedConversationUrl = join.conversationUrl;
    lastJoinCreds = join;
    status = "connected";
    mode = "tavus";
    scheduleRefreshBars();
    applyVolumeToRemoteAudio();
    tryPlayRemoteMedia();
    try {
      if (typeof window.__CATCH_ON_TAVUS_CONNECTED__ === "function") {
        window.__CATCH_ON_TAVUS_CONNECTED__();
      }
    } catch {
      /* ignore */
    }
    if (canControl) {
      if (presenterPublishTimer) clearInterval(presenterPublishTimer);
      presenterPublishTimer = setInterval(() => {
        if (isConnected() && lastJoinCreds) {
          void publishViewerSession(lastJoinCreds, conversationId);
        }
      }, 20000);
    }
  }

  async function publishViewerSession(join, convId) {
    if (!canControl || !cfg.presenterToken || !join?.conversationUrl) return;
    try {
      await fetch(`/api/monitor/${encodeURIComponent(cfg.meetingId)}/tavus-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-presenter-token": cfg.presenterToken,
        },
        body: JSON.stringify({
          status: "active",
          conversationUrl: join.conversationUrl,
          meetingToken: join.meetingToken ?? null,
          conversationId: convId || undefined,
        }),
      });
    } catch {
      /* ignore */
    }
  }

  function paintStatus() {
    const label = canControl || isViewer ? statusText() : "";
    const hideLocal = !mp4Enabled() || (mode === "tavus" && status === "connected");
    const showRemote = mode === "tavus" && (status === "connected" || status === "starting");
    document.querySelectorAll("[data-avatar-idle]").forEach((el) => {
      setHidden(el, showRemote || mp4Enabled());
    });
    document.querySelectorAll("[data-tavus-status]").forEach((el) => {
      if (el.textContent !== label) el.textContent = label;
    });
    document.querySelectorAll("[data-tavus-local-video]").forEach((v) => setHidden(v, hideLocal));
    document.querySelectorAll("[data-tavus-remote-video]").forEach((v) => setHidden(v, !showRemote));
    if (isViewer && showRemote) {
      document.querySelectorAll(".avatar-rail").forEach((el) => el.classList.add("avatar-rail--live"));
    }
  }

  async function detachCall() {
    joinedConversationUrl = null;
    lastJoinCreds = null;
    if (presenterPublishTimer) {
      clearInterval(presenterPublishTimer);
      presenterPublishTimer = null;
    }
    if (call) {
      try {
        await call.leave();
      } catch {
        /* ignore */
      }
      try {
        await call.destroy();
      } catch {
        /* ignore */
      }
      call = null;
    }
    conversationId = null;
    lastEchoId = null;
    document.querySelectorAll("[data-tavus-remote-video]").forEach((v) => {
      v.srcObject = null;
    });
    document.querySelectorAll("[data-tavus-remote-audio]").forEach((a) => {
      a.srcObject = null;
    });
  }

  async function endSession() {
    if (!canControl) return;
    const id = conversationId;
    await detachCall();
    if (id && canControl) {
      try {
        await fetch(`/api/tavus/conversation/${encodeURIComponent(id)}/end`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-presenter-token": cfg.presenterToken,
          },
          body: JSON.stringify({ meetingId: cfg.meetingId }),
        });
      } catch {
        /* ignore */
      }
    }
    status = "ended";
    mode = "local";
    errorMsg = "";
    scheduleRefreshBars();
  }

  async function provisionAndJoin(forceNew) {
    const res = await fetch("/api/tavus/conversation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-presenter-token": cfg.presenterToken,
      },
      body: JSON.stringify({
        meetingId: cfg.meetingId,
        conversationName: `catch-monitor-${cfg.meetingId}`,
        forceNew: forceNew === true,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(errorMessageFromApiBody(data, "No se pudo crear la conversación"));
    }

    conversationId = data.conversationId || conversationId;

    const join = {
      conversationUrl: data.conversationUrl,
      meetingToken: data.meetingToken || null,
    };
    await joinDailyRoom(join);
    await publishViewerSession(join, conversationId);
    return Boolean(data.reused);
  }

  async function startSession() {
    if (!canControl || starting || (call && isConnected())) return;
    if (!configured) {
      status = "error";
      errorMsg =
        errorMsg ||
        "Tavus no está configurado en este servidor. En Netlify haga falta TAVUS_API_KEY, TAVUS_REPLICA_ID y TAVUS_PERSONA_ID.";
      scheduleRefreshBars();
      return;
    }
    starting = true;
    status = "starting";
    mode = "tavus";
    errorMsg = "";
    scheduleRefreshBars();

    try {
      await provisionAndJoin(false);
    } catch (first) {
      await detachCall();
      try {
        await provisionAndJoin(true);
      } catch (second) {
        await detachCall();
        mode = "local";
        status = "error";
        errorMsg = formatUnknownError(second, "Error al conectar con Tavus");
        scheduleRefreshBars();
      }
    } finally {
      starting = false;
    }
  }

  function parseViewerSession(raw) {
    if (!raw || typeof raw !== "object") return null;
    if (raw.status === "ended") return { ended: true };
    if (raw.status !== "active" || typeof raw.conversationUrl !== "string" || !raw.conversationUrl.trim()) {
      return null;
    }
    return {
      ended: false,
      conversationUrl: raw.conversationUrl.trim(),
      meetingToken: raw.meetingToken || null,
      conversationId: raw.conversationId || null,
    };
  }

  async function applyViewerSession(raw) {
    if (!isViewer || !configured) return;
    if (!raw) return;
    const session = parseViewerSession(raw);
    if (!session) return;

    if (session.ended) {
      if (call || mode === "tavus") {
        await detachCall();
        status = "ended";
        mode = "local";
        scheduleRefreshBars();
      }
      return;
    }

    if (joinedConversationUrl === session.conversationUrl && isConnected()) return;
    if (viewerJoinInFlight) return;

    viewerJoinInFlight = true;
    status = "starting";
    mode = "tavus";
    errorMsg = "";
    scheduleRefreshBars();

    try {
      if (call && joinedConversationUrl !== session.conversationUrl) {
        await detachCall();
      }
      conversationId = session.conversationId || conversationId;
      await joinDailyRoom({
        conversationUrl: session.conversationUrl,
        meetingToken: session.meetingToken,
      });
      tryPlayRemoteMedia();
    } catch (e) {
      await detachCall();
      mode = "local";
      status = "error";
      errorMsg = formatUnknownError(e, "Error al conectar con Tavus");
      scheduleRefreshBars();
    } finally {
      viewerJoinInFlight = false;
    }
  }

  function interruptSpeech() {
    if (!canControl || !call || !conversationId || status !== "connected") return false;
    try {
      call.sendAppMessage(buildInterrupt(conversationId), "*");
      return true;
    } catch {
      return false;
    }
  }

  function speakEcho(text, echoId) {
    if (!canControl) return false;
    const t = String(text || "").trim();
    if (!call || !conversationId || !t || status !== "connected") return false;
    if (echoId && echoId === lastEchoId) return true;
    try {
      call.sendAppMessage(buildInterrupt(conversationId), "*");
    } catch {
      /* ignore */
    }
    try {
      call.sendAppMessage(buildEcho(conversationId, t), "*");
    } catch {
      return false;
    }
    if (echoId) lastEchoId = echoId;
    return true;
  }

  let refreshScheduled = false;
  function refreshBars() {
    const show = canControl;
    const showEnd = canControl && configured && (status === "connected" || status === "starting");
    const showStart = canControl && !showEnd;
    document.querySelectorAll("[data-tavus-bar]").forEach((el) => setHidden(el, !show));
    document.querySelectorAll("[data-tavus-end]").forEach((btn) => setHidden(btn, !showEnd));
    document.querySelectorAll("[data-tavus-start]").forEach((btn) => {
      setHidden(btn, !showStart);
      btn.disabled = starting || !configured;
      btn.setAttribute("aria-busy", starting ? "true" : "false");
      btn.textContent = starting
        ? "Iniciando…"
        : configured
          ? "Iniciar Frida (Tavus)"
          : "Tavus no configurado";
    });
    paintStatus();
  }

  function scheduleRefreshBars() {
    if (refreshScheduled) return;
    refreshScheduled = true;
    requestAnimationFrame(() => {
      refreshScheduled = false;
      refreshBars();
    });
  }

  function onTavusClick(e) {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const start = t.closest("[data-tavus-start]");
    const end = t.closest("[data-tavus-end]");
    if (!start && !end) return;
    e.preventDefault();
    e.stopPropagation();
    if (start) void startSession();
    if (end) void endSession();
  }

  async function fetchViewerSessionFromApi() {
    try {
      const res = await fetch(`/api/monitor/${encodeURIComponent(cfg.meetingId)}/tavus-session`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.session ?? null;
    } catch {
      return null;
    }
  }

  let viewerPollTimer = null;
  function startViewerPoll() {
    if (!isViewer || viewerPollTimer) return;
    viewerPollTimer = setInterval(() => {
      if (isConnected() || viewerJoinInFlight) return;
      void fetchViewerSessionFromApi().then((s) => {
        if (s) void applyViewerSession(s);
      });
    }, 6000);
  }

  function bindAutoplayUnlock() {
    if (!isViewer) return;
    const unlock = () => {
      tryPlayRemoteMedia();
    };
    document.addEventListener("pointerdown", unlock, { once: true, capture: true });
    document.addEventListener("keydown", unlock, { once: true, capture: true });
  }

  async function boot() {
    try {
      const res = await fetch("/api/tavus/conversation");
      const raw = await res.text();
      let data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        configured = false;
        status = "error";
        errorMsg = "No se pudo leer /api/tavus/conversation (respuesta no JSON).";
        scheduleRefreshBars();
        data = {};
      }
      configured = Boolean(data.configured);
      if (!configured && !errorMsg) {
        errorMsg =
          (typeof data.error === "string" && data.error.trim()) ||
          "Tavus no está configurado en el servidor.";
        status = "error";
      }
    } catch {
      configured = false;
      status = "error";
      errorMsg = "No se pudo contactar /api/tavus/conversation.";
    }

    window.__CATCH_TAVUS_CVI__ = {
      speakEcho,
      interrupt: interruptSpeech,
      refreshUi: scheduleRefreshBars,
      syncRemoteMedia,
      getStatus: () => status,
      isActive: () => isConnected(),
      isViewer: () => isViewer,
      applyViewerSession: (s) => void applyViewerSession(s),
    };

    document.addEventListener("click", onTavusClick, true);

    bc?.addEventListener("message", (ev) => {
      const msg = ev.data || {};
      if (msg.tipo === "tavusSession") {
        void applyViewerSession(msg.data);
      }
    });

    document.addEventListener("input", (e) => {
      if (e.target?.matches?.("[data-avatar-volume]")) applyVolumeToRemoteAudio();
    });

    scheduleRefreshBars();

    bindAutoplayUnlock();

    if (isViewer && configured) {
      const initial = await fetchViewerSessionFromApi();
      if (initial) await applyViewerSession(initial);
      startViewerPoll();
    }

    window.addEventListener("beforeunload", () => {
      void detachCall();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void boot());
  } else {
    void boot();
  }
})();
