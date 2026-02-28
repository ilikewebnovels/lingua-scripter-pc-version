import React, { useState, useMemo, useRef } from 'react';
import { Project, Chapter, GlossaryEntry, Character } from '../types';
import GlossaryManager from './GlossaryManager';
import CharacterManager from './CharacterManager';

const FolderIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>;
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
const FileTextIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const SearchIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[var(--text-secondary)]" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>;
const ImageIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>;
const PencilIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const ExportIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>;
const ImportIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>;

const ChartIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg>;
const BackupIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M5.5 13a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 13H11V9.413l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13H5.5z" /><path d="M9 13h2v5a1 1 0 11-2 0v-5z" /></svg>;

interface ProjectSidebarProps {
  isOpen: boolean;
  projects: Project[];
  chapters: Chapter[];
  activeProjectId: string | null;
  activeChapterId: string | null;
  onSelectProject: (id: string | null) => void;
  onSelectChapter: (id: string) => void;
  onAddProject: (name: string, profilePic: string | null) => Promise<Project>;
  onUpdateProjectProfilePic: (projectId: string, profilePic: string) => void;
  onDeleteProject: (id: string) => void;
  onDeleteChapter: (id: string) => void;
  onDeleteChapters: (projectId: string) => void;
  onDeleteGlossary: (projectId: string) => void;
  onDeleteCharacterDB: (projectId: string) => void;
  onNewChapter: () => void;
  onOpenExportModal: () => void;
  onOpenImportModal: () => void;
  onOpenBatchTranslate: () => void;

  onOpenStatistics: () => void;
  onOpenBackupRestore: () => void;
  // Glossary Props
  glossary: GlossaryEntry[];
  addTerm: (term: GlossaryEntry) => void;
  removeTerm: (original: string) => void;
  updateTerm: (oldOriginal: string, newEntry: GlossaryEntry) => void;
  activeGlossaryTerms: GlossaryEntry[];
  // Character DB Props
  characterDB: Character[];
  addCharacters: (characters: Omit<Character, 'id'>[]) => void;
  removeCharacter: (id: string) => void;
  updateCharacter: (id: string, newEntry: Character) => void;
  isAnalyzingCharacters: boolean;
  activeCharacters: Character[];
}

const ChevronLeftIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>;
const ChevronRightIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>;

const ITEMS_PER_PAGE = 10;

const ProjectSidebar: React.FC<ProjectSidebarProps> = ({
  isOpen,
  projects,
  chapters,
  activeProjectId,
  activeChapterId,
  onSelectProject,
  onSelectChapter,
  onAddProject,
  onUpdateProjectProfilePic,
  onDeleteProject,
  onDeleteChapter,
  onDeleteChapters,
  onDeleteGlossary,
  onDeleteCharacterDB,
  onNewChapter,
  onOpenExportModal,
  onOpenImportModal,
  onOpenBatchTranslate,

  onOpenStatistics,
  onOpenBackupRestore,
  glossary,
  addTerm,
  removeTerm,
  updateTerm,
  activeGlossaryTerms,
  characterDB,
  addCharacters,
  removeCharacter,
  updateCharacter,
  isAnalyzingCharacters,
  activeCharacters
}) => {
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectPic, setNewProjectPic] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [chapterSearchQuery, setChapterSearchQuery] = useState('');
  const [chapterPage, setChapterPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'glossary' | 'characters'>('glossary');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeProjectChapters = useMemo(() => {
    if (!activeProjectId) return [];
    return chapters
      .filter(c => c.projectId === activeProjectId)
      .sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0) || a.title.localeCompare(b.title));
  }, [chapters, activeProjectId]);

  const filteredChapters = useMemo(() => {
    if (!chapterSearchQuery.trim()) return activeProjectChapters;
    const query = chapterSearchQuery.toLowerCase();
    return activeProjectChapters.filter(c =>
      c.title.toLowerCase().includes(query) ||
      c.chapterNumber.toString().includes(query)
    );
  }, [activeProjectChapters, chapterSearchQuery]);

  const paginatedChapters = useMemo(() => {
    const startIndex = (chapterPage - 1) * ITEMS_PER_PAGE;
    return filteredChapters.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredChapters, chapterPage]);

  const totalChapterPages = Math.ceil(filteredChapters.length / ITEMS_PER_PAGE);

  // Reset chapter page when search query changes or project changes
  React.useEffect(() => {
    setChapterPage(1);
  }, [chapterSearchQuery, activeProjectId]);

  const filteredProjects = useMemo(() => {
    if (searchQuery.trim()) {
      return projects.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (activeProjectId) {
      return projects.filter(p => p.id === activeProjectId);
    }
    return projects;
  }, [projects, searchQuery, activeProjectId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'image/png') {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        setNewProjectPic(loadEvent.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>, projectId: string) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'image/png') {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const base64String = loadEvent.target?.result as string;
        if (base64String) {
          onUpdateProjectProfilePic(projectId, base64String);
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newProjectName.trim()) {
      const newProject = await onAddProject(newProjectName, newProjectPic);
      onSelectProject(newProject.id);
      setNewProjectName('');
      setNewProjectPic(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteProject = (e: React.MouseEvent, projectId: string, projectName: string) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete the project "${projectName}" and all its chapters, glossary, and character entries? This action cannot be undone.`)) {
      onDeleteProject(projectId);
      onDeleteChapters(projectId);
      onDeleteGlossary(projectId);
      onDeleteCharacterDB(projectId);
      if (activeProjectId === projectId) {
        onSelectProject(null);
      }
    }
  }

  return (
    <aside className={`bg-[var(--bg-secondary)] border-r border-[var(--border-primary)] flex flex-col h-screen transition-all duration-300 ease-in-out ${isOpen ? 'w-full md:w-80 lg:w-96' : 'w-0'}`}>
      <div className="h-full flex flex-col overflow-y-auto pb-4">
        {/* Active Project Header with Back Button */}
        <div className="p-4 border-b border-[var(--border-primary)]">
          <button
            onClick={() => onSelectProject(null)}
            className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors mb-3"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Back to Projects
          </button>

          {/* Active Project Display */}
          {activeProjectId && (
            <div className="flex items-center gap-3">
              {(() => {
                const activeProject = projects.find(p => p.id === activeProjectId);
                return activeProject ? (
                  <>
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[var(--bg-tertiary)] overflow-hidden flex items-center justify-center border border-[var(--border-primary)]">
                      {activeProject.profilePic ? (
                        <img
                          src={`http://localhost:3001${activeProject.profilePic}?t=${activeProject.updatedAt}`}
                          alt={activeProject.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FolderIcon />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-bold text-[var(--accent-primary)] truncate">{activeProject.name}</h2>
                      <p className="text-xs text-[var(--text-secondary)]">Current Project</p>
                    </div>
                  </>
                ) : null;
              })()}
            </div>
          )}
        </div>

        {/* Chapters Section */}
        <div className="p-4 border-t border-[var(--border-primary)]">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-bold text-[var(--accent-primary)]">Chapters</h2>
            {activeProjectId && (
              <div className="flex items-center gap-2">
                <button onClick={onOpenBatchTranslate} className="text-sm flex items-center gap-1 text-[var(--accent-primary)] hover:underline" title="Batch Translate Chapters">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></svg>
                  Batch
                </button>
                <button onClick={onOpenImportModal} className="text-sm flex items-center gap-1 text-[var(--accent-primary)] hover:underline" title="Import Chapters from File">
                  <ImportIcon /> Import
                </button>
                <button onClick={onOpenExportModal} className="text-sm flex items-center gap-1 text-[var(--accent-primary)] hover:underline" title="Export Project as PDF">
                  <ExportIcon /> Export
                </button>
                <button onClick={onNewChapter} className="text-sm flex items-center gap-1 text-[var(--accent-primary)] hover:underline" title="Create New Chapter">
                  <PlusIcon /> New
                </button>
              </div>
            )}
          </div>
          {activeProjectId ? (
            <>
              <div className="relative mb-2">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <SearchIcon />
                </span>
                <input
                  type="text"
                  value={chapterSearchQuery}
                  onChange={(e) => setChapterSearchQuery(e.target.value)}
                  placeholder="Search chapters..."
                  className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-md py-1.5 pl-10 pr-3 text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] outline-none transition"
                />
              </div>
              <ul className="space-y-1">
                {paginatedChapters.map(c => (
                  <li key={c.id} className="group/chapter flex items-center justify-between gap-2 rounded-md transition-all duration-200">
                    <button
                      onClick={() => onSelectChapter(c.id)}
                      className={`w-full text-left flex items-center gap-2 p-1.5 rounded-md text-sm truncate flex-1 min-w-0 ${activeChapterId === c.id
                        ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] font-semibold'
                        : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                        }`}
                    >
                      <FileTextIcon />
                      <span className="truncate">
                        <span className="font-mono text-sm text-[var(--text-secondary)] w-8 inline-block pr-2 text-right">{c.chapterNumber}.</span>
                        {c.title || 'Untitled Chapter'}
                      </span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Are you sure you want to delete the chapter "${c.title}"? This action cannot be undone.`)) {
                          onDeleteChapter(c.id);
                        }
                      }}
                      className="text-[var(--text-secondary)] hover:text-[var(--danger-secondary)] p-1 rounded-full hover:bg-red-500/20 opacity-0 group-hover/chapter:opacity-100 transition-opacity flex-shrink-0"
                      aria-label={`Delete chapter ${c.title}`}
                      title="Delete Chapter"
                    >
                      <TrashIcon />
                    </button>
                  </li>
                ))}
                {filteredChapters.length === 0 && chapterSearchQuery && (
                  <p className="text-[var(--text-secondary)] text-sm text-center py-4">No chapters match your search.</p>
                )}
                {activeProjectChapters.length === 0 && !chapterSearchQuery && (
                  <p className="text-[var(--text-secondary)] text-sm text-center py-4">No chapters yet.</p>
                )}
              </ul>
              {totalChapterPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-3 pt-2 border-t border-[var(--border-primary)]">
                  <button
                    onClick={() => setChapterPage(p => Math.max(1, p - 1))}
                    disabled={chapterPage === 1}
                    className="p-1 rounded-md hover:bg-[var(--bg-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--text-secondary)]"
                    aria-label="Previous page"
                  >
                    <ChevronLeftIcon />
                  </button>
                  <span className="text-sm text-[var(--text-secondary)]">
                    {chapterPage} / {totalChapterPages}
                  </span>
                  <button
                    onClick={() => setChapterPage(p => Math.min(totalChapterPages, p + 1))}
                    disabled={chapterPage === totalChapterPages}
                    className="p-1 rounded-md hover:bg-[var(--bg-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--text-secondary)]"
                    aria-label="Next page"
                  >
                    <ChevronRightIcon />
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="text-[var(--text-secondary)] text-sm text-center py-4">Select a project to see its chapters.</p>
          )}
        </div>

        {/* Glossary & Characters Section */}
        <div className="relative p-4 border-t border-[var(--border-primary)] flex flex-col">
          <div className="mb-4 flex-shrink-0">
            <div className="flex gap-1 rounded-md bg-[var(--bg-tertiary)] p-1 border border-[var(--border-primary)]">
              <button
                onClick={() => setActiveTab('glossary')}
                className={`flex-1 text-sm py-1.5 rounded-md transition-colors ${activeTab === 'glossary' ? 'bg-[var(--accent-primary)] text-[var(--text-on-accent)] font-semibold shadow' : 'text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/5'}`}
              >
                Glossary
              </button>
              <button
                onClick={() => setActiveTab('characters')}
                className={`flex-1 text-sm py-1.5 rounded-md transition-colors ${activeTab === 'characters' ? 'bg-[var(--accent-primary)] text-[var(--text-on-accent)] font-semibold shadow' : 'text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/5'}`}
              >
                Characters
              </button>
            </div>
          </div>
          <div>
            {activeTab === 'glossary' ? (
              <GlossaryManager
                glossary={glossary}
                addTerm={addTerm}
                removeTerm={removeTerm}
                updateTerm={updateTerm}
                activeGlossaryTerms={activeGlossaryTerms}
              />
            ) : (
              <CharacterManager
                characters={characterDB}
                addCharacter={(char) => addCharacters([char])}
                removeCharacter={removeCharacter}
                updateCharacter={updateCharacter}
                isAnalyzing={isAnalyzingCharacters}
                activeCharacters={activeCharacters}
              />
            )}
          </div>
          {!activeProjectId && (
            <div className="absolute inset-0 flex items-center justify-center p-4 bg-[var(--bg-secondary)]/80 backdrop-blur-sm rounded-b-lg">
              <p className="text-[var(--text-secondary)] text-sm font-semibold text-center">
                Select a project to manage its data.
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default React.memo(ProjectSidebar);