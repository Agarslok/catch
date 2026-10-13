import { LiveMeetingApp } from "@/components/catch/LiveMeetingApp";

type Props = { params: Promise<{ meetingId: string }> };

export default async function VisitorPage({ params }: Props) {
  const { meetingId } = await params;
  return <LiveMeetingApp meetingId={meetingId} role="visitor" />;
}
