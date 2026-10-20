import { NextResponse } from "next/server";
import { checkSupabaseHealth } from "@/lib/supabase/health";

export async function GET() {
  try {
    const health = await checkSupabaseHealth();
    return NextResponse.json(health, { status: health.ok ? 200 : 503 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        configured: false,
        ok: false,
        meetingStateReadable: false,
        meetingActivityWritable: false,
        error: message,
      },
      { status: 503 },
    );
  }
}
