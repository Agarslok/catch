"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  flushInteractionQueue,
  sendBeaconLeave,
  trackInteraction,
} from "@/lib/analytics/client";
import { VISITOR_HEARTBEAT_MS } from "@/lib/analytics/participant-summaries";
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
  const presenceSessionKeyRef = useRef<string | null>(null);

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

    const presenceKey = `${meetingId}:${participantId}`;
    if (presenceSessionKeyRef.current !== presenceKey) {
      presenceSessionKeyRef.current = presenceKey;
      trackInteraction(ctx, "session.join", {
        metadata: { role, display_name: displayName ?? null },
      });
      void flushInteractionQueue(meetingId);
      if (role === "visitor") {
        trackInteraction(ctx, "session.heartbeat", {
          metadata: { display_name: displayName ?? null },
        });
        void flushInteractionQueue(meetingId);
      }
    }

    const onLeave = () => sendBeaconLeave(ctx);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        if (role === "visitor") {
          trackInteraction(ctx, "session.heartbeat", {
            metadata: { display_name: displayName ?? null },
          });
        }
        void flushInteractionQueue(meetingId);
      } else if (document.visibilityState === "hidden") {
        void flushInteractionQueue(meetingId);
      }
    };
    window.addEventListener("pagehide", onLeave);
    document.addEventListener("visibilitychange", onVisibility);
    const beat =
      role === "visitor"
        ? window.setInterval(() => {
            trackInteraction(ctx, "session.heartbeat", {
              metadata: { display_name: displayName ?? null },
            });
            void flushInteractionQueue(meetingId);
          }, VISITOR_HEARTBEAT_MS)
        : 0;
    return () => {
      if (beat) window.clearInterval(beat);
      window.removeEventListener("pagehide", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ctx, enabled, meetingId, role, displayName, participantId]);

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
