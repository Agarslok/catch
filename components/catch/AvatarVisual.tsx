"use client";

import { useEffect, type ReactNode } from "react";
import { AvatarVideoControls } from "@/components/catch/AvatarVideoControls";
import { IaHandButton } from "@/components/catch/IaHandButton";
import { IaMicButton } from "@/components/catch/IaMicButton";
import { performTavusRaiseHand, type TavusRaiseHandResult } from "@/lib/tavus/raise-hand";
import { AVATAR_MP4_ENABLED, AVATAR_VIDEO } from "@/lib/avatar/config";
import { useAvatarVideoPlayback } from "@/hooks/useAvatarVideoPlayback";
import { useTavusCvi } from "@/components/catch/TavusCviProvider";
import type { TavusCviStatus } from "@/hooks/useTavusCviSession";

type Props = {
  active?: boolean;
  syncPaused?: boolean;
  canControlPause?: boolean;
  onTogglePause?: () => void;
  onTavusSessionChange?: (active: boolean) => void;
  slideNav?: ReactNode;
  /** bar: controles Tavus arriba del video; dock: botones sobre el video (modo asincrónico). */
  tavusUi?: "bar" | "dock";
  onMicToggle?: () => void;
  micListening?: boolean;
  micSupported?: boolean;
  showRaiseHand?: boolean;
  raiseHandActive?: boolean;
  onRaiseHand?: (result: TavusRaiseHandResult) => void;
};

function statusLabel(status: TavusCviStatus, error: string | null): string {
  switch (status) {
    case "starting":
      return "Iniciando sesión Tavus…";
    case "connected":
      return "Frida conectada (Tavus CVI)";
    case "error":
      return error || "Error de conexión Tavus";
    case "ended":
      return "Sesión Tavus finalizada";
    default:
      return AVATAR_MP4_ENABLED ? "Video local (MP4)" : "Inicia sesión Tavus para ver a Frida";
  }
}

export function AvatarVisual({
  active = true,
  syncPaused = false,
  canControlPause = false,
  onTogglePause,
  onTavusSessionChange,
  slideNav,
  tavusUi = "bar",
  onMicToggle,
  micListening = false,
  micSupported = false,
  showRaiseHand = false,
  raiseHandActive = false,
  onRaiseHand,
}: Props) {
  const tavus = useTavusCvi();
  const tavusSessionOpen =
    tavus.mode === "tavus" &&
    (tavus.status === "starting" || tavus.status === "connected");
  const showTavusStream =
    tavus.mode === "tavus" && (tavus.status === "connected" || tavus.status === "starting");
  const showLocalVideo =
    AVATAR_MP4_ENABLED &&
    (tavus.mode === "local" || tavus.status === "error" || tavus.status === "ended");
  const localActive = showLocalVideo && active;

  const { ref: localVideoRef, play, muted, volume, toggleMute, onVolumeChange } =
    useAvatarVideoPlayback(localActive, syncPaused);

  const tavusOpts = { meetingId: tavus.meetingId, presenterToken: tavus.presenterToken };

  useEffect(() => {
    onTavusSessionChange?.(tavus.tavusActive);
  }, [onTavusSessionChange, tavus.tavusActive]);

  const tavusDock = tavusUi === "dock";

  const dockControls =
    tavus.canStartTavus && tavusDock ? (
      <div className="ai-dock-controls" role="group" aria-label="Controles del avatar">
        {tavus.mode === "local" && tavus.status !== "starting" && (
          <button
            type="button"
            className="ai-dock-controls__btn ai-dock-controls__btn--primary"
            disabled={!tavus.configured}
            onClick={() => void tavus.startSession(tavusOpts)}
          >
            {tavus.configured ? "Iniciar Frida" : "Tavus no configurado"}
          </button>
        )}
        {(tavus.status === "connected" || tavus.status === "starting") && (
          <button
            type="button"
            className="ai-dock-controls__btn"
            onClick={() => void tavus.endSession(tavusOpts)}
          >
            Finalizar
          </button>
        )}
        {showRaiseHand ? (
          <IaHandButton
            active={raiseHandActive}
            onClick={() => {
              const result = performTavusRaiseHand({
                tavusActive: tavus.tavusActive,
                interruptSpeech: tavus.interruptSpeech,
                speakEcho: tavus.speakEcho,
              });
              onRaiseHand?.(result);
            }}
          />
        ) : null}
        {micSupported && onMicToggle ? (
          <IaMicButton variant="dock" listening={micListening} onClick={onMicToggle} />
        ) : null}
      </div>
    ) : null;

  return (
    <>
      {tavus.canStartTavus && !tavusDock && (
        <div className="ai-tavus-bar" role="status" aria-live="polite">
          <span className={`ai-tavus-pill ai-tavus-pill--${tavus.status}`}>
            {statusLabel(tavus.status, tavus.error)}
          </span>
          <div className="ai-tavus-actions">
            {tavus.mode === "local" && tavus.status !== "starting" && (
              <button
                type="button"
                className="ai-tavus-btn"
                disabled={!tavus.configured}
                onClick={() => void tavus.startSession(tavusOpts)}
              >
                {tavus.configured ? "Iniciar Frida (Tavus)" : "Tavus no configurado"}
              </button>
            )}
            {(tavus.status === "connected" || tavus.status === "starting") && (
              <button type="button" className="ai-tavus-btn" onClick={() => void tavus.endSession(tavusOpts)}>
                Finalizar sesión
              </button>
            )}
            {AVATAR_MP4_ENABLED &&
              tavus.mode === "tavus" &&
              tavus.status !== "connected" &&
              tavus.status !== "starting" && (
                <button
                  type="button"
                  className="ai-tavus-btn ai-tavus-btn--ghost"
                  onClick={() => void tavus.endSession(tavusOpts)}
                >
                  Volver a MP4
                </button>
              )}
          </div>
        </div>
      )}
      <div className="ai-media">
        {dockControls}
        {slideNav}
        {showLocalVideo ? (
          <video
            ref={localVideoRef}
            src={AVATAR_VIDEO.src}
            poster={AVATAR_VIDEO.poster || undefined}
            playsInline
            loop
            muted
            preload="metadata"
            controls={AVATAR_VIDEO.controls}
            onClick={() => void play()}
          />
        ) : showTavusStream ? (
          <>
            <video
              ref={tavus.videoRef}
              className="ai-tavus-video"
              playsInline
              autoPlay
            />
            {tavusSessionOpen && (
              <audio ref={tavus.audioRef} autoPlay playsInline className="ai-tavus-audio" />
            )}
          </>
        ) : (
          <>
            <video
              ref={localVideoRef}
              className="ai-avatar-mp4-reserve"
              src={AVATAR_MP4_ENABLED ? AVATAR_VIDEO.src : undefined}
              poster={AVATAR_VIDEO.poster || undefined}
              playsInline
              loop
              muted
              hidden
              aria-hidden="true"
              tabIndex={-1}
            />
            {!AVATAR_MP4_ENABLED && (
              <div className="ai-avatar-idle" aria-hidden={showTavusStream}>
                <span>Frida · Tavus CVI</span>
              </div>
            )}
          </>
        )}
        {showLocalVideo && (
          <AvatarVideoControls
            muted={muted}
            volume={volume}
            onToggleMute={toggleMute}
            onVolumeChange={onVolumeChange}
            syncPaused={syncPaused}
            canControlPause={canControlPause}
            onTogglePause={onTogglePause}
          />
        )}
      </div>
    </>
  );
}
