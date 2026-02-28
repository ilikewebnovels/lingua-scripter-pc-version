import { useState, useCallback } from 'react';
import { Chapter } from '../types';

const API_URL = 'http://localhost:3001/api';

export const useChapters = () => {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null);

  // Fetch chapters for a specific project (lazy loading)
  const fetchChaptersByProject = useCallback(async (projectId: string | null) => {
    if (!projectId) {
      setChapters([]);
      return;
    }

    setLoadingProjectId(projectId);
    try {
      const response = await fetch(`${API_URL}/chapters/project/${projectId}`);
      if (!response.ok) throw new Error('Failed to fetch chapters');
      setChapters(await response.json());
    } catch (error) {
      console.error("Failed to load chapters for project", error);
      setChapters([]);
    } finally {
      setLoadingProjectId(null);
    }
  }, []);

  // Fetch all chapters (for backup restore)
  const fetchAllChapters = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/chapters`);
      if (!response.ok) throw new Error('Failed to fetch chapters');
      return await response.json();
    } catch (error) {
      console.error("Failed to load all chapters", error);
      return [];
    }
  }, []);

  const addChapter = useCallback(async (chapterData: Omit<Chapter, 'id' | 'createdAt' | 'updatedAt' | 'chapterNumber'>): Promise<Chapter> => {
    const chapterToSend = {
      ...chapterData,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    try {
      const response = await fetch(`${API_URL}/chapters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chapterToSend),
      });
      if (!response.ok) throw new Error('Failed to save chapter');
      const savedChapter: Chapter = await response.json();
      setChapters(prev => [...prev, savedChapter]);
      return savedChapter;
    } catch (error) {
      console.error("Failed to add chapter", error);
      throw error;
    }
  }, []);

  const updateChapter = useCallback(async (id: string, updates: Partial<Omit<Chapter, 'id' | 'projectId' | 'createdAt'>>) => {
    try {
      const response = await fetch(`${API_URL}/chapters/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update chapter');
      const updatedChapter = await response.json();
      setChapters(prev => prev.map(c => c.id === id ? updatedChapter : c));
    } catch (error) {
      console.error("Failed to update chapter", error);
    }
  }, []);

  const deleteChapter = useCallback(async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/chapters/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete chapter');
      setChapters(prev => prev.filter(chapter => chapter.id !== id));
    } catch (error) {
      console.error("Failed to delete chapter", error);
      throw error;
    }
  }, []);

  const deleteChaptersByProjectId = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`${API_URL}/chapters/by-project/${projectId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete chapters');
      setChapters(prev => prev.filter(chapter => chapter.projectId !== projectId));
    } catch (error) {
      console.error("Failed to delete chapters for project", error);
    }
  }, []);

  // Batch add chapters (for import - much faster than individual addChapter calls)
  // Chunks large imports to avoid request size limits
  const addChaptersBatch = useCallback(async (
    chaptersData: Omit<Chapter, 'id' | 'createdAt' | 'updatedAt' | 'chapterNumber'>[],
    onProgress?: (current: number, total: number) => void
  ): Promise<Chapter[]> => {
    // Prepare all chapters with IDs and timestamps
    const chaptersToSend = chaptersData.map(chapter => ({
      ...chapter,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));

    const CHUNK_SIZE = 50; // Process 50 chapters at a time
    const allSavedChapters: Chapter[] = [];
    let processed = 0;

    try {
      onProgress?.(0, chaptersToSend.length);

      // Split into chunks for large imports
      for (let i = 0; i < chaptersToSend.length; i += CHUNK_SIZE) {
        const chunk = chaptersToSend.slice(i, i + CHUNK_SIZE);

        const response = await fetch(`${API_URL}/chapters/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chapters: chunk }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to save chapters batch');
        }

        const { chapters: savedChapters } = await response.json();
        allSavedChapters.push(...savedChapters);
        processed += chunk.length;
        onProgress?.(processed, chaptersToSend.length);
      }

      setChapters(prev => [...prev, ...allSavedChapters]);
      return allSavedChapters;
    } catch (error) {
      console.error("Failed to add chapters batch", error);
      throw error;
    }
  }, []);

  return {
    chapters,
    loadingProjectId,
    fetchChaptersByProject,
    fetchAllChapters,
    addChapter,
    updateChapter,
    deleteChapter,
    deleteChaptersByProjectId,
    addChaptersBatch
  };
};