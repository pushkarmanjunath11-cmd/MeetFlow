import { useState } from 'react';
import type { AppSettings } from '../types';

interface SettingsModalProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onClose: () => void;
}

export default function SettingsModal({ settings, onSave, onClose }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState(settings.openaiApiKey);
  const [model, setModel] = useState(settings.model);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <span className="eyebrow">Configuration</span>
        <h2>AI Provider Settings</h2>
        <p className="modal-subtext">
          Optional. Add an OpenAI API key to use real AI analysis instead of local demo mode. Your key
          is stored only in this browser's localStorage and is sent directly to OpenAI's API &mdash;
          never to any other server.
        </p>

        <label className="field-label" htmlFor="openai-key">
          OpenAI API Key
        </label>
        <input
          id="openai-key"
          type="password"
          placeholder="sk-..."
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          autoComplete="off"
        />

        <label className="field-label" htmlFor="openai-model">
          Model
        </label>
        <input
          id="openai-model"
          type="text"
          placeholder="gpt-4o-mini"
          value={model}
          onChange={(e) => setModel(e.target.value)}
        />

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setApiKey('');
              onSave({ openaiApiKey: '', model });
            }}
          >
            Clear Key
          </button>
          <div className="modal-actions__right">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onSave({ openaiApiKey: apiKey, model: model.trim() || 'gpt-4o-mini' });
                onClose();
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
