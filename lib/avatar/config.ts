/** Ruta pública del video del avatar (voz incluida cuando el navegador lo permite). */
export const AVATAR_VIDEO = {
  src: process.env.NEXT_PUBLIC_AVATAR_VIDEO_SRC ?? "/avatar.mp4",
  poster: process.env.NEXT_PUBLIC_AVATAR_VIDEO_POSTER ?? "",
  ratio: "16/9" as const,
  loop: true,
  controls: false,
};
