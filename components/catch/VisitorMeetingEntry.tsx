"use client";

import { useCallback, useEffect, useState } from "react";
import { LiveMeetingApp } from "@/components/catch/LiveMeetingApp";
import { VisitorJoinScreen } from "@/components/catch/VisitorJoinScreen";
import {
  readVisitorActor,
  readVisitorToken,
  type VisitorActor,
} from "@/lib/meeting/visitor-session";

type Props = { meetingId: string };

export function VisitorMeetingEntry({ meetingId }: Props) {
  const [actor, setActor] = useState<VisitorActor | null>(null);
  const [token, setToken] = useState("");

  useEffect(() => {
    const stored = readVisitorActor(meetingId);
    if (stored) {
      setActor(stored);
      setToken(readVisitorToken(meetingId));
    }
  }, [meetingId]);

  const onJoined = useCallback((next: VisitorActor, nextToken: string) => {
    setActor(next);
    setToken(nextToken);
  }, []);

  if (!actor) {
    return <VisitorJoinScreen meetingId={meetingId} onJoined={onJoined} />;
  }

  return (
    <LiveMeetingApp
      meetingId={meetingId}
      role="visitor"
      visitorIdentity={actor}
      initialParticipantToken={token}
    />
  );
}
