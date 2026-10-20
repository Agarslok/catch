-- Catch producción: migraciones pendientes después de meeting_realtime + catch_cuelrmx_patch.
-- Ejecutar una sola vez en Supabase → SQL Editor (idempotente donde aplica IF NOT EXISTS).
-- Origen: supabase/migrations/20260314120000 … 20260320120000

-- ========== 20260314120000_meeting_interaction_analytics.sql ==========

create table if not exists public.meeting_interaction_events (
  id uuid primary key default gen_random_uuid(),
  client_event_id text not null,
  meeting_id text not null,
  session_id text not null,
  participant_id text not null,
  participant_role text not null check (participant_role in ('presenter', 'visitor')),
  event_type text not null,
  chart_id text,
  chart_type text,
  element_id text,
  element_label text,
  action text,
  metadata jsonb not null default '{}'::jsonb,
  schema_version text not null default '1.0',
  created_at timestamptz not null default now(),
  constraint meeting_interaction_events_client_event_id_key unique (client_event_id)
);

create index if not exists idx_mie_meeting_created
  on public.meeting_interaction_events (meeting_id, created_at desc);

create index if not exists idx_mie_meeting_session
  on public.meeting_interaction_events (meeting_id, session_id);

create index if not exists idx_mie_meeting_participant
  on public.meeting_interaction_events (meeting_id, participant_id);

create index if not exists idx_mie_meeting_event_type
  on public.meeting_interaction_events (meeting_id, event_type);

create table if not exists public.meeting_session_registry (
  session_id text primary key,
  meeting_id text not null,
  participant_id text not null,
  participant_role text not null check (participant_role in ('presenter', 'visitor')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  last_seen_at timestamptz,
  display_name text,
  schema_version text not null default '1.0'
);

alter table public.meeting_session_registry
  add column if not exists last_seen_at timestamptz;
alter table public.meeting_session_registry
  add column if not exists display_name text;

create index if not exists idx_msr_meeting_joined
  on public.meeting_session_registry (meeting_id, joined_at desc);

alter table public.meeting_interaction_events enable row level security;
alter table public.meeting_session_registry enable row level security;

drop policy if exists "mie_insert_anon" on public.meeting_interaction_events;
create policy "mie_insert_anon"
  on public.meeting_interaction_events for insert to anon, authenticated
  with check (true);

drop policy if exists "mie_select_meeting" on public.meeting_interaction_events;
create policy "mie_select_meeting"
  on public.meeting_interaction_events for select to anon, authenticated
  using (true);

drop policy if exists "msr_insert_anon" on public.meeting_session_registry;
create policy "msr_insert_anon"
  on public.meeting_session_registry for insert to anon, authenticated
  with check (true);

drop policy if exists "msr_update_anon" on public.meeting_session_registry;
create policy "msr_update_anon"
  on public.meeting_session_registry for update to anon, authenticated
  using (true) with check (true);

drop policy if exists "msr_select_meeting" on public.meeting_session_registry;
create policy "msr_select_meeting"
  on public.meeting_session_registry for select to anon, authenticated
  using (true);

do $$
begin
  alter publication supabase_realtime add table public.meeting_interaction_events;
exception when duplicate_object then null;
end $$;

-- ========== 20260315120000_meeting_session_features.sql ==========

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

create policy "meeting_questions_insert_anon"
  on public.meeting_questions for insert to anon, authenticated
  with check (true);

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

-- ========== 20260316120000_meeting_session_script.sql ==========

alter table public.meeting_state
  add column if not exists current_point_id text,
  add column if not exists script jsonb,
  add column if not exists presented_charts jsonb not null default '[]'::jsonb;

-- ========== 20260317120000_meeting_questions_point.sql ==========

alter table public.meeting_questions
  add column if not exists presentation_point_id text;

-- ========== 20260318120000_meeting_private_questions_hardening.sql ==========

create table if not exists public.meeting_participants (
  meeting_id text not null,
  participant_id text not null,
  token_hash text not null,
  created_at timestamptz not null default now(),
  display_name text,
  primary key (meeting_id, participant_id)
);

alter table public.meeting_participants
  add column if not exists display_name text;

create unique index if not exists idx_meeting_participants_token
  on public.meeting_participants (meeting_id, token_hash);

alter table public.meeting_participants enable row level security;

drop policy if exists "meeting_participants_deny_all" on public.meeting_participants;
create policy "meeting_participants_deny_all"
  on public.meeting_participants
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "meeting_questions_insert_anon" on public.meeting_questions;

drop policy if exists "meeting_questions_deny_client" on public.meeting_questions;
create policy "meeting_questions_deny_client"
  on public.meeting_questions
  for all
  to anon, authenticated
  using (false)
  with check (false);

do $$
begin
  alter publication supabase_realtime drop table public.meeting_questions;
exception
  when undefined_object then null;
  when others then null;
end $$;

-- ========== 20260319120000_meeting_clarity_vote_explorar.sql ==========

alter table public.meeting_clarity_votes
  drop constraint if exists meeting_clarity_votes_vote_check;

alter table public.meeting_clarity_votes
  add constraint meeting_clarity_votes_vote_check
  check (vote in ('claro', 'duda', 'glosario', 'explorar'));

-- ========== 20260320120000_meeting_moderator_queue.sql ==========

alter table public.meeting_questions
  add column if not exists request_kind text not null default 'written_question',
  add column if not exists source text not null default 'unknown',
  add column if not exists idempotency_key text,
  add column if not exists dismissed_at timestamptz;

alter table public.meeting_questions drop constraint if exists meeting_questions_status_check;
alter table public.meeting_questions
  add constraint meeting_questions_status_check
  check (status in ('open', 'answered', 'dismissed'));

alter table public.meeting_questions drop constraint if exists meeting_questions_request_kind_check;
alter table public.meeting_questions
  add constraint meeting_questions_request_kind_check
  check (
    request_kind in (
      'written_question',
      'assistant_to_presenter',
      'ai_escalation',
      'oral_turn',
      'clarity_doubt'
    )
  );

alter table public.meeting_questions alter column text drop not null;

create unique index if not exists idx_meeting_questions_idempotency
  on public.meeting_questions (meeting_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_meeting_questions_meeting_status_created
  on public.meeting_questions (meeting_id, status, created_at asc);

-- ========== 20260323120000_meeting_prep_faqs.sql ==========
-- Netlify no ejecuta migraciones. Pegar en SQL Editor o npm run db:push.

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

-- ========== 20260324120000_reset_meeting_session.sql ==========
-- Misma función que la migración. Ejecutar en SQL Editor si el botón de reinicio responde 503.
