import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Lectura en runtime (no sustituir por `next.config` env). */
function readServerEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (raw == null) return undefined;
  const trimmed = String(raw).trim();
  return trimmed || undefined;
}

export type SupabaseServiceEnvStatus = {
  hasPublicUrl: boolean;
  hasServiceRoleKey: boolean;
};

export function supabaseServiceEnvStatus(): SupabaseServiceEnvStatus {
  return {
    hasPublicUrl: Boolean(readServerEnv("NEXT_PUBLIC_SUPABASE_URL")),
    hasServiceRoleKey: Boolean(readServerEnv("SUPABASE_SERVICE_ROLE_KEY")),
  };
}

export type SupabaseServiceConfigErrorCode =
  | "missing_supabase_public_url"
  | "missing_service_role_key"
  | "missing_supabase_public_url_and_service_role";

export function supabaseServiceConfigErrorCode(
  status: SupabaseServiceEnvStatus,
): SupabaseServiceConfigErrorCode {
  if (!status.hasPublicUrl && !status.hasServiceRoleKey) {
    return "missing_supabase_public_url_and_service_role";
  }
  if (!status.hasPublicUrl) return "missing_supabase_public_url";
  return "missing_service_role_key";
}

function logSupabaseServiceEnvFailure(context: string, status: SupabaseServiceEnvStatus): void {
  console.info("[supabase-service-env]", {
    context,
    hasPublicUrl: status.hasPublicUrl,
    hasServiceRoleKey: status.hasServiceRoleKey,
  });
}

export function getSupabaseServerClient(): SupabaseClient | null {
  const url = readServerEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = readServerEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !key) return null;
  return createClient(url, key);
}

/** Bypass RLS for rutas de moderador validadas en el servidor. */
export function getSupabaseServiceClient(context = "getSupabaseServiceClient"): SupabaseClient | null {
  const url = readServerEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = readServerEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    logSupabaseServiceEnvFailure(context, supabaseServiceEnvStatus());
    return null;
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
