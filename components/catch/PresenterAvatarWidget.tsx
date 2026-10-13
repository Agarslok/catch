"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AVATAR_VIDEO } from "@/lib/avatar/config";
import { useAvatarVideoPlayback } from "@/hooks/useAvatarVideoPlayback";

const KEY_POS = "catch-live-ai-pos";

type Props = {
  /** Reproducir video cuando el panel está abierto o en dock móvil */
  playWhenOpen?: boolean;
  /** Cliente móvil: panel fijo abajo, siempre activo cuando visible */
  mobileClient?: boolean;
};

export function PresenterAvatarWidget({
  playWhenOpen = true,
  mobileClient = false,
}: Props) {
  const [open, setOpen] = useState(mobileClient);
  const [pinned, setPinned] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);
  const dragRef = useRef<{
    id: number;
    sx: number;
    sy: number;
    ox: number;
    oy: number;
    moved: boolean;
  } | null>(null);

  const shouldPlay = mobileClient || (playWhenOpen && open);
  const { ref: videoRef, play } = useAvatarVideoPlayback(shouldPlay);

  const placePanel = useCallback(() => {
    const w = widgetRef.current;
    if (!w) return;
    const r = w.getBoundingClientRect();
    w.classList.toggle("below", r.top + r.height / 2 < window.innerHeight / 2);
    w.classList.toggle("left", r.left + r.width / 2 < window.innerWidth / 2);
  }, []);

  const setOpenState = useCallback(
    (o: boolean) => {
      setOpen(o);
      if (o) requestAnimationFrame(placePanel);
    },
    [placePanel],
  );

  useEffect(() => {
    if (mobileClient) return;
    try {
      const raw = localStorage.getItem(KEY_POS);
      const p = raw ? (JSON.parse(raw) as { x: number; y: number }) : null;
      const w = widgetRef.current;
      if (p && w) {
        w.style.left = `${p.x}px`;
        w.style.top = `${p.y}px`;
        w.style.right = "auto";
        w.style.bottom = "auto";
        placePanel();
      }
    } catch {
      /* ignore */
    }
  }, [mobileClient, placePanel]);

  const savePos = useCallback(() => {
    const w = widgetRef.current;
    if (!w) return;
    const r = w.getBoundingClientRect();
    try {
      localStorage.setItem(
        KEY_POS,
        JSON.stringify({ x: Math.round(r.left), y: Math.round(r.top) }),
      );
    } catch {
      /* ignore */
    }
  }, []);

  const applyPos = useCallback(
    (x: number, y: number) => {
      const w = widgetRef.current;
      if (!w) return;
      const r = w.getBoundingClientRect();
      const m = 8;
      x = Math.min(Math.max(m, x), window.innerWidth - r.width - m);
      y = Math.min(Math.max(m, y), window.innerHeight - r.height - m);
      w.style.left = `${x}px`;
      w.style.top = `${y}px`;
      w.style.right = "auto";
      w.style.bottom = "auto";
      placePanel();
    },
    [placePanel],
  );

  if (mobileClient) {
    return (
      <div className="ai-widget mobile-client open" ref={widgetRef}>
        <div className="ai-pwrap">
          <div
            className="ai-panel"
            role="dialog"
            aria-label="Avatar IA de Catch"
            style={{ ["--ai-ratio" as string]: AVATAR_VIDEO.ratio }}
          >
            <div className="ai-head">
              <span>Avatar Catch · IA</span>
            </div>
            <div className="ai-media">
              <video
                ref={videoRef}
                src={AVATAR_VIDEO.src}
                poster={AVATAR_VIDEO.poster || undefined}
                playsInline
                loop
                preload="metadata"
                onClick={() => void play()}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`ai-widget${open ? " open" : ""}`}
      ref={widgetRef}
      onMouseEnter={() => {
        if (!dragRef.current) setOpenState(true);
      }}
      onMouseLeave={() => {
        if (!pinned && !dragRef.current) setOpenState(false);
      }}
    >
      <div className="ai-pwrap">
        <div
          className="ai-panel"
          role="dialog"
          aria-label="Avatar IA de Catch"
          style={{ ["--ai-ratio" as string]: AVATAR_VIDEO.ratio }}
        >
          <div className="ai-head">
            <span>Avatar Catch · IA</span>
            <button
              type="button"
              className="ai-close"
              aria-label="Cerrar avatar"
              onClick={() => {
                setPinned(false);
                setOpenState(false);
              }}
            >
              ×
            </button>
          </div>
          <div className="ai-media">
            <video
              ref={videoRef}
              src={AVATAR_VIDEO.src}
              poster={AVATAR_VIDEO.poster || undefined}
              playsInline
              loop
              preload="metadata"
              onClick={() => void play()}
            />
          </div>
        </div>
      </div>
      <button
        type="button"
        className="ai-fab"
        aria-label="Avatar IA"
        aria-expanded={open}
        onClick={() => {
          if (suppressClick.current) return;
          if (open && pinned) {
            setPinned(false);
            setOpenState(false);
          } else {
            setPinned(true);
            setOpenState(true);
          }
        }}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          const r = widgetRef.current?.getBoundingClientRect();
          if (!r) return;
          dragRef.current = {
            id: e.pointerId,
            sx: e.clientX,
            sy: e.clientY,
            ox: r.left,
            oy: r.top,
            moved: false,
          };
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
        }}
        onPointerMove={(e) => {
          const d = dragRef.current;
          if (!d || e.pointerId !== d.id) return;
          const dx = e.clientX - d.sx;
          const dy = e.clientY - d.sy;
          if (!d.moved && Math.hypot(dx, dy) > 5) {
            d.moved = true;
            widgetRef.current?.classList.add("dragging");
            if (!pinned) setOpenState(false);
          }
          if (d.moved) applyPos(d.ox + dx, d.oy + dy);
        }}
        onPointerUp={(e) => {
          const d = dragRef.current;
          if (!d || e.pointerId !== d.id) return;
          const moved = d.moved;
          dragRef.current = null;
          widgetRef.current?.classList.remove("dragging");
          try {
            e.currentTarget.releasePointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
          if (moved) {
            suppressClick.current = true;
            setTimeout(() => {
              suppressClick.current = false;
            }, 150);
            savePos();
          }
        }}
        onPointerCancel={(e) => {
          dragRef.current = null;
          widgetRef.current?.classList.remove("dragging");
          try {
            e.currentTarget.releasePointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
        }}
      >
        <span className="ai-fab-label">Avatar IA</span>
      </button>
    </div>
  );
}
