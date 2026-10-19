-- Alias de consulta para el historial de interacciones (payload = metadata jsonb).

create or replace view public.meeting_events as
select
  id,
  meeting_id,
  participant_id,
  event_type,
  metadata as payload,
  created_at,
  client_event_id,
  session_id,
  participant_role,
  chart_id,
  chart_type,
  element_id,
  element_label,
  action,
  schema_version
from public.meeting_interaction_events;

comment on view public.meeting_events is
  'Vista de lectura sobre meeting_interaction_events para informes y SQL ad hoc.';
