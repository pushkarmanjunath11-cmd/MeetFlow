import { useState } from 'react';
import type { FollowUpQuestion } from '../types';

interface FollowUpPanelProps {
  followUps: FollowUpQuestion[];
  onAnswer: (followUpId: string, answer: string) => string | null;
}

function FollowUpRow({
  followUp,
  onAnswer,
}: {
  followUp: FollowUpQuestion;
  onAnswer: (followUpId: string, answer: string) => string | null;
}) {
  const [draft, setDraft] = useState(followUp.answer);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!draft.trim()) return;
    const result = onAnswer(followUp.id, draft.trim());
    setError(result);
  }

  return (
    <li className="followup-row">
      <div className="followup-bubble followup-bubble--question">
        <span className="followup-bubble__tag">{followUp.field === 'owner' ? 'Owner' : 'Deadline'}</span>
        <span className="followup-question">{followUp.question}</span>
      </div>
      <div className="followup-input-row">
        <input
          type="text"
          placeholder={followUp.field === 'owner' ? 'e.g. Priya' : 'e.g. November 8'}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && draft.trim()) submit();
          }}
        />
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!draft.trim()}
          onClick={submit}
        >
          Save Answer
        </button>
      </div>
      {error && <span className="field-error">{error}</span>}
    </li>
  );
}

export default function FollowUpPanel({ followUps, onAnswer }: FollowUpPanelProps) {
  const unanswered = followUps.filter((f) => !f.answered);
  const answered = followUps.filter((f) => f.answered);

  if (followUps.length === 0) return null;

  return (
    <section className="clarify-band">
      <div className="section__header">
        <div className="section__heading">
          <span className="eyebrow">Clarification</span>
          <h2>Resolve Missing Information</h2>
        </div>
        <span className="hint-text">
          {unanswered.length} open &middot; {answered.length} answered
        </span>
      </div>

      {unanswered.length === 0 ? (
        <p className="hint-text">All clarifying questions have been answered. Nice and tidy.</p>
      ) : (
        <ul className="followup-list">
          {unanswered.map((fu) => (
            <FollowUpRow key={fu.id} followUp={fu} onAnswer={onAnswer} />
          ))}
        </ul>
      )}
    </section>
  );
}
