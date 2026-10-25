import type { MeetingAnalysis } from '../types';
import { IconPlus, IconClose } from './icons';

interface HistorySidebarProps {
  history: MeetingAnalysis[];
  activeId: string | null;
  onSelect: (analysis: MeetingAnalysis) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

export default function HistorySidebar({ history, activeId, onSelect, onDelete, onNew }: HistorySidebarProps) {
  return (
    <aside className="sidebar">
      <button type="button" className="btn btn-primary btn-block" onClick={onNew}>
        <IconPlus size={14} />
        <span>New Analysis</span>
      </button>

      <h3 className="sidebar__heading">Saved Analyses</h3>

      {history.length === 0 ? (
        <p className="hint-text sidebar__empty">
          Nothing saved yet. Analyze a transcript, then click "Save".
        </p>
      ) : (
        <ul className="history-list">
          {history.map((h) => (
            <li
              key={h.id}
              className={`history-item ${h.id === activeId ? 'history-item--active' : ''}`}
            >
              <button type="button" className="history-item__main" onClick={() => onSelect(h)}>
                <span className="history-item__title">{h.meta.title}</span>
                <span className="history-item__meta">
                  {new Date(h.updatedAt).toLocaleDateString()} &middot; {h.tasks.length} tasks
                </span>
              </button>
              <button
                type="button"
                className="history-item__delete"
                title="Delete"
                onClick={() => onDelete(h.id)}
              >
                <IconClose size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
