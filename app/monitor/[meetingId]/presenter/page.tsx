import { redirect } from "next/navigation";
import { createPresenterToken } from "@/lib/meeting/presenter-auth";

type Props = { params: Promise<{ meetingId: string }> };

export default async function MonitorPresenterPage({ params }: Props) {
  const { meetingId } = await params;
  const token = createPresenterToken(meetingId);
  const q = new URLSearchParams({ role: "moderador", token });
  redirect(`/monitor/${meetingId}/shell?${q.toString()}#moderador`);
}
