import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  presenterDashboardReady,
  presenterInPreMeetingReview,
  presenterMayPublishSteps,
  presenterSeesDashboard,
  resolveInitialMonitorSessionPhase,
  visitorSeesMeeting,
} from "./monitor-session-phase";

describe("monitor-session-phase", () => {
  it("visitante solo ve reunión activa o cierre", () => {
    assert.equal(visitorSeesMeeting("preparacion"), false);
    assert.equal(visitorSeesMeeting("revision_previa"), false);
    assert.equal(visitorSeesMeeting("reunion_activa"), true);
    assert.equal(visitorSeesMeeting("cierre"), true);
  });

  it("presentador en revisión ve dashboard pero no publica pasos", () => {
    assert.equal(presenterSeesDashboard("revision_previa"), true);
    assert.equal(presenterMayPublishSteps("revision_previa"), false);
    assert.equal(presenterDashboardReady("reunion_activa"), true);
    assert.equal(presenterInPreMeetingReview("revision_previa"), true);
    assert.equal(presenterInPreMeetingReview("listo_para_iniciar"), true);
  });

  it("migra listo_para_iniciar legacy a revision_previa", () => {
    assert.equal(resolveInitialMonitorSessionPhase("listo_para_iniciar", 0, 0), "revision_previa");
  });
});
