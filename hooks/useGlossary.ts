
import { useState, useEffect, useCallback, useRef } from 'react';
import { GlossaryEntry } from '../types';

const API_URL = '/api';

export const useGlossary = () => {
  const [glossaries, setGlossaries] = useState<Record<string, GlossaryEntry[]>>({});
  const prevGlossariesRef = useRef<Record<string, GlossaryEntry[]>>({});
  const timeoutsRef = useRef<Record<string, number>>({});

  // Fetch all glossaries on initial load
  useEffect(() => {
    const fetchGlossaries = async () => {
      try {
        const response = await fetch(`${API_URL}/glossaries/all`);
        if (!response.ok) throw new Error('Failed to fetch glossaries');
        const data = await response.json();
        setGlossaries(data);
        prevGlossariesRef.current = data;
      } catch (error) {
        console.error("Failed to load glossaries from server", error);
      }
    };
    fetchGlossaries();
  }, []);
  
  // Save a single project's glossary to the server
  const saveGlossaryToServer = useCallback(async (projectId: string, glossaryData: GlossaryEntry[]) => {
      try {
        const response = await fetch(`${API_URL}/glossaries/${projectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(glossaryData),
        });
        if (!response.ok) throw new Error('Failed to save glossary');
      } catch (error) {
        console.error(`Failed to save glossary for project ${projectId} to server`, error);
      }
  }, []);
  
  // Debounce save requests on a per-project basis
  const debouncedSave = useCallback((projectId: string, glossaryData: GlossaryEntry[]) => {
      if (timeoutsRef.current[projectId]) {
          clearTimeout(timeoutsRef.current[projectId]);
      }
      timeoutsRef.current[projectId] = window.setTimeout(() => {
          saveGlossaryToServer(projectId, glossaryData);
          delete timeoutsRef.current[projectId];
      }, 500);
  }, [saveGlossaryToServer]);

  // Effect to detect changes in any glossary and trigger debounced save
  useEffect(() => {
    const changedProjectIds = Object.keys({ ...glossaries, ...prevGlossariesRef.current }).filter(projectId => {
        return JSON.stringify(glossaries[projectId] || []) !== JSON.stringify(prevGlossariesRef.current[projectId] || []);
    });

    changedProjectIds.forEach(projectId => {
        const projectGlossary = glossaries[projectId];
        if (projectGlossary) { // Glossary exists (wasn't deleted)
            debouncedSave(projectId, projectGlossary);
        }
    });

    prevGlossariesRef.current = glossaries;
  }, [glossaries, debouncedSave]);

  const addTerm = useCallback((projectId: string, term: GlossaryEntry) => {
    if (!projectId || !term.original || !term.translation) return;
    setGlossaries(prev => {
      const projectGlossary = prev[projectId] || [];
      const existing = projectGlossary.some(entry => entry.original.toLowerCase() === term.original.toLowerCase());
      let newProjectGlossary;
      if (existing) {
        newProjectGlossary = projectGlossary.map(entry => entry.original.toLowerCase() === term.original.toLowerCase() ? term : entry);
      } else {
        newProjectGlossary = [...projectGlossary, term];
      }
      return { ...prev, [projectId]: newProjectGlossary.sort((a, b) => a.original.localeCompare(b.original)) };
    });
  }, []);

  const removeTerm = useCallback((projectId: string, original: string) => {
    if (!projectId) return;
    setGlossaries(prev => {
      const projectGlossary = prev[projectId] || [];
      const newProjectGlossary = projectGlossary.filter(entry => entry.original !== original);
      return { ...prev, [projectId]: newProjectGlossary };
    });
  }, []);
  
  const updateTerm = useCallback((projectId: string, oldOriginal: string, newEntry: GlossaryEntry) => {
    if (!projectId || !newEntry.original || !newEntry.translation) return;
    setGlossaries(prev => {
      const projectGlossary = prev[projectId] || [];
      const newProjectGlossary = projectGlossary.map(entry =>
        entry.original === oldOriginal ? newEntry : entry
      );
      return {
        ...prev,
        [projectId]: newProjectGlossary.sort((a, b) => a.original.localeCompare(b.original))
      };
    });
  }, []);

  const deleteGlossary = useCallback(async (projectId: string) => {
    if (!projectId) return;
    
    // Optimistic UI update
    setGlossaries(prev => {
      const newGlossaries = { ...prev };
      delete newGlossaries[projectId];
      return newGlossaries;
    });

    try {
      const response = await fetch(`${API_URL}/glossaries/${projectId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete glossary from server');
    } catch (error) {
       console.error(`Failed to delete glossary for project ${projectId}`, error);
       // In a real-world app, you might want to revert the state here on failure.
    }
  }, []);
  
  return { glossaries, addTerm, removeTerm, updateTerm, deleteGlossary };
};
