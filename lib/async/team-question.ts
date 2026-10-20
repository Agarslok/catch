export const ASYNC_EXPLORE_MEETING_ID = "async-explore";

export const TEAM_QUESTION_MAX = 600;

export function normalizeTeamQuestionText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > TEAM_QUESTION_MAX) return null;
  return trimmed;
}
