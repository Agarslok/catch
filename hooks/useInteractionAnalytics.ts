"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  flushInteractionQueue,
  sendBeaconLeave,
  trackInteraction,
} from "@/lib/analytics/client";
import { setVisitorAnalyticsAuth } from "@/lib/analytics/participant-auth";
import type { ParticipantRole } from "@/lib/analytics/types";
import { participantRoleFromAppRole } from "@/lib/analytics/session";

type Options = {
  meetingId: string;
  role: "presenter" | "visitor";
  participantId: string;
  participantToken?: string;
  displayName?: string;
  enabled?: boolean;
};

export function useInteractionAnalytics({
  meetingId,
  role,
  participantId,
  participantToken,
  displayName,
  enabled = true,
}: Options) {
  const participantRole: ParticipantRole = participantRoleFromAppRole(role);
  const ctx = useMemo(
    () => ({ meetingId, participantId, participantRole }),
    [meetingId, participantId, participantRole],
  );
  const joined = useRef(false);

  useEffect(() => {
    if (role === "visitor" && participantToken) {
      setVisitorAnalyticsAuth(participantId, participantToken);
    }
  }, [role, participantId, participantToken]);

  useEffect(() => {
    return () => {
      if (role === "visitor") setVisitorAnalyticsAuth(participantId, null);
    };
  }, [role, participantId]);

  useEffect(() => {
    if (!enabled) return;
    if (joined.current) return;
    joined.current = true;
    trackInteraction(ctx, "session.join", {
      metadata: { role, display_name: displayName ?? null },
    });
    void flushInteractionQueue(meetingId);

    const onLeave = () => sendBeaconLeave(ctx);
    window.addEventListener("pagehide", onLeave);
    const beat =
      role === "visitor"
        ? window.setInterval(() => {
            trackInteraction(ctx, "session.heartbeat", {
              metadata: { display_name: displayName ?? null },
            });
          }, 20_000)
        : 0;
    return () => {
      if (beat) window.clearInterval(beat);
      window.removeEventListener("pagehide", onLeave);
      if (role === "visitor") {
        trackInteraction(ctx, "session.leave", {});
        void flushInteractionQueue(meetingId);
      }
    };
  }, [ctx, enabled, meetingId, role, displayName]);

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
