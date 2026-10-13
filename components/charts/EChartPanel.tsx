"use client";

import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";

type Props = {
  option: EChartsOption;
  height?: number;
  onEvents?: Record<string, (params: unknown) => void>;
};

export function EChartPanel({ option, height = 280, onEvents }: Props) {
  return (
    <ReactECharts
      option={option}
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
      onEvents={onEvents}
      notMerge
      lazyUpdate
    />
  );
}
