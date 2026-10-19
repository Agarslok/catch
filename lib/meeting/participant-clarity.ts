export type ParticipantClarityVoteRow = {
  participant_id: string;
  section_key: string;
  vote: string;
};

const VOTE_LABEL: Record<string, string> = {
  claro: "Quedó claro",
  duda: "Tiene dudas",
  glosario: "Repaso glosario",
  explorar: "Quiso explorar",
};

export function groupClarityVotesByParticipant(
  rows: ParticipantClarityVoteRow[],
): Record<string, { section_key: string; vote: string; label: string }[]> {
  const out: Record<string, { section_key: string; vote: string; label: string }[]> = {};
  for (const row of rows) {
    const pid = row.participant_id?.trim();
    if (!pid) continue;
    if (!out[pid]) out[pid] = [];
    out[pid].push({
      section_key: row.section_key,
      vote: row.vote,
      label: VOTE_LABEL[row.vote] ?? row.vote,
    });
  }
  return out;
}
