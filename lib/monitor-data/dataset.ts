import datosJson from "./datos.json";
import type { DatosCapitalHumano, Empresa } from "./types";
import { DEMO_CLIENT_ID } from "./types";

/**
 * Dataset embebido del monitor (demo compartido).
 * Origen: extracción de `DATOS` en monitor-en-vivo-catch.html.
 * Regenerar: `node scripts/extract-monitor-datos.mjs`
 */
const DATOS = datosJson as DatosCapitalHumano;

export function getMonitorDataset(): DatosCapitalHumano {
  return DATOS;
}

export function getMonitorEmpresas(): Empresa[] {
  return DATOS.empresas;
}

export function getDemoClientId(): string {
  return DEMO_CLIENT_ID;
}

export function getDemoClient(): Empresa {
  const cli = DATOS.empresas.find((e) => e.id === DEMO_CLIENT_ID);
  if (!cli) {
    throw new Error(`Demo client ${DEMO_CLIENT_ID} not found in dataset`);
  }
  return cli;
}

export function getDatasetDisclaimer(): string {
  return (
    "Dataset de demostración compartido del Monitor Capital Humano; " +
    `cliente fijo ${DEMO_CLIENT_ID}; no hay aislamiento por meetingId en esta versión.`
  );
}
