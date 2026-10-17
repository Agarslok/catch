/**
 * Prueba manual del endpoint Monitor IA (requiere `npm run dev` y GEMINI_API_KEY en .env).
 *
 * Uso:
 *   node scripts/test-monitor-ai-chat.mjs
 *   node scripts/test-monitor-ai-chat.mjs --meeting demo-q3-2026 --port 3000
 */
import { createHmac } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";

function loadEnv() {
  try {
    const raw = readFileSync(join(process.cwd(), ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 0) continue;
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {
    /* no .env */
  }
}

function presenterToken(meetingId) {
  const secret = process.env.MEETING_PRESENTER_SECRET ?? "catch-dev-presenter-secret";
  return createHmac("sha256", secret).update(meetingId).digest("hex").slice(0, 40);
}

function participantToken(meetingId, participantId) {
  const secret = process.env.MEETING_PRESENTER_SECRET ?? "catch-dev-presenter-secret";
  return createHmac("sha256", secret)
    .update(`participant:${meetingId}:${participantId}`)
    .digest("hex")
    .slice(0, 40);
}

const args = process.argv.slice(2);
const meetingId = args.includes("--meeting")
  ? args[args.indexOf("--meeting") + 1]
  : "demo-q3-2026";
const port = args.includes("--port") ? args[args.indexOf("--port") + 1] : "3000";
const asVisitor = args.includes("--visitor");

loadEnv();

if (!process.env.GEMINI_API_KEY?.trim()) {
  console.error("GEMINI_API_KEY no está definida en .env. Añádala y vuelva a ejecutar.");
  process.exit(1);
}

const url = `http://localhost:${port}/api/monitor/${encodeURIComponent(meetingId)}/chat`;
const contextBlock =
  "Sección: Indicadores. Edición Jul-Ago 2025. Cifras ya calculadas (mercado de 40 empresas y la empresa del cliente):\n- Rotación bimestral: ejemplo agregado para prueba.";

const body = {
  question: "¿Qué es la rotación no controlada en términos simples?",
  sectionIndex: 3,
  sectionKey: "indicadores",
  contextBlock,
  editionLabel: "Jul-Ago 2025",
};

const headers = { "Content-Type": "application/json" };

if (asVisitor) {
  const participantId = "test-participant-1";
  headers["x-participant-token"] = participantToken(meetingId, participantId);
  body.participantId = participantId;
} else {
  headers["x-presenter-token"] = presenterToken(meetingId);
}

console.log(`POST ${url} (${asVisitor ? "visitante" : "moderador"})`);

const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
const data = await res.json();
console.log("Status:", res.status);
console.log(JSON.stringify(data, null, 2));

if (!res.ok) process.exit(1);
