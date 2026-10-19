-- Nombre visible del visitante (MVP demo). El participant_id sigue siendo el identificador único.

alter table public.meeting_participants
  add column if not exists display_name text;

comment on column public.meeting_participants.display_name is
  'Nombre ingresado por el visitante al unirse; no es clave primaria.';
