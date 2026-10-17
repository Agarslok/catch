/**
 * Aplica migraciones pendientes al proyecto Catch en Supabase.
 * Requiere la contraseña de Postgres (Dashboard → Project Settings → Database).
 *
 *   set SUPABASE_DB_PASSWORD=...   (PowerShell)
 *   npm run db:push
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const password = process.env.SUPABASE_DB_PASSWORD?.trim();
if (!password) {
  console.error(
    "Falta SUPABASE_DB_PASSWORD (contraseña de Database en Supabase → Project Settings → Database).",
  );
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ref = "cuelrmxihbjybcapscxk";

const result = spawnSync(
  "npx",
  ["supabase", "db", "push", "--project-ref", ref, "-p", password, "--yes"],
  { cwd: root, stdio: "inherit", shell: true, env: process.env },
);

process.exit(result.status ?? 1);
