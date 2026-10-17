import { NextResponse } from "next/server";
import { issueParticipantToken } from "@/lib/meeting/participant-identity";

type Body = { participantId?: string; existingToken?: string };

export async function POST(
  request: Request,
  context: { params: Promise<{ meetingId: string }> },
) {
  const { meetingId } = await context.params;
  const body = (await request.json()) as Body;
  const participantId = (body.participantId ?? "").trim();
  if (!participantId) {
    return NextResponse.json({ error: "participantId required" }, { status: 400 });
  }

  const issued = await issueParticipantToken(
    meetingId,
    participantId,
    (body.existingToken ?? "").trim() || null,
  );
  if (issued.status !== 200) {
    return NextResponse.json({ error: issued.error ?? "Unauthorized" }, { status: issued.status });
  }
  return NextResponse.json({
    meetingId,
    participantId,
    token: issued.token,
  });
}
