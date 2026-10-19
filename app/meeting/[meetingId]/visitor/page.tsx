import { VisitorMeetingEntry } from "@/components/catch/VisitorMeetingEntry";

type Props = { params: Promise<{ meetingId: string }> };

export default async function VisitorPage({ params }: Props) {
  const { meetingId } = await params;
  return <VisitorMeetingEntry meetingId={meetingId} />;
}
