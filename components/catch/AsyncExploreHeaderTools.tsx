"use client";

type Props = {
  onAskCatchTeam: () => void;
  onReviewConcepts: () => void;
};

export function AsyncExploreHeaderTools({ onAskCatchTeam, onReviewConcepts }: Props) {
  return (
    <div className="visitor-tools visitor-tools--async">
      <button type="button" className="btn-small" onClick={onAskCatchTeam}>
        Preguntar al equipo Catch
      </button>
      <button type="button" className="btn-small" onClick={onReviewConcepts}>
        Repasar conceptos
      </button>
    </div>
  );
}
