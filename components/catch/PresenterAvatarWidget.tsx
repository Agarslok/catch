"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AvatarVisual } from "@/components/catch/AvatarVisual";
import type { TavusRaiseHandResult } from "@/lib/tavus/raise-hand";

const KEY_POS = "catch-live-ai-pos";
const KEY_POS_MOBILE = "catch-live-ai-pos-mobile";
const DRAG_THRESHOLD = 6;

type Props = {
  playWhenOpen?: boolean;
  /** Móvil: toque para abrir/cerrar, FAB arrastrable, sin hover. */
  mobileMode?: boolean;
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

function getViewportBounds() {
  const vv = window.visualViewport;
  const width = vv?.width ?? window.innerWidth;
  const height = vv?.height ?? window.innerHeight;
  const offsetTop = vv?.offsetTop ?? 0;
  const offsetLeft = vv?.offsetLeft ?? 0;
  const margin = 10;
  return {
    minX: offsetLeft + margin,
    minY: offsetTop + margin,
    maxX: offsetLeft + width - margin,
    maxY: offsetTop + height - margin,
  };
}

export function PresenterAvatarWidget({
  playWhenOpen = true,
  mobileMode = false,
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
  const [open, setOpen] = useState(false);
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

  const storageKey = mobileMode ? KEY_POS_MOBILE : KEY_POS;

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

  const applyPos = useCallback(
    (x: number, y: number) => {
      const w = widgetRef.current;
      if (!w) return;
      const r = w.getBoundingClientRect();
      const { minX, minY, maxX, maxY } = getViewportBounds();
      const clampedX = Math.min(Math.max(minX, x), maxX - r.width);
      const clampedY = Math.min(Math.max(minY, y), maxY - r.height);
      w.style.left = `${clampedX}px`;
      w.style.top = `${clampedY}px`;
      w.style.right = "auto";
      w.style.bottom = "auto";
      placePanel();
    },
    [placePanel],
  );

  const clampToViewport = useCallback(() => {
    const w = widgetRef.current;
    if (!w) return;
    const r = w.getBoundingClientRect();
    applyPos(r.left, r.top);
  }, [applyPos]);

  const savePos = useCallback(() => {
    const w = widgetRef.current;
    if (!w) return;
    const r = w.getBoundingClientRect();
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ x: Math.round(r.left), y: Math.round(r.top) }),
      );
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const p = raw ? (JSON.parse(raw) as { x: number; y: number }) : null;
      const w = widgetRef.current;
      if (p && w) {
        w.style.left = `${p.x}px`;
        w.style.top = `${p.y}px`;
        w.style.right = "auto";
        w.style.bottom = "auto";
        requestAnimationFrame(() => {
          clampToViewport();
          placePanel();
        });
      } else if (w && mobileMode) {
        requestAnimationFrame(() => {
          const r = w.getBoundingClientRect();
          const x = 12;
          const bottomLift = 60;
          const y = Math.max(12, window.innerHeight - r.height - bottomLift);
          applyPos(x, y);
        });
      }
    } catch {
      /* ignore */
    }
  }, [storageKey, clampToViewport, placePanel, mobileMode, applyPos]);

  useEffect(() => {
    if (!mobileMode) return;
    const onReflow = () => clampToViewport();
    window.addEventListener("resize", onReflow);
    window.visualViewport?.addEventListener("resize", onReflow);
    window.visualViewport?.addEventListener("scroll", onReflow);
    return () => {
      window.removeEventListener("resize", onReflow);
      window.visualViewport?.removeEventListener("resize", onReflow);
      window.visualViewport?.removeEventListener("scroll", onReflow);
    };
  }, [mobileMode, clampToViewport]);

  const onFabPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
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
  };

  const onFabPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.id) return;
    e.preventDefault();
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      d.moved = true;
      widgetRef.current?.classList.add("dragging");
      if (open) {
        setPinned(false);
        setOpenState(false);
      }
    }
    if (d.moved) applyPos(d.ox + dx, d.oy + dy);
  };

  const endFabPointer = (e: React.PointerEvent<HTMLButtonElement>) => {
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
      }, 180);
      savePos();
    }
  };

  const onFabClick = () => {
    if (suppressClick.current) return;
    if (mobileMode) {
      if (open) {
        setPinned(false);
        setOpenState(false);
      } else {
        setPinned(true);
        setOpenState(true);
      }
      return;
    }
    if (open && pinned) {
      setPinned(false);
      setOpenState(false);
    } else {
      setPinned(true);
      setOpenState(true);
    }
  };

  return (
    <div
      className={`ai-widget${open ? " open" : ""}${mobileMode ? " mobile-mode" : ""}`}
      ref={widgetRef}
      onMouseEnter={() => {
        if (mobileMode || dragRef.current) return;
        setOpenState(true);
      }}
      onMouseLeave={() => {
        if (mobileMode || pinned || dragRef.current) return;
        setOpenState(false);
      }}
    >
      <div className="ai-pwrap">
        <div
          className="ai-panel"
          role="dialog"
          aria-label="Avatar IA de Catch"
          aria-hidden={!open}
          style={{ ["--ai-ratio" as string]: "16/9" }}
          onClick={(e) => {
            if (!mobileMode || !open) return;
            const t = e.target as HTMLElement;
            if (t.closest("button, input, a, [data-tavus-controls]")) return;
            setPinned(false);
            setOpenState(false);
          }}
        >
          <div className="ai-head">
            <span>Avatar Catch · IA</span>
            {!mobileMode && (
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
            )}
          </div>
          <AvatarVisual
            active={playWhenOpen && open}
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
          {mobileMode && open && (
            <span className="ai-tap-hint">Toca el video para ocultar</span>
          )}
        </div>
      </div>
      <button
        type="button"
        className="ai-fab"
        aria-label="Avatar IA"
        aria-expanded={open}
        onClick={onFabClick}
        onPointerDown={onFabPointerDown}
        onPointerMove={onFabPointerMove}
        onPointerUp={endFabPointer}
        onPointerCancel={endFabPointer}
      >
        <span className="ai-fab-label">{open ? "Ocultar avatar" : "Avatar IA"}</span>
      </button>
    </div>
  );
}
