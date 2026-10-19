alter table public.meeting_session_registry
  add column if not exists display_name text;

alter table public.meeting_session_registry
  add column if not exists last_seen_at timestamptz;

comment on column public.meeting_session_registry.display_name is
  'Nombre ingresado al unirse; no es identificador.';
comment on column public.meeting_session_registry.last_seen_at is
  'Última actividad persistida; sirve para duración si aún no hay session.leave.';
