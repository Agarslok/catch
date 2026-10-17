-- Preguntas anónimas, claridad por sección y estado global ampliado (Monitor HTML → Next)

alter table public.meeting_state
  add column if not exists presentation_status text not null default 'live'
    check (presentation_status in ('live', 'paused')),
  add column if not exists global_view jsonb not null default '{}'::jsonb,
  add column if not exists event_seq bigint not null default 0;

create table if not exists public.meeting_questions (
  id uuid primary key default gen_random_uuid(),
  meeting_id text not null,
  participant_id text not null,
  section_key text not null default 'general',
  section_label text not null default 'General',
  text text not null check (char_length(text) between 1 and 600),
  status text not null default 'open' check (status in ('open', 'answered')),
  answer_text text,
  created_at timestamptz not null default now(),
  answered_at timestamptz
);

create index if not exists idx_meeting_questions_meeting
  on public.meeting_questions (meeting_id, created_at desc);

create table if not exists public.meeting_clarity_votes (
  meeting_id text not null,
  section_key text not null,
  participant_id text not null,
  vote text not null check (vote in ('claro', 'duda', 'glosario')),
  updated_at timestamptz not null default now(),
  primary key (meeting_id, section_key, participant_id)
);

create index if not exists idx_meeting_clarity_meeting
  on public.meeting_clarity_votes (meeting_id, section_key);

alter table public.meeting_questions enable row level security;
alter table public.meeting_clarity_votes enable row level security;

-- Inserción: cualquier cliente anónimo de la reunión
create policy "meeting_questions_insert_anon"
  on public.meeting_questions for insert to anon, authenticated
  with check (true);

-- Lectura: solo filas propias (participante) vía participant_id en JWT no disponible;
-- MVP: permitir select solo con meeting_id (presentador usa API servidor). Participantes no listan todas.
create policy "meeting_questions_select_own_insert_only"
  on public.meeting_questions for select to anon, authenticated
  using (false);

create policy "meeting_clarity_upsert_anon"
  on public.meeting_clarity_votes for insert to anon, authenticated
  with check (true);

create policy "meeting_clarity_update_anon"
  on public.meeting_clarity_votes for update to anon, authenticated
  using (true) with check (true);

create policy "meeting_clarity_select_denied_client"
  on public.meeting_clarity_votes for select to anon, authenticated
  using (false);

do $$
begin
  alter publication supabase_realtime add table public.meeting_questions;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.meeting_clarity_votes;
exception when duplicate_object then null;
end $$;
