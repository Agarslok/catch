import { NextResponse } from "next/server";
import {
  resetMeetingSessionWithServiceRole,
  rpcFunctionMissing,
} from "@/lib/meeting/reset-session";
import { verifyPresenterToken } from "@/lib/meeting/presenter-auth";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

/**
 * Reinicio destructivo de UNA reunión. Solo presentador (x-presenter-token).
 * La eliminación corre en la función SQL reset_meeting_session (transacción).
 * Requiere SUPABASE_SERVICE_ROLE_KEY en el servidor (local y Netlify).
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ meetingId: string }> },
) {
  const { meetingId } = await context.params;
  const id = meetingId.trim();
  if (!id || id.length > 120) {
    return NextResponse.json({ error: "Identificador de reunión inválido." }, { status: 400 });
  }

  const token = request.headers.get("x-presenter-token");
  if (!verifyPresenterToken(id, token)) {
    return NextResponse.json({ error: "No autorizado para reiniciar esta reunión." }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient("meeting/reset-session");
  if (!supabase) {
    return NextResponse.json(
      {
        error:
          "No se puede reiniciar: falta SUPABASE_SERVICE_ROLE_KEY en el servidor.",
      },
      { status: 503 },
    );
  }

  let nonce: number | null = null;
  let eventSeq: number | null = null;

  const rpc = await supabase.rpc("reset_meeting_session", { p_meeting_id: id });
  if (!rpc.error) {
    const payload = (rpc.data ?? {}) as { sessionResetNonce?: number; eventSeq?: number };
    nonce = payload.sessionResetNonce ?? null;
    eventSeq = payload.eventSeq ?? null;
  } else if (rpcFunctionMissing(rpc.error)) {
    try {
      const reset = await resetMeetingSessionWithServiceRole(supabase, id);
      nonce = reset.sessionResetNonce;
      eventSeq = reset.eventSeq;
    } catch {
      return NextResponse.json(
        { error: "No se pudo reiniciar la reunión." },
        { status: 500 },
      );
    }
  } else {
    return NextResponse.json(
      { error: "No se pudo reiniciar la reunión." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    meetingId: id,
    sessionResetNonce: nonce,
    eventSeq,
  });
}
