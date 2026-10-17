-- Cola unificada del moderador (extiende meeting_questions)

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
