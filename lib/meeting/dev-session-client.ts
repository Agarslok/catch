const DEV_SESSION_KEY = "catch:devSessionId";

/** true si esta ejecución de `npm run dev` es nueva y se limpió el almacenamiento local. */
export function syncDevSessionStorage(): boolean {
  if (typeof window === "undefined") return false;
  const sid = process.env.NEXT_PUBLIC_CATCH_DEV_SESSION;
  if (!sid) return false;

  try {
    if (localStorage.getItem(DEV_SESSION_KEY) === sid) return false;
    const remove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || k === DEV_SESSION_KEY) continue;
      if (k === "catch-live-v1" || k.startsWith("catch:")) remove.push(k);
    }
    remove.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem(DEV_SESSION_KEY, sid);
    return true;
  } catch {
    return false;
  }
}
