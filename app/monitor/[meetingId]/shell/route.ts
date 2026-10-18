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

  const inject = `
<script>window.__CATCH_MONITOR_SYNC__=${syncConfig};</script>
${narrationProbe}
<script src="/monitor-v3/monitor-dev-reset.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
<script src="/monitor-v3/monitor-participant-bridge.js"></script>
<script src="/monitor-v3/monitor-queue-sync.js"></script>
<script src="/monitor-v3/monitor-presentation-effects.js"></script>
<script src="/monitor-v3/monitor-section-close.js"></script>
<script src="/monitor-v3/monitor-narration-cues.js"></script>
<script src="/monitor-v3/monitor-supabase-sync.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@daily-co/daily-js@0.83.1/dist/daily-iframe.min.js"></script>
<script src="/monitor-v3/monitor-tavus-cvi.js"></script>
`;

  html = html.replace("</body>", `${inject}</body>`);

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
