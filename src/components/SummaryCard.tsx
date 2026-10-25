import type { KeyDecision } from '../types';
import { IconArrowRight } from './icons';

interface SummaryCardProps {
  summary: string;
  decisions: KeyDecision[];
}

export default function SummaryCard({ summary, decisions }: SummaryCardProps) {
  return (
    <section className="briefing">
      <div className="briefing__col briefing__col-summary">
        <span className="eyebrow">Understanding</span>
        <h2>Executive Briefing</h2>
        <p className="briefing__summary">{summary}</p>
      </div>

      <div className="briefing__divider" aria-hidden="true" />

      <div className="briefing__col briefing__col-decisions">
        <h3 className="subheading">Key Decisions</h3>
        {decisions.length === 0 ? (
          <p className="hint-text">No explicit decisions were detected.</p>
        ) : (
          <ul className="decision-list">
            {decisions.map((d) => (
              <li key={d.id}>
                <IconArrowRight size={13} />
                <span>{d.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
