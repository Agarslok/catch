-- Preguntas frecuentes de preparación, aisladas por reunión.
-- Acceso de escritura solo vía API con service role + token de presentador.
-- Netlify NO aplica esta migración: ejecutar en Supabase → SQL Editor
-- o `npm run db:push` (requiere SUPABASE_DB_PASSWORD).

create table if not exists public.meeting_prep_faqs (
  meeting_id text not null,
  id text not null,
  sort_order integer not null default 0,
  question text not null default '',
  answer text not null default '',
  updated_at timestamptz not null default now(),
  primary key (meeting_id, id)
);

create index if not exists idx_meeting_prep_faqs_meeting_sort
  on public.meeting_prep_faqs (meeting_id, sort_order);

alter table public.meeting_prep_faqs enable row level security;

drop policy if exists "meeting_prep_faqs_select_denied_client" on public.meeting_prep_faqs;
create policy "meeting_prep_faqs_select_denied_client"
  on public.meeting_prep_faqs for select to anon, authenticated
  using (false);

drop policy if exists "meeting_prep_faqs_write_denied_client" on public.meeting_prep_faqs;
create policy "meeting_prep_faqs_write_denied_client"
  on public.meeting_prep_faqs for all to anon, authenticated
  using (false) with check (false);

comment on table public.meeting_prep_faqs is
  'FAQ de la reunión. Lectura/escritura por API (service role); no exponer service_role al cliente.';
