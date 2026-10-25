import type { AnalysisProvider } from '../types';

interface ModeBadgeProps {
  provider: AnalysisProvider | null;
  hasApiKey: boolean;
}

export default function ModeBadge({ provider, hasApiKey }: ModeBadgeProps) {
  const active = provider ?? (hasApiKey ? 'openai' : 'demo');
  const isDemo = active === 'demo';

  return (
    <span className={`mode-badge ${isDemo ? 'mode-badge--demo' : 'mode-badge--live'}`}>
      <span className="mode-badge__dot" />
      <span className="mode-badge__label">{isDemo ? 'Local Demo Mode' : 'AI Provider: OpenAI'}</span>
    </span>
  );
}
