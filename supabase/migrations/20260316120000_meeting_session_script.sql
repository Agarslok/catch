-- Guion dinámico de sesión, punto actual estable e historial de gráficas presentadas.

alter table public.meeting_state
  add column if not exists current_point_id text,
  add column if not exists script jsonb,
  add column if not exists presented_charts jsonb not null default '[]'::jsonb;

-- El visitante puede leer el estado (incluye script). El filtrado de contenido
-- futuro se aplica en la API de lectura para clientes sin token de presentador.
-- Solo el presentador autorizado escribe (ruta /api/.../state con HMAC).
