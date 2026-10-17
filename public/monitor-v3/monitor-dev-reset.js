/**
 * Limpia estado local del monitor cuando cambia la sesión de `npm run dev`.
 */
(function () {
  const cfg = window.__CATCH_MONITOR_SYNC__;
  const devSessionId = cfg?.devSessionId;
  if (!devSessionId) return;

  const KEY = "catch:devSessionId";
  try {
    if (localStorage.getItem(KEY) === devSessionId) return;
    const remove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || k === KEY) continue;
      if (k === "catch-live-v1" || k.startsWith("catch:")) remove.push(k);
    }
    remove.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem(KEY, devSessionId);
    window.__CATCH_MONITOR_DEV_FRESH__ = true;
  } catch {
    /* ignore */
  }
})();
