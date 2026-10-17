-- Voto de claridad «Quiero explorar» (monitor y APIs de reunión).

alter table public.meeting_clarity_votes
  drop constraint if exists meeting_clarity_votes_vote_check;

alter table public.meeting_clarity_votes
  add constraint meeting_clarity_votes_vote_check
  check (vote in ('claro', 'duda', 'glosario', 'explorar'));
