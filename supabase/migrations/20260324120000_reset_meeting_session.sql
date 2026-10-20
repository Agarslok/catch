-- Reinicio de una reunión: borra historial de ESA reunión y deja meeting_state en el inicio.
-- No toca meeting_prep_faqs ni datos de otras reuniones.
-- Ejecutable solo con service_role (la API valida el token de presentador).

create or replace function public.reset_meeting_session(p_meeting_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  prev jsonb;
  faqs jsonb;
  next_seq bigint;
  nonce bigint;
begin
  if p_meeting_id is null or length(trim(p_meeting_id)) = 0 then
    raise exception 'meeting_id required';
  end if;

  select coalesce(global_view, '{}'::jsonb), coalesce(event_seq, 0) + 1
    into prev, next_seq
  from public.meeting_state
  where meeting_id = p_meeting_id
  for update;

  faqs := coalesce(prev -> 'prepFaqs', '[]'::jsonb);
  nonce := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;

  delete from public.meeting_questions where meeting_id = p_meeting_id;
  delete from public.meeting_clarity_votes where meeting_id = p_meeting_id;
  delete from public.meeting_activity where meeting_id = p_meeting_id;
  delete from public.meeting_interaction_events where meeting_id = p_meeting_id;
  delete from public.meeting_session_registry where meeting_id = p_meeting_id;
  delete from public.meeting_participants where meeting_id = p_meeting_id;

  insert into public.meeting_state (
    meeting_id, current_step, unlocked_step, presentation_status, global_view, event_seq, updated_at
  ) values (
    p_meeting_id,
    0,
    0,
    'live',
    jsonb_build_object(
      'prepFaqs', faqs,
      'monitorSessionPhase', 'preparacion',
      'monitorHighlight', null,
      'awaitingModerator', false,
      'sessionResetNonce', nonce
    ),
    coalesce(next_seq, 1),
    now()
  )
  on conflict (meeting_id) do update set
    current_step = 0,
    unlocked_step = 0,
    current_point_id = null,
    script = null,
    presented_charts = '[]'::jsonb,
    presentation_status = 'live',
    global_view = excluded.global_view,
    event_seq = excluded.event_seq,
    updated_at = excluded.updated_at;

  return jsonb_build_object('ok', true, 'sessionResetNonce', nonce, 'eventSeq', coalesce(next_seq, 1));
end;
$$;

revoke all on function public.reset_meeting_session(text) from public;
revoke all on function public.reset_meeting_session(text) from anon;
revoke all on function public.reset_meeting_session(text) from authenticated;
grant execute on function public.reset_meeting_session(text) to service_role;
