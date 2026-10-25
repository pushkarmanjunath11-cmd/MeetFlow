import type { AnalysisProvider } from '../types';
import ModeBadge from './ModeBadge';
import { IconDownload, IconSave, IconSettings } from './icons';

interface TopBarProps {
  provider: AnalysisProvider | null;
  hasApiKey: boolean;
  canSave: boolean;
  canExport: boolean;
  onSave: () => void;
  onExportJSON: () => void;
  onExportText: () => void;
  onOpenSettings: () => void;
}

export default function TopBar({
  provider,
  hasApiKey,
  canSave,
  canExport,
  onSave,
  onExportJSON,
  onExportText,
  onOpenSettings,
}: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar__left">
        <div className="brand">
          <span className="brand__mark">M</span>
          <div className="brand__text">
            <h1 className="brand__name">MeetFlow</h1>
            <span className="brand__tagline">Turn conversations into momentum.</span>
          </div>
        </div>
        <ModeBadge provider={provider} hasApiKey={hasApiKey} />
      </div>
      <div className="topbar__right">
        <button type="button" className="btn btn-ghost" onClick={onExportText} disabled={!canExport}>
          <IconDownload size={14} />
          <span>.txt</span>
        </button>
        <button type="button" className="btn btn-ghost" onClick={onExportJSON} disabled={!canExport}>
          <IconDownload size={14} />
          <span>.json</span>
        </button>
        <button type="button" className="btn btn-secondary" onClick={onSave} disabled={!canSave}>
          <IconSave size={14} />
          <span>Save</span>
        </button>
        <button type="button" className="btn btn-icon" title="Settings" onClick={onOpenSettings}>
          <IconSettings size={16} />
        </button>
      </div>
    </header>
  );
}
