"use client";

import { AvatarVisual } from "@/components/catch/AvatarVisual";
import type { TavusRaiseHandResult } from "@/lib/tavus/raise-hand";
type Props = {
  active?: boolean;
  syncPaused?: boolean;
  canControlPause?: boolean;
  onTogglePause?: () => void;
  tavusUi?: "bar" | "dock";
  onMicToggle?: () => void;
  micListening?: boolean;
  micSupported?: boolean;
  showRaiseHand?: boolean;
  raiseHandActive?: boolean;
  onRaiseHand?: (result: TavusRaiseHandResult) => void;
};

export function AvatarDockVideo({
  active = true,
  syncPaused = false,
  canControlPause = false,
  onTogglePause,
  tavusUi = "bar",
  onMicToggle,
  micListening,
  micSupported,
  showRaiseHand,
  raiseHandActive,
  onRaiseHand,
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
        tavusUi={tavusUi}
        onMicToggle={onMicToggle}
        micListening={micListening}
        micSupported={micSupported}
        showRaiseHand={showRaiseHand}
        raiseHandActive={raiseHandActive}
        onRaiseHand={onRaiseHand}
      />
    </section>
  );
}
