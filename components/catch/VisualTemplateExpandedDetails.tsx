"use client";

import { useEffect, useState } from "react";
import type { PresenterVisualTemplateMeta } from "@/lib/meeting/presenter-visual-templates";

const TYPING_BUDGET_MS = 1400;
const FAILSAFE_MS = 2000;
const COLOR_REVEAL_DELAY_MS = 60;

type Props = {
  tpl: PresenterVisualTemplateMeta;
  active: boolean;
};

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}

function planTyping(utility: string, script: string) {
  const total = utility.length + script.length;
  if (total === 0) {
    return { tickMs: 16, utilChunk: 1, scriptChunk: 1 };
  }
  const ticks = Math.min(48, Math.max(14, Math.ceil(total / 3)));
  const tickMs = Math.max(8, Math.floor(TYPING_BUDGET_MS / ticks));
  const utilShare = utility.length / total;
  const utilTicks = Math.max(1, Math.round(ticks * utilShare));
  const scriptTicks = Math.max(1, ticks - utilTicks);
  return {
    tickMs,
    utilChunk: Math.max(1, Math.ceil(utility.length / utilTicks)),
    scriptChunk: Math.max(1, Math.ceil(script.length / scriptTicks)),
  };
}

export function VisualTemplateExpandedDetails({ tpl, active }: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const [utilityText, setUtilityText] = useState("");
  const [scriptText, setScriptText] = useState("");
  const [showColors, setShowColors] = useState(false);
  const [typingPhase, setTypingPhase] = useState<"idle" | "utility" | "script" | "done">("idle");

  useEffect(() => {
    if (!active) {
      setUtilityText("");
      setScriptText("");
      setShowColors(false);
      setTypingPhase("idle");
      return;
    }

    let cancelled = false;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const schedule = (fn: () => void, ms: number) => {
      const id = setTimeout(() => {
        if (!cancelled) fn();
      }, ms);
      timeouts.push(id);
    };

    const revealAll = () => {
      if (cancelled) return;
      setUtilityText(tpl.utility);
      setScriptText(tpl.scriptFocus);
      setTypingPhase("done");
      schedule(() => setShowColors(true), COLOR_REVEAL_DELAY_MS);
    };

    if (reducedMotion) {
      revealAll();
      return () => {
        cancelled = true;
        timeouts.forEach(clearTimeout);
      };
    }

    setUtilityText("");
    setScriptText("");
    setShowColors(false);
    setTypingPhase("utility");

    const { tickMs, utilChunk, scriptChunk } = planTyping(tpl.utility, tpl.scriptFocus);
    let utilIdx = 0;
    let scriptIdx = 0;

    const typeUtility = () => {
      if (cancelled) return;
      if (utilIdx < tpl.utility.length) {
        utilIdx = Math.min(tpl.utility.length, utilIdx + utilChunk);
        setUtilityText(tpl.utility.slice(0, utilIdx));
        schedule(typeUtility, tickMs);
        return;
      }
      setTypingPhase("script");
      typeScript();
    };

    const typeScript = () => {
      if (cancelled) return;
      if (scriptIdx < tpl.scriptFocus.length) {
        scriptIdx = Math.min(tpl.scriptFocus.length, scriptIdx + scriptChunk);
        setScriptText(tpl.scriptFocus.slice(0, scriptIdx));
        schedule(typeScript, tickMs);
        return;
      }
      revealAll();
    };

    schedule(typeUtility, 50);
    schedule(revealAll, FAILSAFE_MS);

    return () => {
      cancelled = true;
      timeouts.forEach(clearTimeout);
    };
  }, [active, reducedMotion, tpl.id, tpl.scriptFocus, tpl.utility]);

  const caret = <span className="visual-template-type-caret" aria-hidden="true" />;

  return (
    <div className="visual-template-card__details">
      <p className="visual-template-card__utility">
        {utilityText}
        {typingPhase === "utility" ? caret : null}
      </p>
      <p className="visual-template-card__script">
        <span className="visual-template-card__script-label">Guión sugerido</span>
        {scriptText}
        {typingPhase === "script" ? caret : null}
      </p>
      <ul
        className={`visual-template-colors${showColors ? " visual-template-colors--visible" : ""}`}
        aria-hidden={!showColors}
      >
        {tpl.colors.map((c) => (
          <li key={c.hex + c.label}>
            <span
              className="visual-template-swatch"
              style={{ backgroundColor: c.hex }}
              aria-hidden="true"
            />
            <span className="visual-template-color-label">{c.label}</span>
            <span className="visual-template-color-hex">{c.hex}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
