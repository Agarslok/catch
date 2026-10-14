"use client";

import { useEffect, useState } from "react";
import type { EChartsOption } from "echarts";

export const CHART_MOTION_MS = {
  state: 280,
  stateUpdate: 320,
  enter: 480,
  enterInitial: 520,
} as const;

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(REDUCED_QUERY);
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return reduced;
}

export function chartAnimationOption(reducedMotion: boolean): Pick<
  EChartsOption,
  | "animation"
  | "animationDuration"
  | "animationDurationUpdate"
  | "animationEasing"
  | "animationEasingUpdate"
> {
  if (reducedMotion) {
    return {
      animation: false,
      animationDuration: 0,
      animationDurationUpdate: 0,
    };
  }
  return {
    animation: true,
    animationDuration: CHART_MOTION_MS.enter,
    animationDurationUpdate: CHART_MOTION_MS.stateUpdate,
    animationEasing: "cubicOut",
    animationEasingUpdate: "cubicOut",
  };
}
