import { NextResponse } from "next/server";
import { registerMeetingVisitor } from "@/lib/meeting/visitor-register";

type Body = {
  displayName?: string;
  participantId?: string;
  existingToken?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ meetingId: string }> },
) {
  const { meetingId } = await context.params;
  const body = (await request.json()) as Body;
  const result = await registerMeetingVisitor(
    meetingId,
    body.displayName ?? "",
    body.participantId ?? "",
    (body.existingToken ?? "").trim() || null,
  );

  if (result.status !== 200) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    meetingId,
    participantId: result.participantId,
    displayName: result.displayName,
    token: result.token,
    joinedAt: result.joinedAt,
  });
}
