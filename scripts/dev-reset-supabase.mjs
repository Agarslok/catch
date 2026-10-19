/**
 * Reinicia meeting_state en Supabase al arrancar `npm run dev` (solo local).
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

function parseEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function loadEnvLocal() {
  const root = process.cwd();
  return {
    ...parseEnvFile(path.join(root, ".env")),
    ...parseEnvFile(path.join(root, ".env.local")),
  };
}

async function main() {
  if (process.env.MEETING_DEV_RESET_SESSION === "0") {
    console.log("[catch] Reinicio de reunión desactivado (MEETING_DEV_RESET_SESSION=0)");
    return;
  }

  const env = { ...loadEnvLocal(), ...process.env };
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.log("[catch] Sin Supabase en .env / .env.local: solo se limpiará el estado del navegador.");
    return;
  }

  const ids = (env.MEETING_DEV_RESET_IDS || "demo-q3-2026")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const supabase = createClient(url, key);
  const now = new Date().toISOString();

  for (const meetingId of ids) {
    const { data: existing } = await supabase
      .from("meeting_state")
      .select("global_view")
      .eq("meeting_id", meetingId)
      .maybeSingle();
    const prev =
      existing?.global_view && typeof existing.global_view === "object"
        ? existing.global_view
        : {};
    const { error } = await supabase.from("meeting_state").upsert({
      meeting_id: meetingId,
      current_step: 0,
      unlocked_step: 0,
      global_view: { ...prev, monitorSessionPhase: "preparacion" },
      updated_at: now,
    });
    if (error) {
      console.warn(`[catch] No se pudo reiniciar ${meetingId}:`, error.message);
    } else {
      console.log(`[catch] meeting_state reiniciado: ${meetingId} → paso 0`);
    }
  }
}

main().catch((e) => {
  console.warn("[catch] dev-reset-supabase:", e.message || e);
});
