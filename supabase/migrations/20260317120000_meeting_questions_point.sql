alter table public.meeting_questions
  add column if not exists presentation_point_id text;

-- Select sigue denegado a anon (using false). Lectura solo vía API de servidor
-- filtrada por token de presentador o token HMAC del propio participante.
