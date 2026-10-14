"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  flushInteractionQueue,
  sendBeaconLeave,
  trackInteraction,
} from "@/lib/analytics/client";
import type { ParticipantRole } from "@/lib/analytics/types";
import { participantRoleFromAppRole } from "@/lib/analytics/session";

type Options = {
  meetingId: string;
  role: "presenter" | "visitor";
  participantId: string;
  enabled?: boolean;
};

export function useInteractionAnalytics({
  meetingId,
  role,
  participantId,
  enabled = true,
}: Options) {
  const participantRole: ParticipantRole = participantRoleFromAppRole(role);
  const ctx = useMemo(
    () => ({ meetingId, participantId, participantRole }),
    [meetingId, participantId, participantRole],
  );
  const joined = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (joined.current) return;
    joined.current = true;
    trackInteraction(ctx, "session.join", {
      metadata: { role },
    });
    void flushInteractionQueue(meetingId);

    const onLeave = () => sendBeaconLeave(ctx);
    window.addEventListener("pagehide", onLeave);
    return () => {
      window.removeEventListener("pagehide", onLeave);
      trackInteraction(ctx, "session.leave", {});
      void flushInteractionQueue(meetingId);
    };
  }, [ctx, enabled, meetingId, role]);

  const track = useCallback(
    (
      eventType: Parameters<typeof trackInteraction>[1],
      fields: Parameters<typeof trackInteraction>[2] = {},
    ) => {
      if (!enabled) return;
      trackInteraction(ctx, eventType, fields);
    },
    [ctx, enabled],
  );

  return { track, flush: () => flushInteractionQueue(meetingId) };
}
