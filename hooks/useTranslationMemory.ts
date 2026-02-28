import { useState, useEffect, useCallback } from 'react';

const API_URL = 'http://localhost:3001/api';

export interface TranslationMemoryEntry {
  id: string;
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  createdAt: number;
  usedCount: number;
  lastUsedAt: number;
}

// Hash function to create a unique key for text
function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

// Normalize text for comparison (lowercase, trim, collapse whitespace)
function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

export function useTranslationMemory(projectId: string | null) {
  const [memory, setMemory] = useState<Record<string, TranslationMemoryEntry[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Load translation memory from server
  useEffect(() => {
    const loadMemory = async () => {
      try {
        const response = await fetch(`${API_URL}/translation-memory`);
        if (response.ok) {
          const data = await response.json();
          setMemory(data);
        }
      } catch (error) {
        console.error('Failed to load translation memory:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMemory();
  }, []);

  // Save memory to server (debounced)
  const saveMemory = useCallback(async (newMemory: Record<string, TranslationMemoryEntry[]>) => {
    try {
      await fetch(`${API_URL}/translation-memory`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMemory),
      });
    } catch (error) {
      console.error('Failed to save translation memory:', error);
    }
  }, []);

  // Add or update a translation in memory
  const addTranslation = useCallback((
    originalText: string,
    translatedText: string,
    sourceLanguage: string,
    targetLanguage: string
  ) => {
    if (!projectId || !originalText.trim() || !translatedText.trim()) return;

    const normalizedOriginal = normalizeText(originalText);
    const id = hashText(normalizedOriginal + sourceLanguage + targetLanguage);

    setMemory(prev => {
      const projectMemory = prev[projectId] || [];
      const existingIndex = projectMemory.findIndex(e => e.id === id);

      let updatedProjectMemory: TranslationMemoryEntry[];

      if (existingIndex >= 0) {
        // Update existing entry
        updatedProjectMemory = [...projectMemory];
        updatedProjectMemory[existingIndex] = {
          ...updatedProjectMemory[existingIndex],
          translatedText,
          usedCount: updatedProjectMemory[existingIndex].usedCount + 1,
          lastUsedAt: Date.now(),
        };
      } else {
        // Add new entry
        const newEntry: TranslationMemoryEntry = {
          id,
          originalText: originalText.trim(),
          translatedText: translatedText.trim(),
          sourceLanguage,
          targetLanguage,
          createdAt: Date.now(),
          usedCount: 1,
          lastUsedAt: Date.now(),
        };
        updatedProjectMemory = [...projectMemory, newEntry];
      }

      const newMemory = { ...prev, [projectId]: updatedProjectMemory };
      saveMemory(newMemory);
      return newMemory;
    });
  }, [projectId, saveMemory]);

  // Find a cached translation (exact or similar match)
  const findTranslation = useCallback((
    originalText: string,
    sourceLanguage: string,
    targetLanguage: string
  ): TranslationMemoryEntry | null => {
    if (!projectId || !originalText.trim()) return null;

    const projectMemory = memory[projectId] || [];
    const normalizedOriginal = normalizeText(originalText);

    // Look for exact match first
    const exactMatch = projectMemory.find(entry => {
      const normalizedEntry = normalizeText(entry.originalText);
      return normalizedEntry === normalizedOriginal &&
        entry.sourceLanguage === sourceLanguage &&
        entry.targetLanguage === targetLanguage;
    });

    return exactMatch || null;
  }, [projectId, memory]);

  // Find similar translations (for suggestions)
  const findSimilarTranslations = useCallback((
    originalText: string,
    sourceLanguage: string,
    targetLanguage: string,
    limit: number = 5
  ): TranslationMemoryEntry[] => {
    if (!projectId || !originalText.trim()) return [];

    const projectMemory = memory[projectId] || [];
    const normalizedOriginal = normalizeText(originalText);
    const words = new Set(normalizedOriginal.split(' '));

    // Score entries by word overlap
    const scored = projectMemory
      .filter(entry =>
        entry.sourceLanguage === sourceLanguage &&
        entry.targetLanguage === targetLanguage
      )
      .map(entry => {
        const entryWords = new Set(normalizeText(entry.originalText).split(' '));
        const intersection = [...words].filter(w => entryWords.has(w));
        const score = intersection.length / Math.max(words.size, entryWords.size);
        return { entry, score };
      })
      .filter(({ score }) => score > 0.3) // At least 30% word overlap
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map(({ entry }) => entry);
  }, [projectId, memory]);

  // Delete a translation from memory
  const deleteTranslation = useCallback((entryId: string) => {
    if (!projectId) return;

    setMemory(prev => {
      const projectMemory = prev[projectId] || [];
      const newProjectMemory = projectMemory.filter(e => e.id !== entryId);
      const newMemory = { ...prev, [projectId]: newProjectMemory };
      saveMemory(newMemory);
      return newMemory;
    });
  }, [projectId, saveMemory]);

  // Clear all translations for project
  const clearProjectMemory = useCallback(() => {
    if (!projectId) return;

    setMemory(prev => {
      const newMemory = { ...prev };
      delete newMemory[projectId];
      saveMemory(newMemory);
      return newMemory;
    });
  }, [projectId, saveMemory]);

  // Get memory stats
  const getStats = useCallback(() => {
    if (!projectId) return { totalEntries: 0, totalUsage: 0 };

    const projectMemory = memory[projectId] || [];
    return {
      totalEntries: projectMemory.length,
      totalUsage: projectMemory.reduce((sum, e) => sum + e.usedCount, 0),
    };
  }, [projectId, memory]);

  return {
    memory: projectId ? memory[projectId] || [] : [],
    isLoading,
    addTranslation,
    findTranslation,
    findSimilarTranslations,
    deleteTranslation,
    clearProjectMemory,
    getStats,
  };
}
