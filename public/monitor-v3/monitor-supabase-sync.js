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
  let lastPublished = -1;
  let lastPublishedHighlight = "";
  let publishInFlight = false;
  let highlightPublishInFlight = false;
  let supabaseClient = null;
  let realtimeChannel = null;

  function setSyncLabel(html) {
    const el = document.getElementById("estadoSync");
    if (el) el.innerHTML = html;
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

  async function fetchStep() {
    try {
      const res = await fetch(`/api/monitor/${encodeURIComponent(cfg.meetingId)}/state`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async function publishStep(pos, reset) {
    if (!cfg.presenterToken || cfg.role !== "moderador") return;
    if (publishInFlight) return;
    if (!reset && pos === lastPublished) return;
    lastPublished = pos;
    publishInFlight = true;
    try {
      await fetch(`/api/monitor/${encodeURIComponent(cfg.meetingId)}/state`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-presenter-token": cfg.presenterToken,
        },
        body: JSON.stringify({ step: pos, reset: Boolean(reset) }),
      });
    } catch {
      /* ignore */
    } finally {
      publishInFlight = false;
    }
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
    if (tipo === "resaltado") {
      if (cfg.role === "moderador" && !_remote) {
        void publishHighlight(data ?? null);
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
        void publishStep(0, true).then(() => applySession(0, 0));
        return;
      }
      if (data && typeof data.step === "number") {
        applySession(data.step, data.unlockedStep);
        window.__CATCH_MONITOR_QUEUE__?.boot(data.eventSeq);
      } else if (cfg.role === "moderador" && cfg.presenterToken) {
        void publishStep(0, true);
      }
      if (data && data.monitorHighlight !== undefined) {
        applyMonitorHighlight(data.monitorHighlight, true);
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
