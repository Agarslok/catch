import { readFileSync } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { snapshotMonitorNarrationPlans } from "@/lib/meeting/monitor-narration-plan";

function readDevSessionId(): string {
  if (process.env.NODE_ENV !== "development") return "";
  if (process.env.MEETING_DEV_RESET_SESSION === "0") return "";
  try {
    return readFileSync(path.join(process.cwd(), ".catch-dev-session"), "utf8").trim();
  } catch {
    return "";
  }
}

function monitorScriptTag(filename: string): string {
  const filePath = path.join(process.cwd(), "public", "monitor-v3", filename);
  try {
    const src = readFileSync(filePath, "utf8").replace(
      /<\/script/gi,
      "<\\/script",
    );
    return `<script data-catch-inline="${filename}">${src}</script>`;
  } catch {
    return `<script src="/monitor-v3/${filename}"></script>`;
  }
}

/** Expone planMonitorNarration(S.pos) en el HTML del presentador (modo prueba). */
function scriptPlanMonitorNarration(): string {
  const payload = JSON.stringify(snapshotMonitorNarrationPlans()).replace(
    /</g,
    "\\u003c",
  );
  return `<script>
window.planMonitorNarration = (function (plans) {
  return function planMonitorNarration(pos) {
    var i = Number(pos);
    if (!Number.isInteger(i) || i < 0 || i >= plans.length) {
      return { stepIndex: i, stepKind: "inicio", speakText: null, highlightRef: null, blockAdvance: false };
    }
    return plans[i];
  };
})(${payload});
</script>`;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ meetingId: string }> },
) {
  const { meetingId } = await context.params;
  const role = request.nextUrl.searchParams.get("role") ?? "cliente";
  const token = request.nextUrl.searchParams.get("token") ?? "";

  const filePath = path.join(
    process.cwd(),
    "public",
    "monitor-v3",
    "monitor-en-vivo-catch.html",
  );
  let html = readFileSync(filePath, "utf8");

  const devSessionId = readDevSessionId();
  const mp4Enabled =
    process.env.NEXT_PUBLIC_AVATAR_MP4_ENABLED === "1" ||
    process.env.NEXT_PUBLIC_AVATAR_MP4_ENABLED === "true";

  const syncConfig = JSON.stringify({
    meetingId,
    role,
    presenterToken: token || null,
    embed: true,
    devSessionId: devSessionId || null,
    devResetSession: Boolean(devSessionId),
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    mp4Enabled,
  });

  const narrationProbe =
    role === "moderador" ? scriptPlanMonitorNarration() : "";

  const headBoot = `<script>window.__CATCH_MONITOR_SYNC__=${syncConfig};document.documentElement.classList.add("catch-embed");</script>
${monitorScriptTag("monitor-participant-bridge.js")}`;
  if (html.includes("<head>")) {
    html = html.replace("<head>", `<head>\n${headBoot}`);
  } else {
    html = headBoot + html;
  }

  const inject = `
${narrationProbe}
${monitorScriptTag("monitor-dev-reset.js")}
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
${monitorScriptTag("monitor-queue-sync.js")}
${monitorScriptTag("monitor-presentation-effects.js")}
${monitorScriptTag("monitor-section-close.js")}
${monitorScriptTag("monitor-narration-cues.js")}
${monitorScriptTag("monitor-supabase-sync.js")}
<script src="https://cdn.jsdelivr.net/npm/@daily-co/daily-js@0.83.1/dist/daily-iframe.min.js"></script>
${monitorScriptTag("monitor-tavus-cvi.js")}
`;

  html = html.replace("</body>", `${inject}</body>`);

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
