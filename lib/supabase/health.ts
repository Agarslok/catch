import { createClient } from "@supabase/supabase-js";

export type SupabaseHealth = {
  configured: boolean;
  ok: boolean;
  meetingStateReadable: boolean;
  meetingActivityWritable: boolean;
  /** false si faltan meeting_questions o columnas extendidas de meeting_state */
  schemaExtended?: boolean;
  error?: string;
};

export async function checkSupabaseHealth(): Promise<SupabaseHealth> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return {
      configured: false,
      ok: false,
      meetingStateReadable: false,
      meetingActivityWritable: false,
      error: "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    };
  }

  const supabase = createClient(url, key);
  const testMeeting = "__health_check__";

  const { error: readError } = await supabase
    .from("meeting_state")
    .select("meeting_id")
    .eq("meeting_id", testMeeting)
    .maybeSingle();

  if (readError) {
    const missingState =
      readError.message.includes("meeting_state") ||
      readError.code === "PGRST205"
        ? " Falta la tabla meeting_state: ejecuta 20260313200000_catch_cuelrmx_patch.sql."
        : "";
    return {
      configured: true,
      ok: false,
      meetingStateReadable: false,
      meetingActivityWritable: false,
      error: readError.message + missingState,
    };
  }

  const { error: insertError } = await supabase.from("meeting_activity").insert({
    meeting_id: testMeeting,
    event_type: "CHART_VIEWED",
    actor_id: "health",
    actor_name: "Health Check",
    scope: "local",
    payload: { probe: true },
  });

  if (insertError) {
    const rlsHint =
      insertError.message.includes("row-level security") ||
      insertError.code === "42501"
        ? " Ejecuta supabase/migrations/20260313200000_catch_cuelrmx_patch.sql en el SQL Editor."
        : "";
    return {
      configured: true,
      ok: false,
      meetingStateReadable: true,
      meetingActivityWritable: false,
      error: insertError.message + rlsHint,
    };
  }

  const { error: upsertError } = await supabase.from("meeting_state").upsert({
    meeting_id: testMeeting,
    current_step: 0,
    unlocked_step: 0,
    updated_at: new Date().toISOString(),
  });

  if (upsertError) {
    return {
      configured: true,
      ok: false,
      meetingStateReadable: true,
      meetingActivityWritable: true,
      error: upsertError.message,
    };
  }

  const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  let schemaExtended = true;
  let schemaHint: string | undefined;

  if (serviceUrl && serviceKey) {
    const admin = createClient(serviceUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: stateExtError } = await admin
      .from("meeting_state")
      .select("event_seq, script, presentation_status")
      .limit(1);
    const { error: questionsError } = await admin
      .from("meeting_questions")
      .select("id")
      .limit(1);

    if (stateExtError || questionsError) {
      schemaExtended = false;
      schemaHint =
        "Faltan migraciones de sesión (meeting_questions / columnas de meeting_state). Ejecuta: npm run db:push";
    }
  }

  return {
    configured: true,
    ok: schemaExtended,
    meetingStateReadable: true,
    meetingActivityWritable: true,
    schemaExtended,
    ...(schemaHint ? { error: schemaHint } : {}),
  };
}
