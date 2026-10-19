"use client";

import dynamic from "next/dynamic";
import type { ECharts, EChartsOption } from "echarts";
import { useEffect, useMemo, useRef, useState } from "react";
import { mergeChartOption, statusOverlayGraphic } from "@/lib/charts/options";
import { CATCH_ECHARTS_THEME, registerCatchChartTheme } from "@/lib/charts/theme";
import { usePrefersReducedMotion } from "@/lib/charts/motion";
import type { ChartPanelStatus } from "@/lib/charts/types";
import {
  applyEChartsCategoryHighlight,
  clearEChartsHighlight,
} from "@/lib/monitor-charts/echarts-highlight-runtime";
import type { PresentationHighlightRef } from "@/lib/monitor-charts/chart-highlight-visual";

const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
});

type Props = {
  option: EChartsOption;
  height?: number;
  onEvents?: Record<string, (params: unknown) => void>;
  status?: ChartPanelStatus;
  /** Resaltado de presentación / IA (no muta datos; usa emphasis de ECharts). */
  presentationHighlight?: PresentationHighlightRef | null;
};

export function EChartPanel({
  option,
  height = 280,
  onEvents,
  status = "ready",
  presentationHighlight = null,
}: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const instanceRef = useRef<ECharts | null>(null);
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => {
    void registerCatchChartTheme().then(() => setThemeReady(true));
  }, []);

  const mergedOption = useMemo((): EChartsOption => {
    if (status === "loading" || status === "empty" || status === "error") {
      return mergeChartOption(reducedMotion, {
        graphic: statusOverlayGraphic(status),
        series: [],
      });
    }
    return mergeChartOption(reducedMotion, option);
  }, [option, reducedMotion, status]);

  useEffect(() => {
    const chart = instanceRef.current;
    if (!chart || status !== "ready") return;
    if (!presentationHighlight?.category) {
      clearEChartsHighlight(chart);
      return;
    }
    const timer = window.setTimeout(() => {
      applyEChartsCategoryHighlight(chart, {
        category: presentationHighlight.category!,
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [presentationHighlight, status, mergedOption]);

  useEffect(() => {
    const chart = instanceRef.current;
    if (!chart || status !== "loading") return;
    chart.showLoading({
      text: "Cargando…",
      color: "#2778B1",
      textColor: "#5B6168",
      maskColor: "rgba(255,255,255,0.65)",
    });
    return () => {
      chart.hideLoading();
    };
  }, [status]);

  if (!themeReady) {
    return (
      <div
        className="chart-skeleton"
        style={{ height, width: "100%" }}
        aria-hidden="true"
      />
    );
  }

  return (
    <ReactECharts
      theme={CATCH_ECHARTS_THEME}
      option={mergedOption}
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
      onEvents={onEvents}
      onChartReady={(instance) => {
        instanceRef.current = instance;
      }}
      notMerge={false}
      lazyUpdate
    />
  );
}
