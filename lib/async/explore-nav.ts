import type { ScriptPointKind, SessionScript } from "@/lib/meeting/script-types";
import { getPointById, getPointIndex, isNavigableKind } from "@/lib/meeting/script";

/** Pasos del guion que no se muestran en exploración asincrónica. */
export const ASYNC_EXPLORE_SKIP_KINDS: ScriptPointKind[] = ["full_sheet", "clarity_check"];

export function isAsyncExploreNavigableKind(kind: ScriptPointKind): boolean {
  return isNavigableKind(kind) && !ASYNC_EXPLORE_SKIP_KINDS.includes(kind);
}

export function adjacentAsyncExploreIndex(
  script: SessionScript,
  from: number,
  direction: 1 | -1,
): number {
  let i = from + direction;
  while (i >= 0 && i < script.points.length) {
    if (isAsyncExploreNavigableKind(script.points[i].kind)) return i;
    i += direction;
  }
  return from;
}

export function resolveAsyncExplorePointId(script: SessionScript, pointId: string): string {
  const point = getPointById(script, pointId);
  if (!point || isAsyncExploreNavigableKind(point.kind)) return pointId;
  const idx = getPointIndex(script, point.id);
  const forward = adjacentAsyncExploreIndex(script, idx, 1);
  if (forward !== idx) return script.points[forward].id;
  const back = adjacentAsyncExploreIndex(script, idx, -1);
  return script.points[back].id;
}

export function asyncExploreNavigablePointCount(script: SessionScript): number {
  return script.points.filter((p) => isAsyncExploreNavigableKind(p.kind)).length;
}

export function asyncExploreStepNumber(script: SessionScript, pointId: string): number {
  const idx = getPointIndex(script, pointId);
  let n = 0;
  for (let i = 0; i <= idx; i++) {
    if (isAsyncExploreNavigableKind(script.points[i].kind)) n += 1;
  }
  return n;
}
