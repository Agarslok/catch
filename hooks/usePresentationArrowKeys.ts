"use client";

import { useEffect, useRef } from "react";

type Nav = { next: () => void; prev: () => void };

type Options = {
  enabled: boolean;
  nav: Nav;
  blocked?: boolean;
  onEscape?: () => void;
};

/** Flechas ←/→ como en monitor y LiveMeetingApp; Escape opcional. */
export function usePresentationArrowKeys({ enabled, nav, blocked = false, onEscape }: Options) {
  const navRef = useRef(nav);
  navRef.current = nav;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onEscape?.();
        return;
      }
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest('input, textarea, select, [contenteditable="true"]')
      ) {
        return;
      }
      if (blocked) return;
      event.preventDefault();
      if (event.key === "ArrowRight") navRef.current.next();
      else navRef.current.prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, blocked, onEscape]);
}
