/**
 * Puente entre el HTML del Monitor (BroadcastChannel catch-live-v1) y Supabase Realtime.
 * Se inyecta al servir /monitor/[meetingId]/shell; no modifica el HTML fuente.
 */
(function () {
  const cfg = window.__CATCH_MONITOR_SYNC__;
  if (!cfg || !cfg.meetingId) return;

  const CHANNEL = "catch-live-v1";
  const bc = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL) : null;

  let lastApplied = -1;
  let lastUnlocked = -1;
  let lastEventSeq = -1;
  let lastPublished = -1;
  let lastPublishedHighlight = "";
  let lastPublishedPhase = "";
  let publishInFlight = false;
  /** Último paso pendiente de publicar (evita perder avances rápidos mientras publishInFlight). */
  let pendingPublish = null;
  let highlightPublishInFlight = false;
  let phasePublishInFlight = false;
  let supabaseClient = null;
  let realtimeChannel = null;

  function setSyncLabel(html) {
    const el = document.getElementById("estadoSync");
    if (el) el.innerHTML = html;
  }

  function shouldApplyRemoteRow(row) {
    const seq = row && row.event_seq;
    if (typeof seq !== "number") return true;
    if (lastEventSeq < 0) return true;
    return seq > lastEventSeq;
  }

  function markRemoteRowApplied(row) {
    const seq = row && row.event_seq;
    if (typeof seq === "number") lastEventSeq = Math.max(lastEventSeq, seq);
  }

  function applySectionAwaitFromGlobalView(gv) {
    if (!gv || typeof gv.awaitingModerator !== "boolean") return;
    const data = {
      narracionEsperaAutorizacion: gv.awaitingModerator,
      sectionClaridadLista: gv.awaitingModerator,
    };
    try {
      window.dispatchEvent(new CustomEvent("catch-monitor-estado", { detail: data }));
    } catch {
      /* ignore */
    }
    bc?.postMessage({
      tipo: "estado",
      data,
    });
  }

  function applySession(pos, unlockedStep) {
    let changed = false;
    if (typeof unlockedStep === "number" && unlockedStep >= 0 && unlockedStep !== lastUnlocked) {
      lastUnlocked = unlockedStep;
      changed = true;
    }
    if (typeof pos === "number" && pos >= 0 && pos !== lastApplied) {
      lastApplied = pos;
      changed = true;
    }
    if (!changed) return;
    bc?.postMessage({
      tipo: "sesion",
      data: { pos: lastApplied, unlockedStep: lastUnlocked },
    });
  }

  function applyMonitorHighlight(highlight, fromRemote) {
    const key = JSON.stringify(highlight ?? null);
    if (key === lastPublishedHighlight && fromRemote) return;
    if (fromRemote) lastPublishedHighlight = key;
    bc?.postMessage({ tipo: "resaltado", data: highlight ?? null, _remote: true });
  }

  let lastTavusSessionKey = "";
  function applyMonitorSessionPhase(phase, fromRemote) {
    if (!phase || typeof phase !== "string") return;
    if (fromRemote && phase === lastPublishedPhase) return;
    if (fromRemote) lastPublishedPhase = phase;
    bc?.postMessage({ tipo: "faseSesion", data: { fase: phase }, _remote: !!fromRemote });
  }

  async function publishSessionPhase(phase) {
    if (!cfg.presenterToken || cfg.role !== "moderador") return;
    if (!phase || phasePublishInFlight || phase === lastPublishedPhase) return;
    phasePublishInFlight = true;
    lastPublishedPhase = phase;
    try {
      await fetch(`/api/monitor/${encodeURIComponent(cfg.meetingId)}/state`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-presenter-token": cfg.presenterToken,
        },
        body: JSON.stringify({ sessionPhase: phase }),
      });
    } catch {
      /* ignore */
    } finally {
      phasePublishInFlight = false;
    }
  }

  window.__CATCH_MONITOR_SYNC_API__ = {
    publishSessionPhase,
  };

  function applyTavusSession(session, fromRemote) {
    const key = JSON.stringify(session ?? null);
    if (fromRemote && key === lastTavusSessionKey) return;
    if (fromRemote) lastTavusSessionKey = key;
    bc?.postMessage({ tipo: "tavusSession", data: session ?? null, _remote: !!fromRemote });
    window.__CATCH_TAVUS_CVI__?.applyViewerSession?.(session);
  }

  async function fetchStep() {
    try {
      const res = await fetch(`/api/monitor/${encodeURIComponent(cfg.meetingId)}/state`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async function flushPublishQueue() {
    if (!cfg.presenterToken || cfg.role !== "moderador") return;
    if (publishInFlight) return;
    while (pendingPublish) {
      const job = pendingPublish;
      pendingPublish = null;
      if (!job.reset && job.pos === lastPublished) continue;
      publishInFlight = true;
      lastPublished = job.pos;
      try {
        await fetch(`/api/monitor/${encodeURIComponent(cfg.meetingId)}/state`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-presenter-token": cfg.presenterToken,
          },
          body: JSON.stringify({ step: job.pos, reset: job.reset }),
        });
      } catch {
        /* ignore */
      } finally {
        publishInFlight = false;
      }
    }
    if (pendingPublish) void flushPublishQueue();
  }

  function publishStep(pos, reset) {
    if (!cfg.presenterToken || cfg.role !== "moderador") return Promise.resolve();
    pendingPublish = { pos, reset: Boolean(reset) };
    return flushPublishQueue();
  }

  async function publishHighlight(highlight) {
    if (!cfg.presenterToken || cfg.role !== "moderador") return;
    const key = JSON.stringify(highlight ?? null);
    if (key === lastPublishedHighlight || highlightPublishInFlight) return;
    lastPublishedHighlight = key;
    highlightPublishInFlight = true;
    try {
      await fetch(`/api/monitor/${encodeURIComponent(cfg.meetingId)}/state`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-presenter-token": cfg.presenterToken,
        },
        body: JSON.stringify({ highlight: highlight ?? null }),
      });
    } catch {
      /* ignore */
    } finally {
      highlightPublishInFlight = false;
    }
  }

  function setupSupabase() {
    const url = cfg.supabaseUrl;
    const key = cfg.supabaseAnonKey;
    if (!url || !key || !window.supabase?.createClient) return false;

    supabaseClient = window.supabase.createClient(url, key);
    realtimeChannel = supabaseClient
      .channel(`monitor-state:${cfg.meetingId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "meeting_state",
          filter: `meeting_id=eq.${cfg.meetingId}`,
        },
        (payload) => {
          const row = payload.new || {};
          if (!shouldApplyRemoteRow(row)) return;
          markRemoteRowApplied(row);
          if (typeof row.current_step === "number") {
            applySession(row.current_step, row.unlocked_step);
          }
          if (typeof row.event_seq === "number") {
            window.__CATCH_MONITOR_QUEUE__?.onEventSeq(row.event_seq);
          }
          const gv = row.global_view || {};
          if (gv.monitorHighlight !== undefined) {
            applyMonitorHighlight(gv.monitorHighlight, true);
          }
          if (gv.monitorTavusSession !== undefined) {
            applyTavusSession(gv.monitorTavusSession, true);
          }
          if (gv.monitorSessionPhase !== undefined) {
            applyMonitorSessionPhase(gv.monitorSessionPhase, true);
          }
          if (gv.sessionResetNonce != null) {
            bc?.postMessage({
              tipo: "reinicioReunion",
              data: { nonce: gv.sessionResetNonce },
              _remote: true,
            });
          }
          applySectionAwaitFromGlobalView(gv);
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setSyncLabel(
            '<span class="punto vivo"></span>Supabase Realtime · sesión sincronizada',
          );
        }
      });
    return true;
  }

  bc?.addEventListener("message", (ev) => {
    const { tipo, data, _remote } = ev.data || {};
    if (tipo === "estado" && typeof data?.pos === "number") {
      if (cfg.role === "moderador") {
        void publishStep(data.pos, data.pos === 0);
      }
      return;
    }
    if (tipo === "faseSesion" && data?.fase) {
      if (cfg.role === "moderador" && !_remote) {
        void publishSessionPhase(data.fase);
      }
      return;
    }
    if (tipo === "resaltado") {
      if (cfg.role === "moderador" && !_remote) {
        const coerce = window.__CATCH_MONITOR_CHART__?.coerceHighlight;
        let payload = data ?? null;
        if (coerce) {
          const normalized = coerce(payload);
          if (normalized === undefined) return;
          payload = normalized;
        }
        void publishHighlight(payload);
      }
    }
  });

  function boot() {
    if (cfg.embed) {
      document.querySelector(".demo")?.classList.add("oculto");
    }
    const role = cfg.role || "cliente";
    if (["moderador", "cliente", "movil"].includes(role)) {
      try {
        history.replaceState(null, "", "#" + role);
      } catch {
        /* ignore */
      }
    }

    const hasSb = setupSupabase();
    void fetchStep().then((data) => {
      const resetDev =
        cfg.devResetSession &&
        cfg.role === "moderador" &&
        cfg.presenterToken &&
        window.__CATCH_MONITOR_DEV_FRESH__;
      if (resetDev) {
        window.__CATCH_MONITOR_DEV_FRESH__ = false;
        lastPublished = -1;
        void publishStep(0, true)
          .then(() => publishSessionPhase("preparacion"))
          .then(() => {
            applySession(0, 0);
            applyMonitorSessionPhase("preparacion", true);
          });
        return;
      }
      if (data && typeof data.eventSeq === "number") {
        lastEventSeq = data.eventSeq;
      }
      if (data && typeof data.step === "number") {
        applySession(data.step, data.unlockedStep);
        window.__CATCH_MONITOR_QUEUE__?.boot(data.eventSeq);
      } else if (cfg.role === "moderador" && cfg.presenterToken) {
        void publishStep(0, true);
      }
      if (data && data.sessionPhase) {
        applyMonitorSessionPhase(data.sessionPhase, true);
      }
      if (data && data.monitorHighlight !== undefined) {
        applyMonitorHighlight(data.monitorHighlight, true);
      }
      if (data && data.monitorTavusSession !== undefined) {
        applyTavusSession(data.monitorTavusSession, true);
      }
      if (data && typeof data.awaitingModerator === "boolean") {
        applySectionAwaitFromGlobalView({ awaitingModerator: data.awaitingModerator });
      }
      if (data && data.sessionResetNonce != null) {
        bc?.postMessage({
          tipo: "reinicioReunion",
          data: { nonce: data.sessionResetNonce },
          _remote: true,
        });
      }
      if (!hasSb) {
        setSyncLabel(
          '<span class="punto"></span>Sin Supabase: las vistas se sincronizan en este navegador',
        );
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    setTimeout(boot, 0);
  }

  window.addEventListener("beforeunload", () => {
    if (realtimeChannel && supabaseClient) {
      supabaseClient.removeChannel(realtimeChannel);
    }
  });
})();
