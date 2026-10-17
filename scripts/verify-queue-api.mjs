/**
 * Verificación de cola + Supabase (local). No imprime secretos.
 * Uso:
 *   node scripts/verify-queue-api.mjs [baseUrl] [meetingId]
 *   node scripts/verify-queue-api.mjs --all [baseUrl] [meetingId]   # todos los tipos de cola
 */
import fs from "fs";
import path from "path";
import { createHmac } from "crypto";

function loadEnv() {
  for (const name of [".env", ".env.local"]) {
    const file = path.join(process.cwd(), name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      process.env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
  }
}

function presenterToken(meetingId) {
  const secret = process.env.MEETING_PRESENTER_SECRET ?? "catch-dev-presenter-secret";
  return createHmac("sha256", secret).update(meetingId).digest("hex").slice(0, 40);
}

const argv = process.argv.slice(2);
const allKinds = argv[0] === "--all";
const base = allKinds ? argv[1] || "http://localhost:3000" : argv[0] || "http://localhost:3000";
const meetingId = allKinds ? argv[2] || "demo-q3-2026" : argv[1] || "demo-q3-2026";

const QUEUE_ATTEMPTS = [
  {
    requestKind: "written_question",
    source: "verify_script",
    text: "Prueba written_question",
    idempotencyKey: (pid) => `verify:written:${pid}`,
  },
  {
    requestKind: "assistant_to_presenter",
    source: "verify_script",
    text: "Prueba assistant_to_presenter",
    idempotencyKey: (pid) => `verify:assistant:${pid}`,
  },
  {
    requestKind: "ai_escalation",
    source: "verify_script",
    text: "Prueba ai_escalation",
    idempotencyKey: (pid) => `verify:escalation:${pid}`,
  },
  {
    requestKind: "oral_turn",
    source: "verify_script",
    idempotencyKey: (pid) => `verify:oral:${pid}`,
  },
  {
    requestKind: "clarity_doubt",
    source: "verify_script",
    text: "Prueba clarity_doubt",
    idempotencyKey: (pid) => `verify:clarity:${pid}`,
  },
];

loadEnv();

async function postQuestion(meetingId, pid, token, attempt) {
  const body = {
    participantId: pid,
    participantToken: token,
    requestKind: attempt.requestKind,
    source: attempt.source,
    sectionKey: "general",
    sectionLabel: "General",
    idempotencyKey: attempt.idempotencyKey(pid),
  };
  if (attempt.text) body.text = attempt.text;
  const res = await fetch(`${base}/api/meeting/${meetingId}/questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, ok: res.ok, id: data.question?.id, error: data.error, duplicate: data.duplicate };
}

async function main() {
  console.log("Step 1: health + submit", allKinds ? "all queue kinds" : "written_question", "attempt\n");

  const health = await fetch(`${base}/api/supabase/health`).then((r) => r.json());
  console.log("health:", health.ok ? "OK" : "FAIL", health.error || "");

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log("BLOCKED: agrega SUPABASE_SERVICE_ROLE_KEY a .env y reinicia `npm run dev`.\n");
  }

  const pid = `verify-${Date.now()}`;
  const tokRes = await fetch(`${base}/api/meeting/${meetingId}/participant-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ participantId: pid }),
  });
  const tokBody = await tokRes.json();
  if (!tokRes.ok || !tokBody.token) {
    console.log("participant-token:", tokRes.status, tokBody.error || "sin token");
    process.exit(1);
  }

  const attempts = allKinds ? QUEUE_ATTEMPTS : [QUEUE_ATTEMPTS[0]];
  const createdIds = [];
  for (const attempt of attempts) {
    const r = await postQuestion(meetingId, pid, tokBody.token, attempt);
    const label = attempt.requestKind.padEnd(24);
    console.log(`POST ${label}`, r.status, r.ok ? r.id || "(dup)" : r.error);
    if (r.ok && r.id) createdIds.push(r.id);
  }

  const pt = presenterToken(meetingId);
  const listRes = await fetch(`${base}/api/meeting/${meetingId}/questions`, {
    headers: { "x-presenter-token": pt },
  });
  const listBody = await listRes.json();
  const rows = listBody.questions || [];
  console.log("GET moderator:", listRes.status, `rows=${rows.length}`);

  if (allKinds && listRes.ok) {
    const kinds = new Set(rows.map((q) => q.request_kind));
    for (const a of QUEUE_ATTEMPTS) {
      console.log(`  kind ${a.requestKind}:`, kinds.has(a.requestKind) ? "present" : "MISSING");
    }
  }

  const found = createdIds.length > 0 && createdIds.every((id) => rows.some((q) => q.id === id));
  if (!health.ok || !listRes.ok || attempts.some(() => false)) process.exit(1);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) process.exit(1);
  if (!found && createdIds.length) {
    console.log("FAIL: moderator list missing created ids");
    process.exit(1);
  }
  console.log("\nverify-queue-api: Step 1 OK");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
