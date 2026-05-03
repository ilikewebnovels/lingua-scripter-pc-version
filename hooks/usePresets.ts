
import { useState, useEffect, useCallback } from 'react';
import { Preset, PresetSettings } from '../types';

const API_URL = '/api';

export const usePresets = () => {
  const [presets, setPresets] = useState<Preset[]>([]);

  useEffect(() => {
    const fetchPresets = async () => {
      try {
        const response = await fetch(`${API_URL}/presets`);
        if (!response.ok) throw new Error('Failed to fetch presets');
        const data = await response.json();
        setPresets(data.sort((a: Preset, b: Preset) => a.name.localeCompare(b.name)));
      } catch (error) {
        console.error("Failed to load presets from server", error);
      }
    };
    fetchPresets();
  }, []);

  const addPreset = useCallback(async (name: string, settings: PresetSettings) => {
    if (!name.trim()) return;
    const newPreset: Preset = {
      id: crypto.randomUUID(),
      name: name.trim(),
      settings,
    };
    try {
        const response = await fetch(`${API_URL}/presets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newPreset),
        });
        if (!response.ok) throw new Error('Failed to save preset');
        const savedPreset = await response.json();
        setPresets(prev => [...prev, savedPreset].sort((a, b) => a.name.localeCompare(b.name)));
    } catch(error) {
        console.error('Failed to add preset', error);
    }
  }, []);

  const deletePreset = useCallback(async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/presets/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete preset');
      setPresets(prev => prev.filter(preset => preset.id !== id));
    } catch (error) {
        console.error('Failed to delete preset', error);
    }
  }, []);

  return { presets, addPreset, deletePreset };
};
