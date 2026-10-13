"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { D1, D2, MU, type ChartKind, type MunFilter } from "@/lib/data/guanajuato-2026";
import { EChartPanel } from "./EChartPanel";

const COLORS = ["#2778B1", "#38AECB", "#C9D6E2", "#1B4F7A", "#5B6168"];

type ChartEvents = {
  onSelect?: (payload: Record<string, unknown>) => void;
};

type Props = {
  chapter: number;
  beat: number;
  munFilter: MunFilter;
  chartKind: ChartKind;
  isPresenter: boolean;
  onMunFilterChange?: (k: MunFilter) => void;
  onChartKindChange?: (k: ChartKind) => void;
  events?: ChartEvents;
};

export function ChapterCharts({
  chapter,
  beat,
  munFilter,
  chartKind,
  isPresenter,
  onMunFilterChange,
  onChartKindChange,
  events,
}: Props) {
  const turnoverOption = useMemo((): EChartsOption => {
    const labels = [...D1.map(([l]) => l), "Ene–Feb 26"];
    const values = [...D1.map(([, v]) => v), 7.24];
    const colors = values.map((_, i) =>
      i === values.length - 1
        ? "#2778B1"
        : beat === 1 && i === 0
          ? "#38AECB"
          : "#C9D6E2",
    );
    return {
      tooltip: { trigger: "axis" },
      grid: { left: 40, right: 16, top: 24, bottom: 48 },
      xAxis: { type: "category", data: labels },
      yAxis: { type: "value", max: 10, axisLabel: { formatter: "{value}%" } },
      series: [
        {
          type: "bar",
          data: values.map((v, i) => ({
            value: beat === 1 || i < D1.length ? v : 0,
            itemStyle: { color: colors[i], borderRadius: [8, 8, 0, 0] },
          })),
        },
      ],
    };
  }, [beat]);

  const municipalityOption = useMemo((): EChartsOption => {
    const idx = ({ controlada: 1, nocontrolada: 2, total: 3 } as const)[munFilter];
    const rows = [...MU].sort((a, b) => (b[idx] as number) - (a[idx] as number));
    const names = rows.map((r) => r[0]);
    const values = rows.map((r) => r[idx] as number);
    if (chartKind === "pie") {
      return {
        tooltip: { trigger: "item", formatter: "{b}: {c}% ({d}%)" },
        legend: { type: "scroll", bottom: 0 },
        series: [
          {
            type: "pie",
            radius: ["35%", "62%"],
            data: values.map((v, i) => ({
              name: names[i],
              value: v,
              itemStyle: { color: COLORS[i % COLORS.length] },
            })),
            emphasis: { scale: true },
          },
        ],
      };
    }
    return {
      tooltip: { trigger: "axis" },
      grid: { left: 120, right: 24, top: 16, bottom: 24 },
      xAxis: { type: "value", max: 14 },
      yAxis: { type: "category", data: names, inverse: true },
      series: [
        {
          type: "bar",
          data: values.map((v, i) => ({
            value: v,
            itemStyle: {
              color: beat === 1 && i === 0 ? "#2778B1" : "#C9D6E2",
              borderRadius: [0, 6, 6, 0],
            },
          })),
        },
      ],
    };
  }, [munFilter, chartKind, beat]);

  const tenureBarOption = useMemo((): EChartsOption => {
    const labels = D2.map(([l]) => l);
    const values = D2.map(([, v]) => v);
    return {
      tooltip: { trigger: "axis" },
      grid: { left: 40, right: 16, top: 24, bottom: 48 },
      xAxis: { type: "category", data: labels },
      yAxis: { type: "value", max: 25, axisLabel: { formatter: "{value}%" } },
      series: [
        {
          type: "bar",
          data: values.map((v, i) => ({
            value: v,
            itemStyle: {
              color: beat === 1 && i < 3 ? "#2778B1" : "#C9D6E2",
              borderRadius: [8, 8, 0, 0],
            },
          })),
        },
      ],
    };
  }, [beat]);

  const tenurePieOption = useMemo((): EChartsOption => {
    return {
      tooltip: { trigger: "item" },
      legend: { bottom: 0 },
      series: [
        {
          type: "pie",
          radius: "62%",
          data: D2.map(([name, value], i) => ({
            name,
            value,
            itemStyle: { color: COLORS[i % COLORS.length] },
          })),
        },
      ],
    };
  }, []);

  const hiringPieOption = useMemo((): EChartsOption => {
    const replacement = beat === 1 ? 80 : 0;
    const growth = beat === 1 ? 20 : 0;
    return {
      tooltip: { trigger: "item" },
      legend: { bottom: 0 },
      series: [
        {
          type: "pie",
          radius: ["40%", "68%"],
          label: { formatter: "{b}\n{d}%" },
          data: [
            { name: "Cubrir bajas", value: replacement, itemStyle: { color: "#2778B1" } },
            { name: "Posiciones nuevas", value: growth, itemStyle: { color: "#C9D6E2" } },
          ],
        },
      ],
    };
  }, [beat]);

  const clickBar = (params: unknown) => {
    const p = params as { name?: string; value?: number; seriesType?: string };
    events?.onSelect?.({
      chartType: p.seriesType ?? "bar",
      category: p.name,
      value: p.value,
    });
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

  if (chapter === 0) {
    return (
      <div className="chart-wrap">
        <span className="chart-title">Rotación bimestral total (%) · 2025 y 2026</span>
        <EChartPanel option={turnoverOption} onEvents={{ click: clickBar }} />
      </div>
    );
  }

  if (chapter === 1) {
    return (
      <div className="chart-wrap">
        {!isPresenter && tabs}
        {kindToggle}
        <span className="chart-title">Rotación por municipio (%) · Ene–Feb 2026</span>
        <EChartPanel option={municipalityOption} onEvents={{ click: clickBar }} />
      </div>
    );
  }

  if (chapter === 2) {
    return (
      <div className="chart-wrap">
        {kindToggle}
        <span className="chart-title">Bajas por antigüedad (% del total de bajas)</span>
        <EChartPanel
          option={chartKind === "pie" ? tenurePieOption : tenureBarOption}
          onEvents={{ click: clickBar }}
        />
        {beat === 1 && (
          <p className="chart-note">Menos de un año: 60% de las bajas (acumulado 0–12 meses).</p>
        )}
      </div>
    );
  }

  return (
    <div className="chart-wrap">
      <span className="chart-title">Contrataciones Ene–Feb 2026</span>
      <EChartPanel option={hiringPieOption} onEvents={{ click: clickBar }} />
      <p className="chart-note">Gráfica de torta: 8 de 10 contrataciones repusieron bajas.</p>
    </div>
  );
}
