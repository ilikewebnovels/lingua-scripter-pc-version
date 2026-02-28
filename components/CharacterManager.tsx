import React, { useState, useMemo, useEffect } from 'react';
import { Character } from '../types';

interface CharacterManagerProps {
  characters: Character[];
  addCharacter: (character: Omit<Character, 'id'>) => void;
  removeCharacter: (id: string) => void;
  updateCharacter: (id: string, newEntry: Character) => void;
  isAnalyzing: boolean;
  activeCharacters: Character[];
}

const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
const PencilIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const CheckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>;
const XIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>;
const LoadingSpinner = () => <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>;
const ActiveIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-400" viewBox="0 0 20 20" fill="currentColor"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
const SearchIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[var(--text-secondary)]" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>;
const ChevronLeftIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>;
const ChevronRightIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>;

const ITEMS_PER_PAGE = 10;

const CharacterManager: React.FC<CharacterManagerProps> = ({ characters, addCharacter, removeCharacter, updateCharacter, isAnalyzing, activeCharacters }) => {
  const [form, setForm] = useState({ name: '', translatedName: '', gender: '', pronouns: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Character | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredCharacters = useMemo(() => {
    if (!searchQuery.trim()) return characters;
    const query = searchQuery.toLowerCase();
    return characters.filter(char =>
      char.name.toLowerCase().includes(query) ||
      char.translatedName.toLowerCase().includes(query) ||
      char.gender.toLowerCase().includes(query) ||
      char.pronouns.toLowerCase().includes(query)
    );
  }, [characters, searchQuery]);

  const paginatedCharacters = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCharacters.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredCharacters, currentPage]);

  const totalPages = Math.ceil(filteredCharacters.length / ITEMS_PER_PAGE);

  // Reset page when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name.trim()) {
      addCharacter(form);
      setForm({ name: '', translatedName: '', gender: '', pronouns: '' });
    }
  };

  const handleStartEdit = (character: Character) => {
    setEditingId(character.id);
    setEditForm(character);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId && editForm && editForm.name.trim()) {
      updateCharacter(editingId, editForm);
      setEditingId(null);
      setEditForm(null);
    }
  };

  return (
    <div className="bg-[var(--bg-secondary)] rounded-md p-4 flex flex-col border border-[var(--border-primary)]">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-[var(--accent-primary)]">Characters</h2>
        {isAnalyzing && (
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <LoadingSpinner />
            <span>Analyzing...</span>
          </div>
        )}
      </div>
      <form onSubmit={handleAdd} className="grid grid-cols-2 gap-2 mb-4">
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
          placeholder="Original Name"
          className="col-span-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] outline-none transition"
        />
        <input
          type="text"
          value={form.translatedName}
          onChange={(e) => setForm(p => ({ ...p, translatedName: e.target.value }))}
          placeholder="Translated Name (optional)"
          className="col-span-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] outline-none transition"
        />
        <input
          type="text"
          value={form.gender}
          onChange={(e) => setForm(p => ({ ...p, gender: e.target.value }))}
          placeholder="Gender"
          className="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] outline-none transition"
        />
        <input
          type="text"
          value={form.pronouns}
          onChange={(e) => setForm(p => ({ ...p, pronouns: e.target.value }))}
          placeholder="Pronouns"
          className="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] outline-none transition"
        />
        <button
          type="submit"
          className="col-span-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-[var(--text-on-accent)] font-semibold py-2 rounded-md flex items-center justify-center transition-colors disabled:bg-gray-600"
          disabled={!form.name.trim()}
        >
          <PlusIcon />
        </button>
      </form>
      {characters.length > 0 && (
        <div className="relative mb-3">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <SearchIcon />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search characters..."
            className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-md py-1.5 pl-10 pr-3 text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] outline-none transition"
          />
        </div>
      )}
      <div>
        {characters.length === 0 ? (
          <p className="text-[var(--text-secondary)] text-sm text-center py-4">No characters found yet. They will be added automatically during translation.</p>
        ) : filteredCharacters.length === 0 ? (
          <p className="text-[var(--text-secondary)] text-sm text-center py-4">No characters match your search.</p>
        ) : (
          <>
            <ul className="space-y-2">
              {paginatedCharacters.map((char) => {
                const isActive = activeCharacters.some(activeChar => activeChar.id === char.id);
                return (
                  <li key={char.id} className="text-sm group">
                    {editingId === char.id && editForm ? (
                      <form onSubmit={handleUpdate} className="flex-1 flex flex-col gap-2 p-2 bg-[var(--bg-tertiary)] rounded-md border border-[var(--border-primary)]">
                        <input type="text" placeholder="Original Name" value={editForm.name} onChange={(e) => setEditForm(p => p ? { ...p, name: e.target.value } : null)} className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-2 py-1 text-sm text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] outline-none" />
                        <input type="text" placeholder="Translated Name" value={editForm.translatedName} onChange={(e) => setEditForm(p => p ? { ...p, translatedName: e.target.value } : null)} className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-2 py-1 text-sm text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] outline-none" />
                        <div className="grid grid-cols-2 gap-2">
                          <input type="text" placeholder="Gender" value={editForm.gender} onChange={(e) => setEditForm(p => p ? { ...p, gender: e.target.value } : null)} className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-2 py-1 text-sm text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] outline-none" />
                          <input type="text" placeholder="Pronouns" value={editForm.pronouns} onChange={(e) => setEditForm(p => p ? { ...p, pronouns: e.target.value } : null)} className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-2 py-1 text-sm text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] outline-none" />
                        </div>
                        <div className="flex items-center gap-2 justify-end mt-1">
                          <button type="submit" className="text-[var(--text-secondary)] hover:text-[var(--success-primary)] p-1" aria-label="Save changes"><CheckIcon /></button>
                          <button type="button" onClick={handleCancelEdit} className="text-[var(--text-secondary)] hover:text-[var(--danger-primary)] p-1" aria-label="Cancel edit"><XIcon /></button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex justify-between items-start bg-[var(--bg-tertiary)] p-2 rounded-md">
                        <div className="flex-1 min-w-0 flex items-start gap-2">
                          {isActive && (
                            <span className="pt-0.5 flex-shrink-0" title="This entry is present in the original text and will be sent to the AI.">
                              <ActiveIcon />
                            </span>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="truncate">
                              <span className="font-semibold text-[var(--text-primary)]">{char.name}</span>
                              <span className="text-[var(--text-secondary)] mx-1.5">→</span>
                              <span className="font-semibold text-[var(--accent-primary)]">{char.translatedName}</span>
                            </p>
                            <p className="text-[var(--text-secondary)] text-xs truncate">
                              {char.gender && char.pronouns ? `${char.gender}, ${char.pronouns}` : char.gender || char.pronouns}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button onClick={() => handleStartEdit(char)} className="text-[var(--text-secondary)] hover:text-[var(--accent-secondary)]" aria-label={`Edit ${char.name}`}><PencilIcon /></button>
                          <button onClick={() => removeCharacter(char.id)} className="text-[var(--text-secondary)] hover:text-[var(--danger-secondary)]" aria-label={`Remove ${char.name}`}><TrashIcon /></button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-3 pt-2 border-t border-[var(--border-primary)]">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1 rounded-md hover:bg-[var(--bg-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--text-secondary)]"
                  aria-label="Previous page"
                >
                  <ChevronLeftIcon />
                </button>
                <span className="text-sm text-[var(--text-secondary)]">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded-md hover:bg-[var(--bg-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--text-secondary)]"
                  aria-label="Next page"
                >
                  <ChevronRightIcon />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default React.memo(CharacterManager);