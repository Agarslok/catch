-- Meeting sync + activity (apply in Supabase SQL editor or via CLI)

create table if not exists public.meeting_state (
  meeting_id text primary key,
  current_step int not null default 0 check (current_step >= 0 and current_step <= 32),
  unlocked_step int not null default 0 check (unlocked_step >= 0 and unlocked_step <= 32),
  updated_at timestamptz not null default now()
);

create table if not exists public.meeting_activity (
  id uuid primary key default gen_random_uuid(),
  meeting_id text not null,
  event_type text not null check (
    event_type in (
      'CHART_VIEWED',
      'QUESTION_ASKED',
      'CHART_SELECTED',
      'AI_HIGHLIGHT',
      'DECISION_CREATED',
      'AI_RESPONSE',
      'PRESENTATION_STEP'
    )
  ),
  actor_id text,
  actor_name text,
  scope text not null default 'local'
    check (scope in ('global', 'local')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_meeting_activity_timeline
  on public.meeting_activity (meeting_id, created_at);

create index if not exists idx_meeting_activity_type
  on public.meeting_activity (meeting_id, event_type);

alter table public.meeting_state enable row level security;
alter table public.meeting_activity enable row level security;

-- Demo policies: tighten for production (auth + meeting membership)
create policy "meeting_state_select_anon"
  on public.meeting_state for select to anon, authenticated using (true);

create policy "meeting_state_upsert_anon"
  on public.meeting_state for all to anon, authenticated using (true) with check (true);

create policy "meeting_activity_select_anon"
  on public.meeting_activity for select to anon, authenticated using (true);

create policy "meeting_activity_insert_anon"
  on public.meeting_activity for insert to anon, authenticated with check (true);

alter publication supabase_realtime add table public.meeting_state;
alter publication supabase_realtime add table public.meeting_activity;
