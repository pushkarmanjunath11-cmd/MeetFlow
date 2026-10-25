import type { AppSettings, MeetingAnalysis } from '../types';

const HISTORY_KEY = 'meeting-assistant.history.v1';
const SETTINGS_KEY = 'meeting-assistant.settings.v1';
const DRAFT_KEY = 'meeting-assistant.draft.v1';

export const DEFAULT_SETTINGS: AppSettings = {
  openaiApiKey: '',
  model: 'gpt-4o-mini',
};

export function loadHistory(): MeetingAnalysis[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHistory(history: MeetingAnalysis[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function upsertHistoryEntry(analysis: MeetingAnalysis): MeetingAnalysis[] {
  const history = loadHistory();
  const idx = history.findIndex((h) => h.id === analysis.id);
  if (idx >= 0) {
    history[idx] = analysis;
  } else {
    history.unshift(analysis);
  }
  saveHistory(history);
  return history;
}

export function deleteHistoryEntry(id: string): MeetingAnalysis[] {
  const history = loadHistory().filter((h) => h.id !== id);
  saveHistory(history);
  return history;
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadDraft(): { transcript: string; analysis: MeetingAnalysis | null } | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveDraft(transcript: string, analysis: MeetingAnalysis | null): void {
  localStorage.setItem(DRAFT_KEY, JSON.stringify({ transcript, analysis }));
}

export function clearDraft(): void {
  localStorage.removeItem(DRAFT_KEY);
}
