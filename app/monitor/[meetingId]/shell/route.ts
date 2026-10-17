import { readFileSync } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

function readDevSessionId(): string {
  if (process.env.NODE_ENV !== "development") return "";
  if (process.env.MEETING_DEV_RESET_SESSION === "0") return "";
  try {
    return readFileSync(path.join(process.cwd(), ".catch-dev-session"), "utf8").trim();
  } catch {
    return "";
  }
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
  const syncConfig = JSON.stringify({
    meetingId,
    role,
    presenterToken: token || null,
    embed: true,
    devSessionId: devSessionId || null,
    devResetSession: Boolean(devSessionId),
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  });

  const inject = `
<script>window.__CATCH_MONITOR_SYNC__=${syncConfig};</script>
<script src="/monitor-v3/monitor-dev-reset.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
<script src="/monitor-v3/monitor-participant-bridge.js"></script>
<script src="/monitor-v3/monitor-queue-sync.js"></script>
<script src="/monitor-v3/monitor-supabase-sync.js"></script>
`;

  html = html.replace("</body>", `${inject}</body>`);

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
