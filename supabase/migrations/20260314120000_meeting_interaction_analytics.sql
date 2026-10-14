-- Analítica de interacciones (Capital Humano Live · contrato Sofía v1)

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
  schema_version text not null default '1.0'
);

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
