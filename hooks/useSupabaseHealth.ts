"use client";

import { useEffect, useState } from "react";
import type { SupabaseHealth } from "@/lib/supabase/health";

export function useSupabaseHealth() {
  const [health, setHealth] = useState<SupabaseHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/supabase/health");
        const data = (await res.json()) as SupabaseHealth;
        if (!cancelled) setHealth(data);
      } catch {
        if (!cancelled) {
          setHealth({
            configured: false,
            ok: false,
            meetingStateReadable: false,
            meetingActivityWritable: false,
            error: "No se pudo contactar /api/supabase/health",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { health, loading };
}
