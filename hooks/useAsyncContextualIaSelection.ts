"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

export type ContextualAnchor = { x: number; y: number };

type Options = {
  zoneRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  onTextSelected: (text: string, anchor: ContextualAnchor) => void;
};

function invalidSelectionTarget(node: Node | null, zone: HTMLElement | null): boolean {
  const el = node?.nodeType === 1 ? (node as Element) : node?.parentElement;
  if (!el || !zone) return true;
  if (!zone.contains(el)) return true;
  if (
    el.closest(
      ".popover-seleccion-ia, .contextual-ia-veil, .catch-modal-veil, .rail, .ask, input, textarea, select, button, .chart-detail, .chart-wrap canvas",
    )
  ) {
    return true;
  }
  return false;
}

function readSelectionInZone(zone: HTMLElement): { text: string; anchor: ContextualAnchor } | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount < 1) return null;
  const range = sel.getRangeAt(0);
  if (invalidSelectionTarget(range.commonAncestorContainer, zone)) return null;
  const text = sel.toString().replace(/\s+/g, " ").trim();
  if (text.length < 2) return null;
  const rect = range.getBoundingClientRect();
  if (!rect.width && !rect.height) return null;
  return {
    text,
    anchor: { x: rect.left + rect.width / 2, y: rect.top },
  };
}

export function useAsyncContextualIaSelection({
  zoneRef,
  enabled,
  onTextSelected,
}: Options) {
  const [popover, setPopover] = useState<ContextualAnchor | null>(null);
  const pendingText = useRef("");
  const onTextSelectedRef = useRef(onTextSelected);
  onTextSelectedRef.current = onTextSelected;

  const hidePopover = useCallback(() => {
    setPopover(null);
    pendingText.current = "";
  }, []);

  const dismissPopover = useCallback(() => {
    hidePopover();
    try {
      window.getSelection()?.removeAllRanges();
    } catch {
      /* ignore */
    }
  }, [hidePopover]);

  useEffect(() => {
    if (!enabled) {
      hidePopover();
      return;
    }

    const zone = zoneRef.current;
    if (!zone) return;

    const onMouseUp = () => {
      requestAnimationFrame(() => {
        const currentZone = zoneRef.current;
        if (!currentZone) return;
        const picked = readSelectionInZone(currentZone);
        if (!picked) {
          hidePopover();
          return;
        }
        pendingText.current = picked.text;
        setPopover(picked.anchor);
      });
    };

    zone.addEventListener("mouseup", onMouseUp);
    return () => zone.removeEventListener("mouseup", onMouseUp);
  }, [enabled, zoneRef, hidePopover]);

  const confirmAsk = useCallback(() => {
    const text = pendingText.current;
    const anchor = popover;
    if (!text || !anchor) return;
    onTextSelectedRef.current(text, anchor);
    dismissPopover();
  }, [popover, dismissPopover]);

  return { popover, confirmAsk, dismissPopover };
}
