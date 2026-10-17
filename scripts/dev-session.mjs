/**
 * Genera un ID de sesión de desarrollo en cada `npm run dev`.
 * El cliente compara este ID y limpia localStorage + alinea el paso global.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";

const root = process.cwd();
const sessionFile = path.join(root, ".catch-dev-session");

const id = crypto.randomBytes(8).toString("hex");
fs.writeFileSync(sessionFile, id, "utf8");

console.log(`[catch] Nueva sesión de desarrollo: ${id}`);
