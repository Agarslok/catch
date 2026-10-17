-- Patch reunión Catch: meeting_state + RLS (ejecutar en el proyecto Supabase de producción)
-- Ejecutar en SQL Editor si meeting_state falta o RLS bloquea inserts.

create table if not exists public.meeting_state (
  meeting_id text primary key,
  current_step int not null default 0 check (current_step >= 0 and current_step <= 32),
  unlocked_step int not null default 0 check (unlocked_step >= 0 and unlocked_step <= 32),
  updated_at timestamptz not null default now()
);

-- meeting_activity ya existe en este proyecto; ampliar event_type si hace falta:
alter table public.meeting_activity drop constraint if exists meeting_activity_event_type_check;
alter table public.meeting_activity add constraint meeting_activity_event_type_check
  check (
    event_type in (
      'CHART_VIEWED',
      'QUESTION_ASKED',
      'CHART_SELECTED',
      'AI_HIGHLIGHT',
      'DECISION_CREATED',
      'AI_RESPONSE',
      'PRESENTATION_STEP'
    )
  );

alter table public.meeting_state enable row level security;
alter table public.meeting_activity enable row level security;

-- meeting_state
drop policy if exists "meeting_state_select_anon" on public.meeting_state;
drop policy if exists "meeting_state_insert_anon" on public.meeting_state;
drop policy if exists "meeting_state_update_anon" on public.meeting_state;
drop policy if exists "catch_meeting_state_select" on public.meeting_state;
drop policy if exists "catch_meeting_state_insert" on public.meeting_state;
drop policy if exists "catch_meeting_state_update" on public.meeting_state;

create policy "catch_meeting_state_select"
  on public.meeting_state for select to anon, authenticated using (true);

create policy "catch_meeting_state_insert"
  on public.meeting_state for insert to anon, authenticated with check (true);

create policy "catch_meeting_state_update"
  on public.meeting_state for update to anon, authenticated using (true) with check (true);

-- meeting_activity (lectura + escritura para la app demo)
drop policy if exists "meeting_activity_select_anon" on public.meeting_activity;
drop policy if exists "meeting_activity_insert_anon" on public.meeting_activity;
drop policy if exists "catch_meeting_activity_select" on public.meeting_activity;
drop policy if exists "catch_meeting_activity_insert" on public.meeting_activity;

create policy "catch_meeting_activity_select"
  on public.meeting_activity for select to anon, authenticated using (true);

create policy "catch_meeting_activity_insert"
  on public.meeting_activity for insert to anon, authenticated with check (true);

do $$
begin
  alter publication supabase_realtime add table public.meeting_state;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.meeting_activity;
exception when duplicate_object then null;
end $$;
