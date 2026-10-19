import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findPasoIndexForChart } from "./monitor-pasos";
import { planMonitorNarration } from "./monitor-narration-plan";
import {
  buildNarrationCueSegments,
  cancelNarrationPlayback,
  createNarrationPlayback,
  onNarrationReplicaStarted,
  onNarrationReplicaStopped,
  startNarrationPlayback,
} from "./monitor-narration-cues";

describe("narration cues", () => {
  const plantilla = findPasoIndexForChart("plantilla");

  it("al entrar no hay highlight: el primer segmento es solo contexto", () => {
    const plan = planMonitorNarration(plantilla);
    assert.ok(plan.segments.length >= 2);
    assert.equal(plan.segments[0].highlight, null);
    assert.ok(plan.segments[0].text.length > 20);
    const cue = plan.segments[1];
    assert.ok(cue.highlight);
    assert.match(cue.text, /Fíjate en Operativo/i);
    const pb = createNarrationPlayback("exec-1", plantilla, plan.segments);
    const first = startNarrationPlayback(pb);
    assert.ok(first);
    assert.equal(first!.segmentIndex, 0);
    assert.equal(onNarrationReplicaStarted(pb), null);
  });

  it("el highlight aparece al started_speaking del segmento del hallazgo", () => {
    const plan = planMonitorNarration(plantilla);
    const pb = createNarrationPlayback("exec-2", plantilla, plan.segments);
    startNarrationPlayback(pb);
    onNarrationReplicaStarted(pb);
    assert.equal(onNarrationReplicaStopped(pb)?.segmentIndex, 1);
    const highlight = onNarrationReplicaStarted(pb);
    assert.equal(highlight?.category, "Operativo");
    assert.equal(onNarrationReplicaStarted(pb), null);
  });

  it("un stopped sin started no adelanta el hallazgo", () => {
    const plan = planMonitorNarration(plantilla);
    const pb = createNarrationPlayback("exec-3", plantilla, plan.segments);
    startNarrationPlayback(pb);
    assert.equal(onNarrationReplicaStopped(pb), null);
    assert.equal(pb.cursor, 0);
  });

  it("cancelar impide el segmento siguiente", () => {
    const plan = planMonitorNarration(plantilla);
    const pb = createNarrationPlayback("exec-4", plantilla, plan.segments);
    startNarrationPlayback(pb);
    onNarrationReplicaStarted(pb);
    cancelNarrationPlayback(pb);
    assert.equal(onNarrationReplicaStopped(pb), null);
  });

  it("dos hallazgos en la misma narración se activan en orden y sin duplicar", () => {
    const a = {
      chartId: "plantilla" as const,
      category: "Operativo",
      seriesKey: "Distribución",
      datasetIndex: 0,
      index: 0,
    };
    const b = {
      chartId: "plantilla" as const,
      category: "Administrativo",
      seriesKey: "Distribución",
      datasetIndex: 0,
      index: 1,
    };
    const segments = buildNarrationCueSegments("Contexto de la gráfica.", [a, b]);
    assert.equal(segments.length, 3);
    assert.equal(segments[0].highlight, null);
    const pb = createNarrationPlayback("exec-5", plantilla, segments);
    startNarrationPlayback(pb);
    onNarrationReplicaStarted(pb);
    assert.equal(onNarrationReplicaStopped(pb)?.segmentIndex, 1);
    assert.equal(onNarrationReplicaStarted(pb)?.category, "Operativo");
    assert.equal(onNarrationReplicaStopped(pb)?.segmentIndex, 2);
    assert.equal(onNarrationReplicaStarted(pb)?.category, "Administrativo");
    assert.equal(onNarrationReplicaStopped(pb), null);
  });
});
