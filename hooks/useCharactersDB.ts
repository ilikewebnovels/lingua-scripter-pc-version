import { useState, useEffect, useCallback, useRef } from 'react';
import { Character } from '../types';

const API_URL = 'http://localhost:3001/api';

export const useCharactersDB = () => {
  const [characterDBs, setCharacterDBs] = useState<Record<string, Character[]>>({});
  const prevCharacterDBsRef = useRef<Record<string, Character[]>>({});
  const timeoutsRef = useRef<Record<string, number>>({});

  // Fetch all character databases on initial load
  useEffect(() => {
    const fetchCharacterDBs = async () => {
      try {
        const response = await fetch(`${API_URL}/characters/all`);
        if (!response.ok) throw new Error('Failed to fetch character databases');
        const data = await response.json();
        setCharacterDBs(data);
        prevCharacterDBsRef.current = data;
      } catch (error) {
        console.error("Failed to load character databases from server", error);
      }
    };
    fetchCharacterDBs();
  }, []);

  // Save a single project's character DB to the server
  const saveCharacterDBToServer = useCallback(async (projectId: string, characterData: Character[]) => {
    try {
      const response = await fetch(`${API_URL}/characters/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(characterData),
      });
      if (!response.ok) throw new Error('Failed to save character database');
    } catch (error) {
      console.error(`Failed to save character DB for project ${projectId} to server`, error);
    }
  }, []);

  // Debounce save requests on a per-project basis
  const debouncedSave = useCallback((projectId: string, characterData: Character[]) => {
    if (timeoutsRef.current[projectId]) {
      clearTimeout(timeoutsRef.current[projectId]);
    }
    timeoutsRef.current[projectId] = window.setTimeout(() => {
      saveCharacterDBToServer(projectId, characterData);
      delete timeoutsRef.current[projectId];
    }, 500);
  }, [saveCharacterDBToServer]);

  // Effect to detect changes in any character DB and trigger debounced save
  useEffect(() => {
    Object.keys({ ...characterDBs, ...prevCharacterDBsRef.current }).forEach(projectId => {
      if (JSON.stringify(characterDBs[projectId] || []) !== JSON.stringify(prevCharacterDBsRef.current[projectId] || [])) {
        const projectDB = characterDBs[projectId];
        if (projectDB) { // DB exists (wasn't deleted)
          debouncedSave(projectId, projectDB);
        }
      }
    });

    prevCharacterDBsRef.current = characterDBs;
  }, [characterDBs, debouncedSave]);

  const addCharacter = useCallback((projectId: string, character: Omit<Character, 'id'>) => {
    if (!projectId || !character.name) return;
    setCharacterDBs(prev => {
      const projectDB = prev[projectId] || [];
      const existing = projectDB.some(entry => entry.name.toLowerCase() === character.name.toLowerCase());
      if (existing) {
        return prev; // Don't add if character already exists
      }
      const characterWithDefaults = {
        ...character,
        translatedName: character.translatedName || character.name, // Default translated to original
      };
      const newCharacter = { ...characterWithDefaults, id: crypto.randomUUID() };
      const newProjectDB = [...projectDB, newCharacter];
      return { ...prev, [projectId]: newProjectDB.sort((a, b) => a.name.localeCompare(b.name)) };
    });
  }, []);

  const addCharacters = useCallback((projectId: string, characters: Omit<Character, 'id'>[]) => {
    console.log('[useCharactersDB] addCharacters called - projectId:', projectId, 'characters:', characters);
    if (!projectId || characters.length === 0) {
      console.log('[useCharactersDB] Early return - no projectId or empty characters');
      return;
    }
    setCharacterDBs(prev => {
      const projectDB = prev[projectId] || [];
      console.log('[useCharactersDB] Existing characters in project:', projectDB.length);
      const newCharacters = characters.filter(charToAdd =>
        !projectDB.some(existingChar => existingChar.name.toLowerCase() === charToAdd.name.toLowerCase())
      ).map(c => ({
        ...c,
        translatedName: c.translatedName || c.name, // Default translated to original if missing from AI
        id: crypto.randomUUID()
      }));

      console.log('[useCharactersDB] New characters after filtering duplicates:', newCharacters.length);
      if (newCharacters.length === 0) {
        console.log('[useCharactersDB] All characters were duplicates, no changes');
        return prev;
      }

      const newProjectDB = [...projectDB, ...newCharacters];
      console.log('[useCharactersDB] Updated project character count:', newProjectDB.length);
      return { ...prev, [projectId]: newProjectDB.sort((a, b) => a.name.localeCompare(b.name)) };
    });
  }, []);


  const removeCharacter = useCallback((projectId: string, id: string) => {
    if (!projectId) return;
    setCharacterDBs(prev => {
      const projectDB = prev[projectId] || [];
      const newProjectDB = projectDB.filter(entry => entry.id !== id);
      return { ...prev, [projectId]: newProjectDB };
    });
  }, []);

  const updateCharacter = useCallback((projectId: string, id: string, updatedCharacter: Character) => {
    if (!projectId || !updatedCharacter.name) return;
    setCharacterDBs(prev => {
      const projectDB = prev[projectId] || [];
      const newProjectDB = projectDB.map(entry =>
        entry.id === id ? updatedCharacter : entry
      );
      return {
        ...prev,
        [projectId]: newProjectDB.sort((a, b) => a.name.localeCompare(b.name))
      };
    });
  }, []);

  const deleteCharacterDB = useCallback(async (projectId: string) => {
    if (!projectId) return;

    setCharacterDBs(prev => {
      const newDBs = { ...prev };
      delete newDBs[projectId];
      return newDBs;
    });

    try {
      const response = await fetch(`${API_URL}/characters/${projectId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete character database from server');
    } catch (error) {
      console.error(`Failed to delete character database for project ${projectId}`, error);
    }
  }, []);

  const updateCharacterEntryWithGenderInfo = useCallback((projectId: string, characterName: string, newGender: string, newPronouns: string) => {
    if (!projectId || !characterName || !newGender || !newPronouns) return;

    setCharacterDBs(prev => {
      const projectDB = prev[projectId] || [];
      const newProjectDB = projectDB.map(entry => {
        // Check if this is the character we want to update
        // We match by name and check if current gender is "Unknown" and pronouns are "they/them"
        if (
          entry.name.toLowerCase() === characterName.toLowerCase() &&
          entry.gender === "Unknown" &&
          entry.pronouns === "they/them"
        ) {
          // Update the entry with the new gender and pronouns
          return {
            ...entry,
            gender: newGender,
            pronouns: newPronouns
          };
        }
        return entry;
      });

      // Only update state if changes were made
      if (JSON.stringify(projectDB) !== JSON.stringify(newProjectDB)) {
        return {
          ...prev,
          [projectId]: newProjectDB.sort((a, b) => a.name.localeCompare(b.name))
        };
      }

      return prev;
    });
  }, []);

  return { characterDBs, addCharacter, addCharacters, removeCharacter, updateCharacter, deleteCharacterDB, updateCharacterEntryWithGenderInfo };
};