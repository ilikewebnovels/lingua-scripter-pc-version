

import { useState, useEffect, useCallback } from 'react';
import { Settings } from '../types';

const API_URL = '/api';

const DEFAULT_SETTINGS: Settings = {
  provider: 'gemini',
  apiKey: '',
  deepseekApiKey: '',
  openRouterApiKey: '',
  openaiApiKey: '',
  openaiEndpoint: '',
  openRouterModelProviders: '',
  model: 'gemini-2.5-flash',
  theme: 'blue',
  fontFamily: 'font-sans',
  fontSize: 1, // Represents 1rem
  fontColor: '', // Empty string means use theme default
  temperature: 0.5,
  sourceLanguage: 'Auto-detect',
  targetLanguage: 'English',
  systemInstruction: 'You are an expert translator specializing in webnovels. First, detect the language of the provided text, then translate it into fluent, natural {{targetLanguage}}. Your primary goal is to preserve the original tone and narrative style. When a glossary is provided, you MUST adhere to it strictly for the specified terms. You may also be provided with Character Information for context (including their original and translated names); use this to ensure consistent character details (like names and pronouns) in your translation.',
  isStreamingEnabled: true,
  isTranslationMemoryEnabled: true,
  isAutoCharacterDetectionEnabled: true,
  reasoningEffort: 'auto',
  batchSkipTranslated: true,
  batchSize: 10,
};

export const useSettings = () => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch(`${API_URL}/settings`);
        if (!response.ok) throw new Error('Failed to fetch settings');
        const data = await response.json();
        // Ensure all keys from DEFAULT_SETTINGS are present
        const completeSettings = { ...DEFAULT_SETTINGS, ...data };
        setSettings(completeSettings);
      } catch (error) {
        console.error("Failed to load settings from server, using defaults.", error);
        // If the server isn't running or there's an error, we stick with defaults
        setSettings(DEFAULT_SETTINGS);
      }
    };
    fetchSettings();
  }, []);

  const saveSettings = useCallback(async (newSettings: Partial<Settings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    try {
      const response = await fetch(`${API_URL}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings),
      });
      if (!response.ok) throw new Error('Failed to save settings');
    } catch (error) {
      console.error("Failed to save settings to server", error);
    }
  }, [settings]);

  return { settings, saveSettings };
};