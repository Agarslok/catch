"use client";

import { useEffect, useState } from "react";
import type { ActivityRow } from "@/lib/activity/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function useActivityFeed(meetingId: string, enabled: boolean) {
  const [rows, setRows] = useState<ActivityRow[]>([]);

  useEffect(() => {
    if (!enabled) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("meeting_activity")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: false })
        .limit(40);
      if (!cancelled && data) setRows(data as ActivityRow[]);
    })();

    const channel = supabase
      .channel(`meeting-activity:${meetingId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "meeting_activity",
          filter: `meeting_id=eq.${meetingId}`,
        },
        (payload) => {
          const row = payload.new as ActivityRow;
          setRows((prev) => [row, ...prev].slice(0, 60));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [meetingId, enabled]);

  return rows;
}
