import { useEffect, useState } from 'react';
import './App.css';
import TopBar from './components/TopBar';
import HistorySidebar from './components/HistorySidebar';
import TranscriptPanel from './components/TranscriptPanel';
import SummaryCard from './components/SummaryCard';
import TasksTable from './components/TasksTable';
import FollowUpPanel from './components/FollowUpPanel';
import SettingsModal from './components/SettingsModal';
import { SAMPLE_TRANSCRIPT } from './data/sampleTranscript';
import type { AppSettings, MeetingAnalysis } from './types';
import { runAnalysis, applyFollowUpAnswer, updateTaskField } from './services/analyze';
import {
  loadSettings,
  saveSettings,
  loadHistory,
  upsertHistoryEntry,
  deleteHistoryEntry,
  loadDraft,
  saveDraft,
} from './services/storage';
import { exportAsJSON, exportAsText } from './services/exportAnalysis';

export default function App() {
  const [transcript, setTranscript] = useState('');
  const [analysis, setAnalysis] = useState<MeetingAnalysis | null>(null);
  const [history, setHistory] = useState<MeetingAnalysis[]>([]);
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [savedThisSession, setSavedThisSession] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
    const draft = loadDraft();
    if (draft) {
      setTranscript(draft.transcript ?? '');
      setAnalysis(draft.analysis ?? null);
    }
  }, []);

  useEffect(() => {
    saveDraft(transcript, analysis);
  }, [transcript, analysis]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  async function handleAnalyze() {
    if (!transcript.trim()) return;
    setIsAnalyzing(true);
    setSavedThisSession(false);
    try {
      const result = await runAnalysis(transcript, settings);
      setAnalysis(result);
      if (result.warning) setToast(result.warning);
    } catch (err) {
      setToast(`Analysis failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleLoadSample() {
    setTranscript(SAMPLE_TRANSCRIPT);
    setAnalysis(null);
    setSavedThisSession(false);
  }

  function handleClear() {
    setTranscript('');
    setAnalysis(null);
    setSavedThisSession(false);
  }

  function handleNew() {
    setTranscript('');
    setAnalysis(null);
    setSavedThisSession(false);
  }

  function handleFollowUpAnswer(followUpId: string, answer: string): string | null {
    if (!analysis) return null;
    const result = applyFollowUpAnswer(analysis, followUpId, answer);
    if (result.error) return result.error;
    setAnalysis(result.analysis);
    return null;
  }

  function handleUpdateTaskField(taskId: string, field: 'owner' | 'deadline', value: string): string | null {
    if (!analysis) return null;
    const result = updateTaskField(analysis, taskId, field, value);
    if (result.error) return result.error;
    setAnalysis(result.analysis);
    return null;
  }

  function handleSave() {
    if (!analysis) return;
    const updated = upsertHistoryEntry(analysis);
    setHistory(updated);
    setSavedThisSession(true);
    setToast('Analysis saved to history.');
  }

  function handleSelectHistory(entry: MeetingAnalysis) {
    setAnalysis(entry);
    setTranscript(entry.transcript);
    setSavedThisSession(true);
  }

  function handleDeleteHistory(id: string) {
    const updated = deleteHistoryEntry(id);
    setHistory(updated);
    if (analysis?.id === id) {
      setAnalysis(null);
    }
  }

  function handleSaveSettings(next: AppSettings) {
    setSettings(next);
    saveSettings(next);
  }

  return (
    <div className="app-shell">
      <HistorySidebar
        history={history}
        activeId={analysis?.id ?? null}
        onSelect={handleSelectHistory}
        onDelete={handleDeleteHistory}
        onNew={handleNew}
      />

      <div className="app-main">
        <TopBar
          provider={analysis?.provider ?? null}
          hasApiKey={!!settings.openaiApiKey}
          canSave={!!analysis && !savedThisSession}
          canExport={!!analysis}
          onSave={handleSave}
          onExportJSON={() => analysis && exportAsJSON(analysis)}
          onExportText={() => analysis && exportAsText(analysis)}
          onOpenSettings={() => setShowSettings(true)}
        />

        {toast && (
          <div className="toast" onClick={() => setToast(null)}>
            {toast}
          </div>
        )}

        <main className="content">
          <TranscriptPanel
            transcript={transcript}
            onChange={(v) => {
              setTranscript(v);
              setSavedThisSession(false);
            }}
            onLoadSample={handleLoadSample}
            onAnalyze={handleAnalyze}
            onClear={handleClear}
            isAnalyzing={isAnalyzing}
            collapsed={!!analysis}
          />

          {analysis && (
            <>
              <SummaryCard summary={analysis.summary} decisions={analysis.decisions} />
              <div className="action-row">
                <TasksTable tasks={analysis.tasks} onUpdateField={handleUpdateTaskField} />
                <FollowUpPanel followUps={analysis.followUps} onAnswer={handleFollowUpAnswer} />
              </div>
            </>
          )}
        </main>
      </div>

      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
