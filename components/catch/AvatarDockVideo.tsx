"use client";

import { AVATAR_VIDEO } from "@/lib/avatar/config";
import { useAvatarVideoPlayback } from "@/hooks/useAvatarVideoPlayback";

type Props = {
  active?: boolean;
};

export function AvatarDockVideo({ active = true }: Props) {
  const { ref, play } = useAvatarVideoPlayback(active);

  return (
    <section
      className="ai-dock"
      aria-label="Avatar IA de Catch"
      style={{ ["--ai-ratio" as string]: AVATAR_VIDEO.ratio }}
    >
      <div className="ai-dock-head">
        <span>Avatar IA</span>
        <span className="dot" />
      </div>
      <div className="ai-media">
        <video
          ref={ref}
          src={AVATAR_VIDEO.src}
          poster={AVATAR_VIDEO.poster || undefined}
          playsInline
          loop
          preload="metadata"
          controls={AVATAR_VIDEO.controls}
          onClick={() => void play()}
        />
      </div>
    </section>
  );
}
