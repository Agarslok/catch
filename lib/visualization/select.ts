import { getCatalogEntry } from "./catalog";
import {
  VISUALIZATION_IDS,
  type AnalyticalIntent,
  type DatasetSnapshot,
  type RecommendationInput,
  type VisualizationId,
  type VisualizationRecommendation,
} from "./types";

type ScoredCandidate = {
  id: VisualizationId;
  score: number;
  reason: string;
};

const STATUS_BONUS: Record<string, number> = {
  implemented: 30,
  partial: 10,
  planned: -100,
};

function scoreCandidate(
  id: VisualizationId,
  snapshot: DatasetSnapshot,
  intent: AnalyticalIntent,
  preferImplemented: boolean,
): ScoredCandidate | null {
  const entry = getCatalogEntry(id);
  const missingRequired = entry.requiredFields.filter(
    (f) => !snapshot.availableFieldKinds.has(f),
  );
  if (missingRequired.length > 0) return null;

  let score = 0;
  const reasons: string[] = [];

  switch (intent) {
    case "compare_categories": {
      if (id === "bar_horizontal" && snapshot.categoryCount >= 3) {
        score += 40;
        reasons.push("Varias categorías comparables en ranking.");
      }
      if (id === "column" && snapshot.categoryCount <= 10) {
        score += 35;
        reasons.push("Categorías o periodos discretos.");
      }
      if (id === "pie" && snapshot.categoryCount > 7) score -= 50;
      if (id === "donut" && snapshot.categoryCount <= 6) score += 20;
      break;
    }
    case "compare_periods": {
      if (!snapshot.hasOrderedTime) break;
      if (id === "column") {
        score += 45;
        reasons.push("Periodos ordenados en eje X.");
      }
      if (id === "line") score += 40;
      break;
    }
    case "trend_over_time": {
      if (!snapshot.hasOrderedTime) return null;
      if (id === "line") {
        score += 55;
        reasons.push("Tendencia temporal.");
      }
      if (id === "area") score += 45;
      if (id === "column") score += 30;
      break;
    }
    case "composition": {
      if (snapshot.categoryCount <= 6 && (id === "donut" || id === "pie")) {
        score += id === "donut" ? 48 : 42;
        reasons.push("Partes de un total con pocas categorías.");
      }
      if (id === "bar_stacked" && snapshot.seriesCount > 1) score += 40;
      break;
    }
    case "distribution": {
      if (id === "histogram") {
        score += 50;
        reasons.push("Distribución de valores numéricos.");
      }
      break;
    }
    case "correlation": {
      if (snapshot.numericFieldCount >= 3 && id === "bubble") {
        score += 55;
        reasons.push("Tres variables numéricas.");
      } else if (snapshot.numericFieldCount >= 2 && id === "scatter") {
        score += 50;
        reasons.push("Dos variables numéricas.");
      } else return null;
      break;
    }
    case "intensity_grid": {
      if (id === "heatmap") {
        score += 50;
        reasons.push("Intensidad en dos dimensiones.");
      } else return null;
      break;
    }
    case "hierarchy_breakdown": {
      if (!snapshot.hasHierarchy) return null;
      if (id === "treemap") {
        score += 55;
        reasons.push("Jerarquía con valores.");
      }
      break;
    }
    case "geographic_compare": {
      if (!snapshot.hasGeo) return null;
      if (id === "geo_map") {
        score += 55;
        reasons.push("Datos geográficos compatibles.");
      }
      break;
    }
    case "single_kpi": {
      if (id === "kpi") {
        score += 50;
        reasons.push("Métrica única.");
      }
      break;
    }
    case "progress_to_goal": {
      if (!snapshot.hasTarget) return null;
      if (id === "progress") {
        score += 55;
        reasons.push("Valor con meta definida.");
      }
      break;
    }
    case "funnel_conversion": {
      if (!snapshot.hasFunnelStages) return null;
      if (id === "funnel") {
        score += 55;
        reasons.push("Etapas ordenadas.");
      }
      break;
    }
    default:
      break;
  }

  if (snapshot.seriesCount > 1 && id === "bar_grouped") {
    score += 45;
    reasons.push("Varias series por categoría.");
  }

  score += STATUS_BONUS[entry.implementationStatus] ?? 0;
  if (preferImplemented && entry.implementationStatus === "partial") score += 15;

  if (score <= 0 && reasons.length === 0) return null;

  return {
    id,
    score,
    reason: reasons.join(" ") || entry.selectionHints[0] || entry.name,
  };
}

export function recommendVisualization(
  input: RecommendationInput,
): VisualizationRecommendation {
  const candidates: ScoredCandidate[] = [];

  for (const id of VISUALIZATION_IDS) {
    const scored = scoreCandidate(
      id,
      input.dataset,
      input.intent,
      input.preferImplemented ?? true,
    );
    if (scored) candidates.push(scored);
  }

  candidates.sort((a, b) => b.score - a.score);

  const best = candidates[0];
  const fallbackId: VisualizationId = input.dataset.hasOrderedTime
    ? "column"
    : "bar_horizontal";
  const chosen = best?.id ?? fallbackId;
  const entry = getCatalogEntry(chosen);

  const viable = candidates.filter(
    (c) => getCatalogEntry(c.id).implementationStatus !== "planned",
  );

  return {
    visualizationId: chosen,
    datasetKey: input.dataset.key,
    explanation:
      best?.reason ??
      (entry.implementationStatus === "planned"
        ? "Ninguna visualización parcial encaja; opción catalogada por defecto."
        : "Selección por compatibilidad de datos e intención."),
    confidence: best && best.score >= 45 ? "high" : best ? "medium" : "low",
    alternatives: viable.slice(1, 4).map((c) => c.id),
  };
}

const INTENT_PATTERNS: { intent: AnalyticalIntent; test: (q: string) => boolean }[] = [
  {
    intent: "trend_over_time",
    test: (q) =>
      /(evoluci[oó]n|tendencia|trimestral|serie|hist[oó]rico)/i.test(q),
  },
  {
    intent: "compare_periods",
    test: (q) => /(periodo|bimestre|mes|a[nñ]o|versus|vs\b)/i.test(q),
  },
  {
    intent: "composition",
    test: (q) =>
      /(composici[oó]n|proporci[oó]n|parte del total|mix|reparto)/i.test(q),
  },
  {
    intent: "distribution",
    test: (q) => /(distribuci[oó]n|histograma|frecuencia|salario)/i.test(q),
  },
  {
    intent: "correlation",
    test: (q) =>
      /(relaci[oó]n|correlaci|frente a|dispersi|burbuj)/i.test(q),
  },
  {
    intent: "intensity_grid",
    test: (q) => /(heatmap|matriz|d[ií]a.*hora|hora.*d[ií]a)/i.test(q),
  },
  {
    intent: "hierarchy_breakdown",
    test: (q) => /(jerarqu|treemap|unidades|anidad)/i.test(q),
  },
  {
    intent: "geographic_compare",
    test: (q) => /(mapa|geogr[aá]f|regi[oó]n)/i.test(q),
  },
  {
    intent: "single_kpi",
    test: (q) => /(indicador|kpi|valor actual|tasa actual)/i.test(q),
  },
  {
    intent: "progress_to_goal",
    test: (q) => /(meta|objetivo|cumplimiento|progreso)/i.test(q),
  },
  {
    intent: "funnel_conversion",
    test: (q) => /(funnel|etapa|pipeline|conversi[oó]n|candidat)/i.test(q),
  },
  {
    intent: "compare_categories",
    test: (q) =>
      /(departamento|municipio|categor|mayor|menor|ranking|top)/i.test(q),
  },
];

export function inferIntentFromQuestion(
  question: string,
  snapshot: DatasetSnapshot,
): AnalyticalIntent {
  const q = question.trim();
  for (const { intent, test } of INTENT_PATTERNS) {
    if (!test(q)) continue;
    if (intent === "geographic_compare" && !snapshot.hasGeo) continue;
    if (intent === "hierarchy_breakdown" && !snapshot.hasHierarchy) continue;
    if (intent === "progress_to_goal" && !snapshot.hasTarget) continue;
    if (intent === "funnel_conversion" && !snapshot.hasFunnelStages) continue;
    if (
      (intent === "trend_over_time" || intent === "compare_periods") &&
      !snapshot.hasOrderedTime
    ) {
      continue;
    }
    return intent;
  }

  if (snapshot.hasOrderedTime) return "trend_over_time";
  if (snapshot.seriesCount > 1) return "compare_categories";
  if (snapshot.categoryCount <= 6) return "composition";
  return "compare_categories";
}

export function inferIntentForDataset(
  question: string,
  snapshot: DatasetSnapshot,
): AnalyticalIntent {
  if (
    snapshot.key === "demo.departments_turnover" ||
    (/departamento/i.test(question) && snapshot.categoryCount >= 2)
  ) {
    return "compare_categories";
  }

  if (snapshot.key === "guanajuato.hiring_mix") return "composition";

  if (
    snapshot.key === "guanajuato.turnover_bimonthly" &&
    /(evoluci|tendencia|bimestral)/i.test(question)
  ) {
    return "trend_over_time";
  }

  if (
    snapshot.key === "guanajuato.turnover_municipality" &&
    snapshot.seriesCount > 1 &&
    /(controlada|serie|compar)/i.test(question)
  ) {
    return "compare_categories";
  }

  return inferIntentFromQuestion(question, snapshot);
}
