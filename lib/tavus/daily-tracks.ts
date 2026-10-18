import type { DailyCall, DailyEventObjectTrack, DailyParticipant } from "@daily-co/daily-js";

function isRemoteParticipant(participant: DailyParticipant | undefined | null): boolean {
  return Boolean(participant && !participant.local);
}

function attachTrack(
  track: MediaStreamTrack | undefined,
  el: HTMLMediaElement | null,
  kind: "video" | "audio",
) {
  if (!track || !el) return;
  el.srcObject = new MediaStream([track]);
  el.muted = false;
  if (kind === "audio" && el instanceof HTMLAudioElement) el.volume = 1;
  void el.play().catch(() => {});
}

export function syncExistingRemoteTracks(
  call: DailyCall,
  getVideoEl: () => HTMLVideoElement | null,
  getAudioEl: () => HTMLAudioElement | null,
) {
  const participants = call.participants();
  for (const p of Object.values(participants)) {
    if (!isRemoteParticipant(p)) continue;
    attachTrack(p.tracks?.video?.persistentTrack, getVideoEl(), "video");
    attachTrack(p.tracks?.audio?.persistentTrack, getAudioEl(), "audio");
  }
}

/** Enlaza video y audio remotos (PAL Tavus) a elementos HTML. */
export function wireDailyRemoteTracks(
  call: DailyCall,
  getVideoEl: () => HTMLVideoElement | null,
  getAudioEl: () => HTMLAudioElement | null,
): () => void {
  const attach = (ev: DailyEventObjectTrack) => {
    if (!isRemoteParticipant(ev.participant) || !ev.track) return;
    if (ev.track.kind === "video") {
      attachTrack(ev.track, getVideoEl(), "video");
      return;
    }
    if (ev.track.kind === "audio") {
      attachTrack(ev.track, getAudioEl(), "audio");
    }
  };

  call.on("track-started", attach);

  return () => {
    call.off("track-started", attach);
  };
}

/** Une la sala Tavus solo para recibir video/audio del PAL (Gemini habla vía echo). */
export async function joinTavusDailyCall(
  call: DailyCall,
  join: { url: string; token?: string },
): Promise<void> {
  await call.join({
    url: join.url,
    ...(join.token ? { token: join.token } : {}),
    startVideoOff: true,
    startAudioOff: true,
  });

  try {
    await call.setLocalAudio(false);
  } catch {
    /* ignore */
  }
}
