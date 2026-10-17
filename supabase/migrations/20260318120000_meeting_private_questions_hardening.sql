-- Privacidad real de preguntas: sin insert/select anónimo, sin Realtime del texto,
-- e identidad de participante con token aleatorio no derivable del ID.

create table if not exists public.meeting_participants (
  meeting_id text not null,
  participant_id text not null,
  token_hash text not null,
  created_at timestamptz not null default now(),
  primary key (meeting_id, participant_id)
);

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
