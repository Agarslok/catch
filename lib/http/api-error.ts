/** Extrae mensaje legible del cuerpo JSON de un endpoint (evita `[object Object]` en UI). */
export function errorMessageFromApiBody(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const o = data as Record<string, unknown>;
  const err = o.error;
  if (typeof err === "string" && err.trim()) return err.trim();
  if (err instanceof Error) return err.message || fallback;
  if (err && typeof err === "object") {
    const nested = err as Record<string, unknown>;
    if (typeof nested.message === "string" && nested.message.trim()) {
      return nested.message.trim();
    }
    try {
      const s = JSON.stringify(err);
      if (s && s !== "{}") return s;
    } catch {
      /* ignore */
    }
  }
  if (typeof o.message === "string" && o.message.trim()) return o.message.trim();
  return fallback;
}

export function formatUnknownError(e: unknown, fallback = "Error desconocido"): string {
  if (e instanceof Error) {
    const m = e.message?.trim();
    if (m && m !== "[object Object]") return m;
  }
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    if (typeof o.errorMsg === "string" && o.errorMsg.trim()) return o.errorMsg.trim();
    if (typeof o.message === "string" && o.message.trim()) return o.message.trim();
    if (o.error) return errorMessageFromApiBody({ error: o.error }, fallback);
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
