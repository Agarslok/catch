/**
 * Regenera lib/monitor-data/datos.json desde el HTML del monitor.
 * Uso: node scripts/extract-monitor-datos.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const root = process.cwd();
const html = readFileSync(
  join(root, "public/monitor-v3/monitor-en-vivo-catch.html"),
  "utf8",
);
const m = html.match(/const DATOS = (\{[\s\S]*?\});\s*const CLIENTE/);
if (!m) {
  console.error("No se encontró DATOS en el HTML.");
  process.exit(1);
}
const j = JSON.parse(m[1]);
mkdirSync(join(root, "lib/monitor-data"), { recursive: true });
writeFileSync(join(root, "lib/monitor-data/datos.json"), JSON.stringify(j));
console.log(
  `OK: ${j.empresas.length} empresas, edición ${j.edicion}, bimestres ${j.bimestres.length}`,
);
