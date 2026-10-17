"use client";

import { useEffect, useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { type ChartKind, type MunFilter } from "@/lib/data/guanajuato-2026";
import {
  barItemStyle,
  cartesianGrid,
  categoryAxis,
  CHART_TOKENS,
  horizontalBarItemStyle,
  paletteColor,
  pieSeriesBase,
  valueAxisPercent,
} from "@/lib/charts";
import type { ChartInteractionState } from "@/lib/charts/types";
import {
  buildHiringMixContext,
  buildMunicipalityContext,
  buildTenureContext,
  buildTurnoverBimonthlyContext,
} from "@/lib/charts/insights/chapter-contexts";
import {
  computePointNarrative,
  richAxisTooltip,
  richItemTooltip,
} from "@/lib/charts/insights/compute";
import type { SeriesContext } from "@/lib/charts/insights/types";
import type { InteractionEventType } from "@/lib/analytics/types";
import { ChartDetailPanel } from "./ChartDetailPanel";
import { EChartPanel } from "./EChartPanel";

type ChartEvents = {
  onSelect?: (payload: Record<string, unknown>) => void;
};

type AnalyticsTrack = (
  type: InteractionEventType,
  fields?: {
    chart_id?: string;
    chart_type?: string;
    element_id?: string;
    element_label?: string;
    action?: string;
    metadata?: Record<string, unknown>;
  },
) => void;

type Props = {
  chapter: number;
  beat: number;
  munFilter: MunFilter;
  chartKind: ChartKind;
  isPresenter: boolean;
  compact?: boolean;
  height?: number;
  onMunFilterChange?: (k: MunFilter) => void;
  onChartKindChange?: (k: ChartKind) => void;
  events?: ChartEvents;
  trackAnalytics?: AnalyticsTrack;
};

function barInteraction(
  category: string,
  selectedCategory: string | null,
  presentationHighlight: boolean,
): ChartInteractionState {
  if (selectedCategory && category === selectedCategory) return "selected";
  if (presentationHighlight) return "highlighted";
  if (selectedCategory && category !== selectedCategory) return "muted";
  return "default";
}

export function ChapterCharts({
  chapter,
  beat,
  munFilter,
  chartKind,
  isPresenter,
  compact = false,
  height,
  onMunFilterChange,
  onChartKindChange,
  events,
  trackAnalytics,
}: Props) {
  const chartHeight = height ?? (compact ? 200 : 280);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [detailPointId, setDetailPointId] = useState<string | null>(null);

  const seriesContext = useMemo((): SeriesContext => {
    if (chapter === 0) return buildTurnoverBimonthlyContext(beat);
    if (chapter === 1) return buildMunicipalityContext(munFilter, chartKind);
    if (chapter === 2) return buildTenureContext(chartKind);
    return buildHiringMixContext(beat);
  }, [chapter, beat, munFilter, chartKind]);

  useEffect(() => {
    setSelectedCategory(null);
    setDetailPointId(null);
  }, [chapter, beat, munFilter, chartKind]);

  useEffect(() => {
    trackAnalytics?.("chart.viewed", {
      chart_id: seriesContext.chartId,
      chart_type: seriesContext.elementKind,
      metadata: {
        chapter,
        beat,
        munFilter,
        chartKind,
        mode: seriesContext.mode,
      },
    });
  }, [
    seriesContext.chartId,
    seriesContext.elementKind,
    seriesContext.mode,
    chapter,
    beat,
    munFilter,
    chartKind,
    trackAnalytics,
  ]);

  const detailNarrative = useMemo(() => {
    if (!detailPointId) return null;
    return computePointNarrative(seriesContext, detailPointId);
  }, [detailPointId, seriesContext]);

  const turnoverOption = useMemo((): EChartsOption => {
    const ctx = seriesContext;
    const labels = ctx.points.map((p) => p.label);
    const values = ctx.points.map((p) => p.value);
    return {
      tooltip: richAxisTooltip(ctx),
      grid: cartesianGrid(),
      xAxis: categoryAxis(labels),
      yAxis: valueAxisPercent(10),
      series: [
        {
          type: "bar",
          emphasis: { focus: "self" },
          data: values.map((v, i) => {
            const name = labels[i];
            const isCurrent = i === values.length - 1;
            const presHighlight = beat === 1 && i === 0;
            const interaction = barInteraction(name, selectedCategory, presHighlight);
            const fill = isCurrent
              ? CHART_TOKENS.primary
              : interaction === "default"
                ? CHART_TOKENS.neutral
                : undefined;
            return {
              value: v,
              name,
              itemStyle: barItemStyle({ interaction, fill }),
            };
          }),
        },
      ],
    };
  }, [seriesContext, beat, selectedCategory]);

  const municipalityOption = useMemo((): EChartsOption => {
    const ctx = seriesContext;
    const names = ctx.points.map((p) => p.label);
    const values = ctx.points.map((p) => p.value);

    if (chartKind === "pie") {
      return {
        ...pieSeriesBase({
          radius: ["35%", "62%"],
          donut: true,
          data: values.map((v, i) => ({
            name: names[i],
            value: v,
            itemStyle: {
              color: paletteColor(i),
              opacity:
                selectedCategory && names[i] !== selectedCategory ? 0.45 : 1,
              borderWidth: selectedCategory === names[i] ? 3 : 2,
              borderColor:
                selectedCategory === names[i]
                  ? CHART_TOKENS.selected
                  : CHART_TOKENS.white,
            },
          })),
        }),
        tooltip: richItemTooltip(ctx),
      };
    }

    return {
      tooltip: richAxisTooltip(ctx),
      grid: cartesianGrid({ left: 120, right: 24, top: 16, bottom: 24 }),
      xAxis: {
        type: "value",
        max: 14,
        axisLine: { show: false },
        splitLine: { lineStyle: { color: CHART_TOKENS.line, type: "dashed" } },
        axisLabel: { color: CHART_TOKENS.meta },
      },
      yAxis: {
        type: "category",
        data: names,
        inverse: true,
        axisLine: { lineStyle: { color: CHART_TOKENS.line } },
        axisTick: { show: false },
        axisLabel: { color: CHART_TOKENS.meta },
      },
      series: [
        {
          type: "bar",
          emphasis: { focus: "self" },
          data: values.map((v, i) => {
            const name = names[i];
            const interaction = barInteraction(
              name,
              selectedCategory,
              beat === 1 && i === 0,
            );
            return {
              value: v,
              name,
              itemStyle: horizontalBarItemStyle({ interaction }),
            };
          }),
        },
      ],
    };
  }, [seriesContext, chartKind, beat, selectedCategory]);

  const tenureBarOption = useMemo((): EChartsOption => {
    const ctx = seriesContext;
    const labels = ctx.points.map((p) => p.label);
    const values = ctx.points.map((p) => p.value);
    return {
      tooltip: richAxisTooltip(ctx),
      grid: cartesianGrid(),
      xAxis: categoryAxis(labels),
      yAxis: valueAxisPercent(25),
      series: [
        {
          type: "bar",
          emphasis: { focus: "self" },
          data: values.map((v, i) => {
            const name = labels[i];
            const interaction = barInteraction(
              name,
              selectedCategory,
              beat === 1 && i < 3,
            );
            return {
              value: v,
              name,
              itemStyle: barItemStyle({ interaction }),
            };
          }),
        },
      ],
    };
  }, [seriesContext, beat, selectedCategory]);

  const tenurePieOption = useMemo((): EChartsOption => {
    const ctx = seriesContext;
    return {
      ...pieSeriesBase({
        radius: "62%",
        data: ctx.points.map((p, i) => ({
          name: p.label,
          value: p.value,
          itemStyle: {
            color: paletteColor(i),
            opacity: selectedCategory && p.label !== selectedCategory ? 0.45 : 1,
            borderWidth: selectedCategory === p.label ? 3 : 2,
            borderColor:
              selectedCategory === p.label ? CHART_TOKENS.selected : CHART_TOKENS.white,
          },
        })),
      }),
      tooltip: richItemTooltip(ctx),
    };
  }, [seriesContext, selectedCategory]);

  const hiringPieOption = useMemo((): EChartsOption => {
    const ctx = seriesContext;
    const slices = [
      { name: "Cubrir bajas", value: ctx.points[0]?.value ?? 0, color: CHART_TOKENS.primary },
      {
        name: "Posiciones nuevas",
        value: ctx.points[1]?.value ?? 0,
        color: CHART_TOKENS.neutral,
      },
    ];
    return {
      ...pieSeriesBase({
        radius: ["40%", "68%"],
        donut: true,
        labelFormatter: "{b}\n{d}%",
        data: slices.map((s) => ({
          name: s.name,
          value: s.value,
          itemStyle: {
            color: s.color,
            opacity: selectedCategory && s.name !== selectedCategory ? 0.45 : 1,
            borderWidth: selectedCategory === s.name ? 3 : 2,
            borderColor:
              selectedCategory === s.name ? CHART_TOKENS.selected : CHART_TOKENS.white,
          },
        })),
      }),
      tooltip: richItemTooltip(ctx),
    };
  }, [seriesContext, selectedCategory]);

  const onChartClick = (params: unknown) => {
    const p = params as { name?: string; value?: number; seriesType?: string };
    const category = p.name ?? "";
    const point = seriesContext.points.find((pt) => pt.label === category);
    if (!point) return;

    if (detailPointId === point.id) {
      trackAnalytics?.("detail.closed", {
        chart_id: seriesContext.chartId,
        chart_type: seriesContext.elementKind,
        element_id: point.id,
        element_label: point.label,
        action: "toggle_close",
      });
      closeDetail();
      return;
    }

    setDetailPointId(point.id);
    setSelectedCategory(category);
    trackAnalytics?.("element.clicked", {
      chart_id: seriesContext.chartId,
      chart_type: seriesContext.elementKind,
      element_id: point.id,
      element_label: point.label,
      action: "select",
    });
    trackAnalytics?.("detail.opened", {
      chart_id: seriesContext.chartId,
      chart_type: seriesContext.elementKind,
      element_id: point.id,
      element_label: point.label,
    });
    events?.onSelect?.({
      chartType: p.seriesType ?? "bar",
      category,
      value: p.value,
      localDetail: true,
    });
  };

  const closeDetail = () => {
    if (detailPointId) {
      const pt = seriesContext.points.find((p) => p.id === detailPointId);
      trackAnalytics?.("detail.closed", {
        chart_id: seriesContext.chartId,
        chart_type: seriesContext.elementKind,
        element_id: detailPointId,
        element_label: pt?.label,
        action: "close_button",
      });
    }
    setDetailPointId(null);
    setSelectedCategory(null);
  };

  const tabs = (
    <div className="chart-tabs">
      {(
        [
          ["total", "Total"],
          ["controlada", "Controlada"],
          ["nocontrolada", "No controlada"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          className={munFilter === id ? "on" : ""}
          aria-pressed={munFilter === id}
          onClick={() => onMunFilterChange?.(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const kindToggle = (
    <div className="chart-tabs chart-tabs--secondary">
      {(
        [
          ["bar", "Barras"],
          ["pie", "Torta"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          className={chartKind === id ? "on" : ""}
          aria-pressed={chartKind === id}
          onClick={() => onChartKindChange?.(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const detail = (
    <ChartDetailPanel
      narrative={detailNarrative}
      contentKey={detailPointId}
      onClose={closeDetail}
    />
  );

  const wrapClass = `chart-wrap${compact ? " chart-wrap--compact" : ""}`;

  if (chapter === 0) {
    return (
      <div className={wrapClass}>
        <span className="chart-title">Rotación bimestral total (%) · 2025 y 2026</span>
        <EChartPanel
          option={turnoverOption}
          height={chartHeight}
          onEvents={{ click: onChartClick }}
        />
        {detail}
      </div>
    );
  }

  if (chapter === 1) {
    return (
      <div className={wrapClass}>
        {!isPresenter && !compact && tabs}
        {!compact && kindToggle}
        <span className="chart-title">Rotación por municipio (%) · Ene–Feb 2026</span>
        <EChartPanel
          option={municipalityOption}
          height={chartHeight}
          onEvents={{ click: onChartClick }}
        />
        {detail}
      </div>
    );
  }

  if (chapter === 2) {
    return (
      <div className={wrapClass}>
        {!compact && kindToggle}
        <span className="chart-title">Bajas por antigüedad (% del total de bajas)</span>
        <EChartPanel
          option={chartKind === "pie" ? tenurePieOption : tenureBarOption}
          height={chartHeight}
          onEvents={{ click: onChartClick }}
        />
        {beat === 1 && !compact && (
          <p className="chart-note">Menos de un año: 60% de las bajas (acumulado 0–12 meses).</p>
        )}
        {detail}
      </div>
    );
  }

  return (
    <div className={wrapClass}>
      <span className="chart-title">Contrataciones Ene–Feb 2026</span>
      <EChartPanel
        option={hiringPieOption}
        height={chartHeight}
        onEvents={{ click: onChartClick }}
      />
      {!compact && (
        <p className="chart-note">Gráfica de torta: 8 de 10 contrataciones repusieron bajas.</p>
      )}
      {detail}
    </div>
  );
}
