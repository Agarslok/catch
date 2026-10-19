import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { visitorSeesMeeting } from "./monitor-session-phase";
import {
  applyPresenterHistoryPop,
  historyStepFromPhase,
  nextHistoryPushes,
  presenterRailPanel,
} from "./presenter-session-ui";

describe("carga de documentos no se solapa con el informe", () => {
  it("mantiene plantillas durante carga y generación, sin Beneficios/Indicadores/Patrones", () => {
    assert.equal(presenterRailPanel("preparacion"), "templates");
    assert.equal(presenterRailPanel("generando_informe"), "templates");
    assert.equal(
      presenterRailPanel("revision_previa", { generating: true }),
      "templates",
    );
    assert.equal(presenterRailPanel("reunion_activa", { generating: true }), "templates");
    assert.equal(historyStepFromPhase("preparacion"), "carga");
    assert.equal(historyStepFromPhase("generando_informe"), "carga");

    assert.equal(presenterRailPanel("revision_previa"), "faqs");
    assert.equal(presenterRailPanel("listo_para_iniciar"), "faqs");
    assert.equal(presenterRailPanel("reunion_activa"), "live");
    assert.equal(presenterRailPanel("cierre"), "live");
  });
});

describe("atrás desde reunión restaura edición, carga y espera del cliente", () => {
  it("permite volver de en vivo a edición y de edición a carga sin reempujar la reunión", () => {
    const seed = nextHistoryPushes(null, "en_vivo");
    assert.equal(seed.replaceBase, "carga");
    assert.deepEqual(seed.push, ["revision", "en_vivo"]);
    assert.deepEqual(nextHistoryPushes("carga", "revision").push, ["revision"]);
    assert.deepEqual(nextHistoryPushes("revision", "en_vivo").push, ["en_vivo"]);
    assert.deepEqual(nextHistoryPushes("en_vivo", "revision"), {
      replaceBase: null,
      push: [],
    });
    assert.deepEqual(nextHistoryPushes("en_vivo", "carga"), {
      replaceBase: null,
      push: [],
    });

    const toEdit = applyPresenterHistoryPop("revision", "reunion_activa");
    assert.equal(toEdit.applied, true);
    assert.equal(toEdit.phase, "revision_previa");
    assert.equal(toEdit.abortGeneration, false);
    assert.equal(toEdit.visitorWaiting, true);
    assert.equal(visitorSeesMeeting(toEdit.phase), false);
    assert.equal(presenterRailPanel(toEdit.phase), "faqs");

    const toLoad = applyPresenterHistoryPop("carga", "reunion_activa");
    assert.equal(toLoad.applied, true);
    assert.equal(toLoad.phase, "preparacion");
    assert.equal(toLoad.abortGeneration, true);
    assert.equal(toLoad.visitorWaiting, true);
    assert.equal(visitorSeesMeeting(toLoad.phase), false);
    assert.equal(presenterRailPanel(toLoad.phase), "templates");

    const fromEdit = applyPresenterHistoryPop("carga", "revision_previa");
    assert.equal(fromEdit.phase, "preparacion");
    assert.equal(fromEdit.abortGeneration, true);
    assert.equal(presenterRailPanel(fromEdit.phase), "templates");
  });
});
