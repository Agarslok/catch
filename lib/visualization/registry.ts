import type { RegisteredComponentKey, ImplementationStatus, VisualizationId } from "./types";
import { VISUALIZATION_CATALOG } from "./catalog";

export type RenderSurface = "presentation.chapter" | "echarts.preset" | "none";

export type RegistryEntry = {
  componentKey: RegisteredComponentKey;
  visualizationId: VisualizationId;
  implementationStatus: ImplementationStatus;
  renderSurface: RenderSurface;
  notes?: string;
};

const PRESENTATION_VIZ_IDS = new Set<VisualizationId>([
  "column",
  "bar_horizontal",
  "donut",
  "pie",
]);

const PRESET_ONLY_VIZ_IDS = new Set<VisualizationId>([
  "bar_grouped",
  "heatmap",
  "scatter",
]);

function resolveRenderSurface(
  id: VisualizationId,
  status: ImplementationStatus,
): RenderSurface {
  if (status === "planned") return "none";
  if (PRESENTATION_VIZ_IDS.has(id)) return "presentation.chapter";
  if (PRESET_ONLY_VIZ_IDS.has(id)) return "echarts.preset";
  if (id === "line") return "echarts.preset";
  return "none";
}

export const VISUALIZATION_REGISTRY: RegistryEntry[] = Object.values(
  VISUALIZATION_CATALOG,
).map((catalog) => ({
  componentKey: catalog.componentKey,
  visualizationId: catalog.id,
  implementationStatus: catalog.implementationStatus,
  renderSurface: resolveRenderSurface(catalog.id, catalog.implementationStatus),
  notes:
    catalog.implementationStatus === "planned"
      ? "Catálogo listo; render pendiente."
      : undefined,
}));

const registryByKey = new Map(
  VISUALIZATION_REGISTRY.map((r) => [r.componentKey, r]),
);
const registryByViz = new Map(
  VISUALIZATION_REGISTRY.map((r) => [r.visualizationId, r]),
);

export function isRegisteredComponentKey(key: string): key is RegisteredComponentKey {
  return registryByKey.has(key as RegisteredComponentKey);
}

export function getRegistryEntryByComponentKey(
  key: RegisteredComponentKey,
): RegistryEntry {
  const entry = registryByKey.get(key);
  if (!entry) throw new Error(`Unregistered component key: ${key}`);
  return entry;
}

export function getRegistryEntryByVisualizationId(
  id: VisualizationId,
): RegistryEntry {
  const entry = registryByViz.get(id);
  if (!entry) throw new Error(`Unregistered visualization: ${id}`);
  return entry;
}

export function assertSafeComponentKey(key: string): RegisteredComponentKey {
  if (!isRegisteredComponentKey(key)) {
    throw new Error(`Component key not allowed: ${key}`);
  }
  return key;
}
