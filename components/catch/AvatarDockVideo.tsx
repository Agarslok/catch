"use client";

import { AvatarVisual } from "@/components/catch/AvatarVisual";

type Props = {
  active?: boolean;
  syncPaused?: boolean;
  canControlPause?: boolean;
  onTogglePause?: () => void;
};

export function AvatarDockVideo({
  active = true,
  syncPaused = false,
  canControlPause = false,
  onTogglePause,
}: Props) {
  return (
    <section
      className="ai-dock"
      aria-label="Avatar IA de Catch"
      style={{ ["--ai-ratio" as string]: "16/9" }}
    >
      <div className="ai-dock-head">
        <span>Avatar IA</span>
        <span className="dot" />
      </div>
      <AvatarVisual
        active={active}
        syncPaused={syncPaused}
        canControlPause={canControlPause}
        onTogglePause={onTogglePause}
      />
    </section>
  );
}
