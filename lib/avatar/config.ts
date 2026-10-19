/** Ruta pública del video del avatar (voz incluida cuando el navegador lo permite). */
export const AVATAR_VIDEO = {
  src: process.env.NEXT_PUBLIC_AVATAR_VIDEO_SRC ?? "/avatar_video.mp4",
  poster: process.env.NEXT_PUBLIC_AVATAR_VIDEO_POSTER ?? "",
  ratio: "16/9" as const,
  loop: true,
  controls: false,
};

/** MP4 local desactivado por defecto; pon `NEXT_PUBLIC_AVATAR_MP4_ENABLED=1` para volver a usarlo. */
export const AVATAR_MP4_ENABLED =
  process.env.NEXT_PUBLIC_AVATAR_MP4_ENABLED === "1" ||
  process.env.NEXT_PUBLIC_AVATAR_MP4_ENABLED === "true";
