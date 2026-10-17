import { LiveMeetingApp } from "@/components/catch/LiveMeetingApp";
import { createPresenterToken } from "@/lib/meeting/presenter-auth";

type Props = { params: Promise<{ meetingId: string }> };

export default async function PresenterPage({ params }: Props) {
  const { meetingId } = await params;
  const presenterToken = createPresenterToken(meetingId);
  return (
    <LiveMeetingApp
      meetingId={meetingId}
      role="presenter"
      presenterToken={presenterToken}
    />
  );
}
