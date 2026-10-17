import { NextResponse } from "next/server";
import { verifyPresenterToken } from "@/lib/meeting/presenter-auth";
import type { ClarityVote } from "@/lib/meeting/session-types";
import {
  getSupabaseServerClient,
  getSupabaseServiceClient,
} from "@/lib/supabase/server";

const VOTES = new Set<ClarityVote>(["claro", "duda", "glosario", "explorar"]);

type PostBody = {
  participantId?: string;
  sectionKey?: string;
  vote?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ meetingId: string }> },
) {
  const { meetingId } = await context.params;
  const body = (await request.json()) as PostBody;
  const participantId = (body.participantId ?? "").trim();
  const sectionKey = (body.sectionKey ?? "").trim();
  const vote = body.vote as ClarityVote;
  if (!participantId || !sectionKey || !VOTES.has(vote)) {
    return NextResponse.json({ error: "invalid clarity vote payload" }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { error } = await supabase.from("meeting_clarity_votes").upsert(
    {
      meeting_id: meetingId,
      section_key: sectionKey,
      participant_id: participantId,
      vote,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "meeting_id,section_key,participant_id" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ meetingId: string }> },
) {
  const { meetingId } = await context.params;
  const token = request.headers.get("x-presenter-token");
  if (!verifyPresenterToken(meetingId, token)) {
    return NextResponse.json({ error: "Unauthorized presenter" }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY required" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("meeting_clarity_votes")
    .select("section_key, vote")
    .eq("meeting_id", meetingId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const summary: Record<
    string,
    { claro: number; duda: number; glosario: number; explorar: number }
  > = {};
  for (const row of data ?? []) {
    const key = row.section_key as string;
    const bucket = summary[key] ?? { claro: 0, duda: 0, glosario: 0, explorar: 0 };
    const v = row.vote as ClarityVote;
    if (v in bucket) bucket[v] += 1;
    summary[key] = bucket;
  }

  return NextResponse.json({ meetingId, summary });
}
