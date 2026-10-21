"use client";

type Props = {
  muted: boolean;
  volume: number;
  onToggleMute: () => void;
  onVolumeChange: (volume: number) => void;
  syncPaused?: boolean;
  canControlPause?: boolean;
  onTogglePause?: () => void;
  className?: string;
};

export function AvatarVideoControls({
  muted,
  volume,
  onToggleMute,
  onVolumeChange,
  syncPaused = false,
  canControlPause = false,
  onTogglePause,
  className,
}: Props) {
  return (
    <div
      className={["ai-audio-ctrl", className].filter(Boolean).join(" ")}
      role="group"
      aria-label="Audio del avatar"
    >
      {canControlPause && (
        <button
          type="button"
          className="ai-audio-pause"
          onClick={onTogglePause}
          aria-pressed={syncPaused}
          aria-label={syncPaused ? "Reanudar video" : "Pausar video"}
        >
          {syncPaused ? "▶" : "⏸"}
        </button>
      )}
      <button
        type="button"
        className="ai-audio-mute"
        onClick={onToggleMute}
        aria-pressed={muted}
        aria-label={muted ? "Activar sonido" : "Silenciar"}
      >
        {muted ? "🔇" : "🔊"}
      </button>
      <input
        type="range"
        className="ai-audio-volume"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
        aria-label="Volumen"
      />
    </div>
  );
}
