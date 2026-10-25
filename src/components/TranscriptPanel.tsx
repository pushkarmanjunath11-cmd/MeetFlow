import { IconSpark } from './icons';

interface TranscriptPanelProps {
  transcript: string;
  onChange: (value: string) => void;
  onLoadSample: () => void;
  onAnalyze: () => void;
  onClear: () => void;
  isAnalyzing: boolean;
  collapsed?: boolean;
}

export default function TranscriptPanel({
  transcript,
  onChange,
  onLoadSample,
  onAnalyze,
  onClear,
  isAnalyzing,
  collapsed = false,
}: TranscriptPanelProps) {
  return (
    <section className={`workspace ${collapsed ? 'workspace--collapsed' : ''}`}>
      <div className="workspace__header">
        <div className="section__heading">
          <span className="eyebrow">Input</span>
          <h2>Meeting Transcript</h2>
        </div>
        <div className="section__actions">
          <button type="button" className="btn btn-ghost" onClick={onLoadSample}>
            Load Sample
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClear} disabled={!transcript}>
            Clear
          </button>
        </div>
      </div>

      <textarea
        className="transcript-input"
        placeholder={`Paste a meeting transcript here, e.g.\n\nMeeting: Weekly Sync\nAttendees: Alice, Bob\n\nAlice: ...\nBob: ...`}
        value={transcript}
        onChange={(e) => onChange(e.target.value)}
        rows={collapsed ? 6 : 14}
      />

      <div className="workspace__footer">
        <span className="hint-text">{transcript.length.toLocaleString()} characters</span>
        <button
          type="button"
          className="btn btn-primary btn-analyze"
          onClick={onAnalyze}
          disabled={!transcript.trim() || isAnalyzing}
        >
          <IconSpark size={14} />
          <span>{isAnalyzing ? 'Analyzing…' : 'Analyze Transcript'}</span>
        </button>
      </div>
    </section>
  );
}
