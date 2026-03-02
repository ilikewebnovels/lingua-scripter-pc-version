import React, { useState, useEffect } from 'react';
import { Settings, Preset, PresetSettings } from '../types';
import { usePresets } from '../hooks/usePresets';
import { getPromptPreview, getOpenAIModels, getModels } from '../services/geminiService';


interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: Settings;
  onSave: (settings: Partial<Settings>) => void;
}

const fontFamilies = [
  { value: 'font-sans', label: 'Sans-serif (Inter)' },
  { value: 'font-serif', label: 'Serif (Lora)' },
  { value: 'font-mono', label: 'Monospace (Source Code Pro)' },
  { value: 'font-lato', label: 'Sans-serif (Lato)' },
  { value: 'font-merriweather', label: 'Serif (Merriweather)' },
  { value: 'font-roboto', label: 'Sans-serif (Roboto)' },
  { value: 'font-playfair', label: 'Serif (Playfair Display)' },
  { value: 'font-nunito', label: 'Sans-serif (Nunito)' },
  { value: 'font-eb-garamond', label: 'Serif (EB Garamond)' },
];

const languages = [
  "English", "Spanish", "French", "German", "Japanese",
  "Korean", "Chinese (Simplified)", "Russian", "Portuguese", "Italian"
];

// Icons
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const LoadingSpinner = () => <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>;
const ChevronDownIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>;

// Collapsible Section Component
const Section: React.FC<{ title: string; icon?: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode }> = ({ title, icon, defaultOpen = true, children }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border border-[var(--border-primary)] rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)]/80 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-semibold text-sm text-[var(--text-primary)]">{title}</span>
        </div>
        <ChevronDownIcon />
      </button>
      {isOpen && <div className="p-4 space-y-3 bg-[var(--bg-secondary)]">{children}</div>}
    </div>
  );
};

// Compact Input Component
const InputField: React.FC<{ label: string; id: string; type?: string; value: string | number; onChange: (v: string) => void; placeholder?: string; hint?: string }> =
  ({ label, id, type = 'text', value, onChange, placeholder, hint }) => (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{label}</label>
      <input
        type={type}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-md px-3 py-1.5 text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] outline-none transition"
      />
      {hint && <p className="text-xs text-[var(--text-secondary)] mt-1">{hint}</p>}
    </div>
  );

// Compact Select Component
const SelectField: React.FC<{ label: string; id: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; hint?: string }> =
  ({ label, id, value, onChange, options, hint }) => (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-md px-3 py-1.5 text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] outline-none transition"
      >
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
      {hint && <p className="text-xs text-[var(--text-secondary)] mt-1">{hint}</p>}
    </div>
  );

// Toggle Switch Component
const ToggleSwitch: React.FC<{ id: string; label: string; hint?: string; checked: boolean; onChange: (checked: boolean) => void; badge?: string }> =
  ({ id, label, hint, checked, onChange, badge }) => (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)]">
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-gray-500 bg-[var(--bg-tertiary)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]/50"
      />
      <div className="flex-1">
        <label htmlFor={id} className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
          {label}
          {badge && <span className="text-xs font-semibold bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">{badge}</span>}
        </label>
        {hint && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{hint}</p>}
      </div>
    </div>
  );


const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, currentSettings, onSave }) => {
  const [settings, setSettings] = useState(currentSettings);
  const { presets, addPreset, deletePreset } = usePresets();
  const [presetName, setPresetName] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState('');

  const [isPromptPreviewOpen, setIsPromptPreviewOpen] = useState(false);
  const [promptPreviewContent, setPromptPreviewContent] = useState<{ systemInstruction: string; userPrompt: string; } | null>(null);
  const [editableSystemInstruction, setEditableSystemInstruction] = useState('');
  const [promptPreviewError, setPromptPreviewError] = useState<string | null>(null);
  const [isFetchingPreview, setIsFetchingPreview] = useState(false);

  const [models, setModels] = useState<{ id: string }[]>([]);
  const [modelSearch, setModelSearch] = useState('');
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchModelsError, setFetchModelsError] = useState<string | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<'connection' | 'translation' | 'display'>('connection');


  useEffect(() => {
    if (isOpen) {
      setSettings(currentSettings);
      setIsPromptPreviewOpen(false);
      setPromptPreviewContent(null);
      setPromptPreviewError(null);
      setModels([]);
      setFetchModelsError(null);
    }
  }, [isOpen, currentSettings]);

  if (!isOpen) return null;

  const handleSettingChange = (key: keyof Settings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleApiKeyProviderChange = (provider: 'gemini' | 'deepseek' | 'openrouter' | 'openai') => {
    handleSettingChange('provider', provider);
    if (provider === 'gemini' && !settings.model.startsWith('gemini')) {
      handleSettingChange('model', 'gemini-2.5-flash');
    } else if (provider === 'deepseek' && !settings.model.startsWith('deepseek')) {
      handleSettingChange('model', 'deepseek-chat');
    } else if (provider === 'openrouter') {
      const isOtherPlatform = settings.model.startsWith('gemini') || settings.model.startsWith('deepseek');
      if (isOtherPlatform || !settings.model) {
        handleSettingChange('model', 'mistralai/mistral-7b-instruct');
      }
    } else if (provider === 'openai') {
      const isOtherPlatform = settings.model.startsWith('gemini') || settings.model.startsWith('deepseek');
      if (isOtherPlatform || !settings.model) {
        handleSettingChange('model', 'gpt-4o');
      }
    }
  };

  const handleSave = () => {
    onSave(settings);
    onClose();
  };

  const handleSaveFromPreview = () => {
    onSave({ systemInstruction: editableSystemInstruction });
    onClose();
  };

  const handleSavePreset = () => {
    const presetSettings: PresetSettings = {
      provider: settings.provider,
      model: settings.model,
      sourceLanguage: settings.sourceLanguage,
      targetLanguage: settings.targetLanguage,
    };
    addPreset(presetName, presetSettings);
    setPresetName('');
  };

  const handleLoadPreset = (id: string) => {
    setSelectedPresetId(id);
    if (!id) return;
    const preset = presets.find(p => p.id === id);
    if (preset) {
      setSettings(prev => ({ ...prev, ...preset.settings }));
    }
  };

  const handleDeletePreset = () => {
    if (selectedPresetId) {
      deletePreset(selectedPresetId);
      setSelectedPresetId('');
    }
  }

  const handlePreviewPrompt = async () => {
    setIsPromptPreviewOpen(true);
    setIsFetchingPreview(true);
    setPromptPreviewError(null);
    setPromptPreviewContent(null);

    const result = await getPromptPreview(settings.systemInstruction || '');

    setIsFetchingPreview(false);
    if ('error' in result) {
      setPromptPreviewError(result.error);
    } else {
      setPromptPreviewContent(result);
      setEditableSystemInstruction(result.systemInstruction);
    }
  };

  const handleFetchModels = async () => {
    if (settings.provider === 'openai' && (!settings.openaiEndpoint || !settings.openaiApiKey)) {
      setFetchModelsError("Please enter both the API endpoint and key.");
      return;
    }
    setIsFetchingModels(true);
    setFetchModelsError(null);
    setModels([]);

    let result;
    if (settings.provider === 'openai') {
      result = await getOpenAIModels(settings.openaiEndpoint, settings.openaiApiKey);
    } else {
      result = await getModels(settings.provider, settings);
    }

    if ('models' in result) {
      setModels(result.models.sort((a, b) => a.id.localeCompare(b.id)));
    } else {
      setFetchModelsError(result.error);
    }
    setIsFetchingModels(false);
  };

  const getApiKeyConfig = () => {
    const keyMap: Record<string, { label: string; value: string; key: keyof Settings; placeholder: string }> = {
      gemini: { label: 'Gemini API Key', value: settings.apiKey, key: 'apiKey', placeholder: 'Enter your Gemini API key' },
      deepseek: { label: 'DeepSeek API Key', value: settings.deepseekApiKey, key: 'deepseekApiKey', placeholder: 'Enter your DeepSeek API key' },
      openrouter: { label: 'OpenRouter API Key', value: settings.openRouterApiKey, key: 'openRouterApiKey', placeholder: 'Enter your OpenRouter API key' }
    };
    return keyMap[settings.provider] || keyMap.gemini;
  };

  const apiKeyConfig = getApiKeyConfig();

  const tabClass = (tab: string) => `flex-1 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === tab
    ? 'bg-[var(--accent-primary)] text-[var(--text-on-accent)] shadow'
    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`;

  return (
    <>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 modal-overlay" onClick={onClose}>
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-2xl w-full max-w-xl border border-[var(--border-primary)] animate-fade-in" onClick={(e) => e.stopPropagation()}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-primary)]">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Settings</h2>
            <button onClick={onClose} className="p-1 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 p-2 mx-4 mt-3 bg-[var(--bg-tertiary)] rounded-lg">
            <button onClick={() => setActiveTab('connection')} className={tabClass('connection')}>Connection</button>
            <button onClick={() => setActiveTab('translation')} className={tabClass('translation')}>Translation</button>
            <button onClick={() => setActiveTab('display')} className={tabClass('display')}>Display</button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">

            {/* CONNECTION TAB */}
            {activeTab === 'connection' && (
              <>
                {/* Provider & API Key */}
                <Section title="API Provider" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--accent-primary)]" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>}>
                  <SelectField
                    label="Provider"
                    id="apiProvider"
                    value={settings.provider}
                    onChange={(v) => handleApiKeyProviderChange(v as 'gemini' | 'deepseek' | 'openrouter' | 'openai')}
                    options={[
                      { value: 'gemini', label: 'Google Gemini' },
                      { value: 'deepseek', label: 'DeepSeek' },
                      { value: 'openrouter', label: 'OpenRouter' },
                      { value: 'openai', label: 'OpenAI-Compatible' }
                    ]}
                  />

                  {settings.provider === 'openai' ? (
                    <div className="grid grid-cols-2 gap-3">
                      <InputField label="API Endpoint" id="openaiEndpoint" value={settings.openaiEndpoint} onChange={(v) => handleSettingChange('openaiEndpoint', v)} placeholder="https://api.openai.com" />
                      <InputField label="API Key" id="openaiApiKey" type="password" value={settings.openaiApiKey} onChange={(v) => handleSettingChange('openaiApiKey', v)} placeholder="Enter API key" />
                    </div>
                  ) : (
                    <InputField label={apiKeyConfig.label} id="apiKeyInput" type="password" value={apiKeyConfig.value} onChange={(v) => handleSettingChange(apiKeyConfig.key, v)} placeholder={apiKeyConfig.placeholder} />
                  )}
                  <p className="text-xs text-[var(--text-secondary)]">Keys stored locally in <code className="bg-[var(--bg-tertiary)] px-1 rounded font-mono">/data/settings.json</code></p>
                </Section>

                {/* Presets */}
                <Section title="Quick Presets" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--accent-primary)]" viewBox="0 0 20 20" fill="currentColor"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" /></svg>} defaultOpen={false}>
                  <div className="flex gap-2 items-center">
                    <select value={selectedPresetId} onChange={(e) => handleLoadPreset(e.target.value)} className="flex-1 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-md px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none">
                      <option value="">Load a preset...</option>
                      {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <button onClick={handleDeletePreset} disabled={!selectedPresetId} className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--danger-primary)] disabled:opacity-30 transition-colors"><TrashIcon /></button>
                  </div>
                  <div className="flex gap-2">
                    <input type="text" value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="New preset name" className="flex-1 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-md px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none" />
                    <button onClick={handleSavePreset} disabled={!presetName.trim()} className="bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-[var(--text-on-accent)] font-semibold px-3 py-1.5 rounded-md text-sm transition-colors disabled:opacity-50">Save</button>
                  </div>
                </Section>
              </>
            )}

            {/* TRANSLATION TAB */}
            {activeTab === 'translation' && (
              <>
                <Section title="Languages & Model" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--accent-primary)]" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7 2a1 1 0 011 1v1h3a1 1 0 110 2H9.578a18.87 18.87 0 01-1.724 4.78c.29.354.596.696.914 1.026a1 1 0 11-1.44 1.389c-.188-.196-.373-.396-.554-.6a19.098 19.098 0 01-3.107 3.567 1 1 0 01-1.334-1.49 17.087 17.087 0 003.13-3.733 18.992 18.992 0 01-1.487-2.494 1 1 0 111.79-.89c.234.47.489.928.764 1.372.417-.934.752-1.913.997-2.927H3a1 1 0 110-2h3V3a1 1 0 011-1zm6 6a1 1 0 01.894.553l2.991 5.982a.869.869 0 01.02.037l.99 1.98a1 1 0 11-1.79.895L15.383 16h-4.764l-.724 1.447a1 1 0 11-1.788-.894l.99-1.98.019-.038 2.99-5.982A1 1 0 0113 8zm-1.382 6h2.764L13 11.236 11.618 14z" clipRule="evenodd" /></svg>}>
                  <div className="grid grid-cols-2 gap-3">
                    <SelectField label="Source Language" id="sourceLang" value={settings.sourceLanguage} onChange={(v) => handleSettingChange('sourceLanguage', v)}
                      options={[{ value: 'Auto-detect', label: 'Auto-detect' }, ...languages.map(l => ({ value: l, label: l }))]} />
                    <SelectField label="Target Language" id="targetLang" value={settings.targetLanguage} onChange={(v) => handleSettingChange('targetLanguage', v)}
                      options={languages.map(l => ({ value: l, label: l }))} />
                  </div>

                  {settings.provider === 'openrouter' || settings.provider === 'openai' ? (
                    <InputField label="Model" id="model" value={settings.model} onChange={(v) => handleSettingChange('model', v)} placeholder={settings.provider === 'openrouter' ? "e.g., mistralai/mixtral-8x7b-instruct" : "e.g., gpt-4o"} />
                  ) : (
                    <SelectField label="Model" id="model" value={settings.model} onChange={(v) => handleSettingChange('model', v)}
                      options={settings.provider === 'gemini'
                        ? [{ value: 'gemini-2.5-flash', label: 'gemini-2.5-flash' }, { value: 'gemini-2.5-pro', label: 'gemini-2.5-pro' }]
                        : [{ value: 'deepseek-chat', label: 'deepseek-chat' }, { value: 'deepseek-reasoner', label: 'deepseek-reasoner' }]} />
                  )}

                  {/* Fetch Models Button */}
                  <button onClick={handleFetchModels} disabled={isFetchingModels || (settings.provider === 'openai' && (!settings.openaiEndpoint || !settings.openaiApiKey)) || (settings.provider === 'gemini' && !settings.apiKey) || (settings.provider === 'deepseek' && !settings.deepseekApiKey)}
                    className="w-full text-xs font-medium py-2 px-3 rounded-md transition-colors bg-[var(--bg-tertiary)] hover:brightness-125 disabled:opacity-50 flex items-center justify-center gap-2">
                    {isFetchingModels ? <LoadingSpinner /> : 'Fetch Available Models'}
                  </button>
                  {fetchModelsError && <p className="text-xs text-center text-[var(--danger-primary)]">{fetchModelsError}</p>}
                  {models.length > 0 && (
                    <>
                      <input type="text" placeholder="Search models..." value={modelSearch} onChange={(e) => setModelSearch(e.target.value)} className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-md px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none" />
                      <select value={settings.model} onChange={(e) => handleSettingChange('model', e.target.value)} className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-md px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none">
                        <option value="">Select a fetched model...</option>
                        {models.filter(m => m.id.toLowerCase().includes(modelSearch.toLowerCase())).map(m => <option key={m.id} value={m.id}>{m.id}</option>)}
                      </select>
                    </>
                  )}

                  {settings.provider === 'openrouter' && (
                    <InputField label="Model Providers (optional)" id="orProviders" value={settings.openRouterModelProviders} onChange={(v) => handleSettingChange('openRouterModelProviders', v)} placeholder="openai, anthropic" hint="Comma-separated. Leave blank for any." />
                  )}
                </Section>

                <Section title="AI Behavior" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--accent-primary)]" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>}>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Temperature: <span className="font-mono text-[var(--accent-primary)]">{settings.temperature.toFixed(2)}</span></label>
                      <input type="range" min="0" max="2" step="0.05" value={settings.temperature} onChange={(e) => handleSettingChange('temperature', parseFloat(e.target.value))} className="w-full h-2 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer" style={{ accentColor: 'var(--accent-primary)' }} />
                      <p className="text-xs text-[var(--text-secondary)] mt-1">Lower = deterministic, Higher = creative</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Reasoning Effort</label>
                      <select value={settings.reasoningEffort} onChange={(e) => handleSettingChange('reasoningEffort', e.target.value)} className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-md px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none">
                        <option value="auto">Auto</option>
                        <option value="minimum">Minimum</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="maximum">Maximum</option>
                      </select>
                      <p className="text-xs text-[var(--text-secondary)] mt-1">For reasoning models (o1, DeepSeek-R1)</p>
                    </div>
                  </div>

                  <ToggleSwitch id="isStreamingEnabled" label="Enable Streaming" hint="Disable for higher quality + integrated character analysis" checked={settings.isStreamingEnabled} onChange={(v) => handleSettingChange('isStreamingEnabled', v)} badge="Recommended: Off" />
                  <ToggleSwitch id="isTranslationMemoryEnabled" label="Translation Memory" hint="Cache translations to avoid redundant API calls" checked={settings.isTranslationMemoryEnabled} onChange={(v) => handleSettingChange('isTranslationMemoryEnabled', v)} />
                  <ToggleSwitch id="isAutoCharacterDetectionEnabled" label="Auto Character Database" hint="Automatically detect and add new characters from translations" checked={settings.isAutoCharacterDetectionEnabled} onChange={(v) => handleSettingChange('isAutoCharacterDetectionEnabled', v)} />
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      Retry Attempts: <span className="font-mono text-[var(--accent-primary)]">{settings.requestRetryCount}</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="1"
                      value={settings.requestRetryCount}
                      onChange={(e) => handleSettingChange('requestRetryCount', parseInt(e.target.value, 10))}
                      className="w-full h-2 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer"
                      style={{ accentColor: 'var(--accent-primary)' }}
                    />
                    <p className="text-xs text-[var(--text-secondary)] mt-1">If an API request fails, retry this many extra times before returning an error.</p>
                  </div>
                </Section>

                <Section title="Batch Translation" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--accent-primary)]" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></svg>} defaultOpen={false}>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Batch Size: <span className="font-mono text-[var(--accent-primary)]">{settings.batchSize} chapters</span></label>
                    <input type="range" min="1" max="50" step="1" value={settings.batchSize} onChange={(e) => handleSettingChange('batchSize', parseInt(e.target.value))} className="w-full h-2 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer" style={{ accentColor: 'var(--accent-primary)' }} />
                    <p className="text-xs text-[var(--text-secondary)] mt-1">Number of chapters for "Translate Next Batch"</p>
                  </div>
                  <ToggleSwitch id="batchSkipTranslated" label="Skip Translated Chapters" hint="When selecting chapters, skip those that already have translations" checked={settings.batchSkipTranslated} onChange={(v) => handleSettingChange('batchSkipTranslated', v)} />
                  <p className="text-xs text-[var(--text-secondary)]">Batch translation sends all selected chapters in a single API call for efficiency.</p>
                </Section>

                <Section title="System Instruction" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--accent-primary)]" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>} defaultOpen={false}>
                  <textarea rows={4} value={settings.systemInstruction || ''} onChange={(e) => handleSettingChange('systemInstruction', e.target.value)} className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] outline-none resize-none" placeholder="Define the AI's role and instructions..." />
                  <button type="button" onClick={handlePreviewPrompt} className="text-xs font-medium text-[var(--accent-primary)] hover:underline">Preview full prompt sent to AI →</button>
                </Section>
              </>
            )}

            {/* DISPLAY TAB */}
            {activeTab === 'display' && (
              <Section title="Appearance" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--accent-primary)]" viewBox="0 0 20 20" fill="currentColor"><path d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z" /></svg>}>
                {/* Theme */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">Theme</label>
                  <div className="flex gap-1 rounded-lg bg-[var(--bg-tertiary)] p-1 border border-[var(--border-primary)]">
                    {['light', 'dark', 'blue'].map(theme => (
                      <button key={theme} onClick={() => handleSettingChange('theme', theme)} className={`flex-1 text-sm py-1.5 rounded-md transition-colors capitalize ${settings.theme === theme ? 'bg-[var(--accent-primary)] text-[var(--text-on-accent)] font-semibold shadow' : 'text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/5'}`}>
                        {theme}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font */}
                <SelectField label="Font Family" id="fontFamily" value={settings.fontFamily} onChange={(v) => handleSettingChange('fontFamily', v)} options={fontFamilies} />

                {/* Font Size */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Font Size: <span className="font-mono text-[var(--accent-primary)]">{settings.fontSize.toFixed(1)}rem</span></label>
                  <input type="range" min="0.5" max="3" step="0.1" value={settings.fontSize} onChange={(e) => handleSettingChange('fontSize', parseFloat(e.target.value))} className="w-full h-2 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer" style={{ accentColor: 'var(--accent-primary)' }} />
                </div>

                {/* Font Color */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Font Color</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={settings.fontColor || '#ffffff'} onChange={(e) => handleSettingChange('fontColor', e.target.value)} className="p-0 h-8 w-10 block bg-transparent border border-[var(--border-primary)] cursor-pointer rounded-md" />
                    <button onClick={() => handleSettingChange('fontColor', '')} className="text-xs font-medium text-[var(--accent-primary)] hover:underline disabled:text-[var(--text-secondary)]" disabled={!settings.fontColor}>Reset to default</button>
                  </div>
                </div>
              </Section>
            )}

          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 px-5 py-4 border-t border-[var(--border-primary)] bg-[var(--bg-tertiary)]/50">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Cancel</button>
            <button onClick={handleSave} className="bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-[var(--text-on-accent)] font-semibold px-5 py-2 rounded-lg text-sm transition-colors">Save Settings</button>
          </div>
        </div>
      </div>

      {/* Prompt Preview Modal */}
      {isPromptPreviewOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]" onClick={() => setIsPromptPreviewOpen(false)}>
          <div className="bg-[var(--bg-secondary)] rounded-xl shadow-xl p-5 w-full max-w-2xl border border-[var(--border-primary)] m-4 animate-fade-in flex flex-col" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">AI Prompt Preview</h3>
            {isFetchingPreview ? (
              <div className="flex justify-center items-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-primary)]"></div></div>
            ) : promptPreviewContent ? (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto text-sm pr-2">
                <div>
                  <h4 className="font-semibold text-[var(--accent-primary)] mb-2">System Instruction</h4>
                  <textarea value={editableSystemInstruction} onChange={(e) => setEditableSystemInstruction(e.target.value)} rows={8} className="w-full bg-[var(--bg-primary)] p-3 rounded-md font-mono text-xs border border-[var(--border-primary)] outline-none resize-none" />
                </div>
                <div>
                  <h4 className="font-semibold text-[var(--accent-primary)] mb-2">Example User Prompt</h4>
                  <p className="bg-[var(--bg-tertiary)] p-3 rounded-md whitespace-pre-wrap font-mono text-xs">{promptPreviewContent.userPrompt}</p>
                </div>
              </div>
            ) : (
              <p className="text-red-400 bg-red-500/10 p-3 rounded-md">{promptPreviewError || 'An unknown error occurred.'}</p>
            )}
            <div className="mt-4 flex justify-end gap-2 pt-4 border-t border-[var(--border-primary)]">
              <button onClick={() => setIsPromptPreviewOpen(false)} className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Cancel</button>
              <button onClick={handleSaveFromPreview} className="bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-[var(--text-on-accent)] font-semibold px-4 py-2 rounded-lg text-sm">Save & Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SettingsModal;
