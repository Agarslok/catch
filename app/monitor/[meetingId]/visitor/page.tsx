import { redirect } from "next/navigation";

type Props = { params: Promise<{ meetingId: string }> };

export default async function MonitorVisitorPage({ params }: Props) {
  const { meetingId } = await params;
  const q = new URLSearchParams({ role: "cliente" });
  redirect(`/monitor/${meetingId}/shell?${q.toString()}#cliente`);
}
