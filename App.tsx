import React, { useState, useMemo, useEffect, useCallback, useRef, Suspense, useDeferredValue } from 'react';
import GlossaryQuickAdd from './components/GlossaryQuickAdd';
import ProjectSidebar from './components/ProjectSidebar';
import WelcomeScreen from './components/WelcomeScreen';
import ProjectSelector from './components/ProjectSelector';
import CharacterAwareRenderer from './components/CharacterAwareRenderer';
import TextStats from './components/TextStats';
import TranslationMemoryIndicator from './components/TranslationMemoryIndicator';
import ModalLoader from './components/ModalLoader';
import ConnectionStatus, { ConnectionStatusType } from './components/ConnectionStatus';
import ActiveContextInfo from './components/ActiveContextInfo';
import BatchTranslationIndicator from './components/BatchTranslationIndicator';
import { useGlossary } from './hooks/useGlossary';
import { useCharactersDB } from './hooks/useCharactersDB';
import { useSettings } from './hooks/useSettings';
import { useProjects } from './hooks/useProjects';
import { useChapters } from './hooks/useChapters';
import { useTranslationMemory } from './hooks/useTranslationMemory';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { translateText, translateTextStream, testConnection, findOriginalPhrases, analyzeForCharacters } from './services/geminiService';
import { GlossaryEntry, Project, Character } from './types';

// Batch translation progress type
export type BatchChapterStatus = 'pending' | 'translating' | 'completed' | 'error';

export interface BatchTranslationProgress {
  chapterId: string;
  status: BatchChapterStatus;
  streamingText?: string;
}
import { TokenizerModel } from './utils/tokenizer';
import {
  MenuIcon,
  LogoIcon,
  LoadingSpinner,
  OutputPlaceholder,
  LoadingSkeleton,
  SettingsIcon,
  SaveIcon,
  ExpandIcon,
  CollapseIcon,
  CheckIcon,
  StopIcon,
  ClearIcon,
  CopyIcon,
  PencilIcon,
  ReloadIcon,
} from './components/icons';

// Lazy load heavy modals for faster initial load
const SettingsModal = React.lazy(() => import('./components/SettingsModal'));
const ExportModal = React.lazy(() => import('./components/ExportModal'));

const StatisticsDashboard = React.lazy(() => import('./components/StatisticsDashboard'));
const BackupRestoreModal = React.lazy(() => import('./components/BackupRestoreModal'));
const ImportModal = React.lazy(() => import('./components/ImportModal'));
const BatchTranslateModal = React.lazy(() => import('./components/BatchTranslateModal'));
const BatchTranslateTitlesModal = React.lazy(() => import('./components/BatchTranslateTitlesModal'));

// Import types separately (not lazy-loaded)
import type { ProjectBackup } from './components/BackupRestoreModal';




export default function App() {
  const { glossaries, addTerm, removeTerm, updateTerm, deleteGlossary } = useGlossary();
  const { characterDBs, addCharacters, removeCharacter, updateCharacter, deleteCharacterDB } = useCharactersDB();
  const { settings, saveSettings } = useSettings();
  const { projects, addProject, updateProjectProfilePic, updateProject, deleteProject } = useProjects();
  const { chapters, loadingProjectId, fetchChaptersByProject, fetchAllChapters, addChapter, updateChapter, deleteChapter, deleteChaptersByProjectId, addChaptersBatch } = useChapters();

  // App State
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);

  // Translation Memory
  const { addTranslation, findTranslation } = useTranslationMemory(activeProjectId);
  const [cachedTranslation, setCachedTranslation] = useState<ReturnType<typeof findTranslation>>(null);
  const [showCacheIndicator, setShowCacheIndicator] = useState(false);

  // Chapter Content State
  const [chapterTitle, setChapterTitle] = useState('');
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');

  // UI State
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzingCharacters, setIsAnalyzingCharacters] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTranslatedFullscreen, setIsTranslatedFullscreen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false); // New state for edit mode
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [scrollPosition, setScrollPosition] = useState(0);
  const [isScrollable, setIsScrollable] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const [isStatisticsOpen, setIsStatisticsOpen] = useState(false);
  const [isBackupRestoreOpen, setIsBackupRestoreOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isBatchTranslateOpen, setIsBatchTranslateOpen] = useState(false);
  const [isBatchTitleTranslateOpen, setIsBatchTitleTranslateOpen] = useState(false);
  const [isChapterListOpen, setIsChapterListOpen] = useState(false);
  const chapterListRef = useRef<HTMLDivElement>(null);

  // Translation Stats State
  const [translationTime, setTranslationTime] = useState<number | null>(null);
  const [selectedTokenizer, setSelectedTokenizer] = useState<TokenizerModel>('general');

  // Glossary selection flow state
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [isFindingOriginal, setIsFindingOriginal] = useState(false);
  const isTranslationCancelled = useRef(false);
  const translationAbortController = useRef<AbortController | null>(null);
  const translatedTextContainerRef = useRef<HTMLDivElement>(null);

  // Batch Translation State (lifted from BatchTranslateModal for persistence after modal close)
  const [isBatchTranslating, setIsBatchTranslating] = useState(false);
  const [batchChapterStatus, setBatchChapterStatus] = useState<Record<string, BatchChapterStatus>>({});
  const [batchStreamingChapterId, setBatchStreamingChapterId] = useState<string | null>(null);
  const [batchStreamingText, setBatchStreamingText] = useState<string>('');
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (chapterListRef.current && !chapterListRef.current.contains(event.target as Node)) {
        setIsChapterListOpen(false);
      }
    };
    if (isChapterListOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isChapterListOpen]);

  // Fetch chapters when project changes (lazy loading)
  useEffect(() => {
    fetchChaptersByProject(activeProjectId);
  }, [activeProjectId, fetchChaptersByProject]);

  // Connection State
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatusType>('idle');
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Active entries state for UI feedback
  const [activeGlossaryTerms, setActiveGlossaryTerms] = useState<GlossaryEntry[]>([]);
  const [activeCharacters, setActiveCharacters] = useState<Character[]>([]);

  const activeProject = useMemo(() => (
    projects.find(p => p.id === activeProjectId) || null
  ), [projects, activeProjectId]);

  const activeGlossary = useMemo(() => (
    activeProjectId ? glossaries[activeProjectId] || [] : []
  ), [glossaries, activeProjectId]);

  const activeCharacterDB = useMemo(() => (
    activeProjectId ? characterDBs[activeProjectId] || [] : []
  ), [characterDBs, activeProjectId]);

  // Memoize the sorted list of chapters for the active project
  const projectChapters = useMemo(() => {
    if (!activeProjectId) return [];
    return chapters
      .filter(c => c.projectId === activeProjectId)
      .sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));
  }, [chapters, activeProjectId]);

  // Find the current chapter's index and define next/previous chapters
  const currentChapterIndex = useMemo(() =>
    projectChapters.findIndex(c => c.id === activeChapterId)
    , [projectChapters, activeChapterId]);

  const previousChapter = useMemo(() =>
    currentChapterIndex > 0 ? projectChapters[currentChapterIndex - 1] : null
    , [projectChapters, currentChapterIndex]);

  const nextChapter = useMemo(() =>
    currentChapterIndex < projectChapters.length - 1 ? projectChapters[currentChapterIndex + 1] : null
    , [projectChapters, currentChapterIndex]);

  const handleGoToPreviousChapter = useCallback(() => {
    if (previousChapter) {
      setActiveChapterId(previousChapter.id);
    }
  }, [previousChapter]);

  const handleGoToNextChapter = useCallback(() => {
    if (nextChapter) {
      setActiveChapterId(nextChapter.id);
    }
  }, [nextChapter]);


  // Effect for fullscreen keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        handleGoToPreviousChapter();
      } else if (event.key === 'ArrowRight') {
        handleGoToNextChapter();
      }
    };

    if (isTranslatedFullscreen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isTranslatedFullscreen, handleGoToPreviousChapter, handleGoToNextChapter]);

  // Effect to detect which glossary/character entries are in the text (DEBOUNCED + OPTIMIZED)
  // Use deferred value to avoid blocking during typing
  const deferredInputText = useDeferredValue(inputText);

  // Pre-compile RegExp patterns for glossary and characters (avoids recreation on every check)
  const glossaryPatterns = useMemo(() => {
    const noBoundaryLanguages = ['Japanese', 'Chinese (Simplified)', 'Korean'];
    const useBoundaries = settings.sourceLanguage !== 'Auto-detect' && !noBoundaryLanguages.includes(settings.sourceLanguage);
    const boundary = useBoundaries ? '\\b' : '';

    return activeGlossary.map(term => ({
      term,
      regex: term.original ? new RegExp(`${boundary}${term.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${boundary}`, 'i') : null
    })).filter(p => p.regex !== null);
  }, [activeGlossary, settings.sourceLanguage]);

  const characterPatterns = useMemo(() => {
    const noBoundaryLanguages = ['Japanese', 'Chinese (Simplified)', 'Korean'];
    const useBoundaries = settings.sourceLanguage !== 'Auto-detect' && !noBoundaryLanguages.includes(settings.sourceLanguage);
    const boundary = useBoundaries ? '\\b' : '';

    return activeCharacterDB.map(character => ({
      character,
      regex: character.name ? new RegExp(`${boundary}${character.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${boundary}`, 'i') : null
    })).filter(p => p.regex !== null);
  }, [activeCharacterDB, settings.sourceLanguage]);

  useEffect(() => {
    if (!deferredInputText.trim()) {
      setActiveGlossaryTerms([]);
      setActiveCharacters([]);
      return;
    }

    // Debounce the pattern matching (patterns are pre-compiled above)
    const timeoutId = setTimeout(() => {
      const mentionedGlossary = glossaryPatterns
        .filter(p => p.regex!.test(deferredInputText))
        .map(p => p.term);
      setActiveGlossaryTerms(mentionedGlossary);

      const mentionedChars = characterPatterns
        .filter(p => p.regex!.test(deferredInputText))
        .map(p => p.character);
      setActiveCharacters(mentionedChars);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [deferredInputText, glossaryPatterns, characterPatterns]);


  // Apply theme class to the HTML element
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-blue', 'dark'); // Clear previous themes
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else if (settings.theme === 'blue') {
      root.classList.add('dark', 'theme-blue');
    }
  }, [settings.theme]);

  const handleTextScroll = useCallback(() => {
    if (translatedTextContainerRef.current) {
      const container = translatedTextContainerRef.current;
      const { scrollTop, scrollHeight, clientHeight } = container;
      const scrollableHeight = scrollHeight - clientHeight;

      setIsScrollable(scrollableHeight > 0);

      if (scrollableHeight > 0) {
        const newPosition = scrollTop / scrollableHeight;
        setScrollPosition(newPosition);
      } else {
        setScrollPosition(0);
      }
    }
  }, []);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (translatedTextContainerRef.current) {
      const container = translatedTextContainerRef.current;
      const newPosition = parseFloat(e.target.value); // value from 0 to 1
      container.scrollTop = newPosition * (container.scrollHeight - container.clientHeight);
    }
  }, []);

  // Update slider when text/font changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      handleTextScroll();
    }, 100); // Small delay for DOM update
    return () => clearTimeout(timeoutId);
  }, [translatedText, settings.fontSize, handleTextScroll]);

  // Reset connection status if the model or API key changes
  useEffect(() => {
    setConnectionStatus('idle');
  }, [settings.provider, settings.model, settings.apiKey, settings.deepseekApiKey, settings.openRouterApiKey]);

  // Load chapter data when activeChapterId changes
  useEffect(() => {
    if (activeChapterId) {
      const chapter = chapters.find(c => c.id === activeChapterId);
      if (chapter) {
        setChapterTitle(chapter.title);
        setInputText(chapter.originalText);
        setTranslatedText(chapter.translatedText);
        setError(null);
        setSelectedWords([]);
        setIsEditMode(false); // Exit edit mode when switching chapters

        // Persist last chapter read to project
        if (activeProjectId) {
          updateProject(activeProjectId, {
            lastChapterId: chapter.id,
            lastChapterTitle: chapter.title || 'Untitled Chapter',
          });
        }
      }
    } else {
      // It's a new or cleared chapter
      setChapterTitle('');
      setInputText('');
      setTranslatedText('');
      setError(null);
      setSelectedWords([]);
      setIsEditMode(false);
    }
  }, [activeChapterId, chapters, activeProjectId, updateProject]);

  const handleConnect = useCallback(async () => {
    setConnectionStatus('connecting');
    setConnectionError(null);
    const result = await testConnection(settings);
    if (result.success) {
      setConnectionStatus('connected');
    } else {
      setConnectionStatus('error');
      setConnectionError(result.message);
    }
  }, [settings]);

  const handleTranslate = useCallback(async (isRegeneration = false, skipCache = false) => {
    if (!inputText.trim() || connectionStatus !== 'connected' || !activeProjectId) return;

    // Check translation memory for cached translation (unless regenerating, explicitly skipping, or disabled)
    if (!isRegeneration && !skipCache && settings.isTranslationMemoryEnabled) {
      const cached = findTranslation(inputText, settings.sourceLanguage, settings.targetLanguage);
      if (cached) {
        setCachedTranslation(cached);
        setShowCacheIndicator(true);
        return; // Let user decide whether to use cached or translate new
      }
    }

    // Hide cache indicator when translating
    setShowCacheIndicator(false);
    setCachedTranslation(null);

    if (!isRegeneration) {
      isTranslationCancelled.current = false;
      // Create new AbortController for this translation
      translationAbortController.current = new AbortController();
      setIsLoading(true);
      setError(null);
      setTranslatedText('');
      setSelectedWords([]);
      setIsEditMode(false);
      setTranslationTime(null);
    } else {
      // Create new AbortController for regeneration too
      translationAbortController.current = new AbortController();
      setIsLoading(true);
      setError(null);
      setTranslatedText('');
      setTranslationTime(null);
    }

    const startTime = Date.now();

    // IMPORTANT: Capture context at the START of translation to avoid saving to wrong chapter
    // if user switches chapters while translation is in progress
    const capturedChapterId = activeChapterId;
    const capturedProjectId = activeProjectId;
    const capturedChapterTitle = chapterTitle;
    const capturedInputText = inputText;

    const commonArgs = [
      inputText,
      activeGlossaryTerms,
      activeCharacters,
      settings
    ] as const;

    let finalTranslation = '';
    let hadError = false;

    try {
      if (settings.isStreamingEnabled) {
        const signal = translationAbortController.current?.signal;
        const stream = translateTextStream(...commonArgs, signal);
        for await (const chunk of stream) {
          if (isTranslationCancelled.current) break;
          if (chunk.startsWith("Error:")) {
            setError(chunk);
            hadError = true;
            break;
          }
          finalTranslation += chunk;
          setTranslatedText(prev => prev + chunk);
        }
        // After streaming is done, analyze for characters in the background
        if (!isTranslationCancelled.current && !hadError && settings.isAutoCharacterDetectionEnabled) {
          setIsAnalyzingCharacters(true);
          const charResult = await analyzeForCharacters(inputText, settings);
          if ('characters' in charResult) {
            addCharacters(activeProjectId, charResult.characters);
          } else {
            setError(charResult.error);
          }
          setIsAnalyzingCharacters(false);
        }
      } else {
        const signal = translationAbortController.current?.signal;
        const result = await translateText(...commonArgs, signal);
        if (isTranslationCancelled.current) return;

        if ('translation' in result) {
          finalTranslation = result.translation;
          setTranslatedText(result.translation);
          if (result.newCharacters.length > 0 && settings.isAutoCharacterDetectionEnabled) {
            addCharacters(activeProjectId, result.newCharacters);
          }
        } else {
          setError(result.error);
          hadError = true;
        }
      }

      // Record translation time
      const endTime = Date.now();
      if (!isTranslationCancelled.current && !hadError) {
        setTranslationTime(endTime - startTime);
      }

      // Auto-save after successful translation and add to translation memory
      if (!isTranslationCancelled.current && !hadError && finalTranslation) {
        // Add to translation memory (if enabled)
        if (settings.isTranslationMemoryEnabled) {
          addTranslation(capturedInputText, finalTranslation, settings.sourceLanguage, settings.targetLanguage);
        }

        const chapterData = {
          title: capturedChapterTitle.trim() || 'Untitled Chapter',
          originalText: capturedInputText,
          translatedText: finalTranslation,
        };

        try {
          setSaveStatus('saving');
          // Use captured IDs to save to the correct chapter (the one that was active when translation started)
          if (capturedChapterId) {
            await updateChapter(capturedChapterId, chapterData);
          } else {
            const newChapter = await addChapter({ ...chapterData, projectId: capturedProjectId });
            // Only update activeChapterId if user is still on the same context
            if (activeChapterId === null && activeProjectId === capturedProjectId) {
              setActiveChapterId(newChapter.id);
            }
          }
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 1500);
        } catch (saveError) {
          console.error('Auto-save failed:', saveError);
          setSaveStatus('idle');
        }
      }
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') {
        setError(`An unexpected error occurred: ${e.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  }, [inputText, activeGlossaryTerms, activeCharacters, settings, connectionStatus, activeProjectId, addCharacters, chapterTitle, activeChapterId, updateChapter, addChapter, findTranslation, addTranslation]);

  // Handle using cached translation
  const handleUseCachedTranslation = useCallback(() => {
    if (cachedTranslation) {
      setTranslatedText(cachedTranslation.translatedText);
      setShowCacheIndicator(false);
      setCachedTranslation(null);
      setTranslationTime(0); // Instant from cache

      // Update usage count in translation memory
      addTranslation(inputText, cachedTranslation.translatedText, settings.sourceLanguage, settings.targetLanguage);
    }
  }, [cachedTranslation, inputText, settings, addTranslation]);

  // Handle dismissing cached translation and translating new
  const handleDismissCachedTranslation = useCallback(() => {
    setShowCacheIndicator(false);
    setCachedTranslation(null);
    handleTranslate(false, true); // Translate new, skip cache check
  }, [handleTranslate]);

  const handleStopTranslation = useCallback(() => {
    isTranslationCancelled.current = true;
    // Abort the fetch request
    if (translationAbortController.current) {
      translationAbortController.current.abort();
      translationAbortController.current = null;
    }
  }, []);

  const handleSaveChapter = useCallback(async () => {
    if (!activeProjectId) {
      setError("Please select a project before saving.");
      return;
    }

    setSaveStatus('saving');

    const chapterData = {
      title: chapterTitle.trim() || 'Untitled Chapter',
      originalText: inputText,
      translatedText: translatedText,
    };

    try {
      if (activeChapterId) {
        await updateChapter(activeChapterId, chapterData);
      } else {
        const newChapter = await addChapter({ ...chapterData, projectId: activeProjectId });
        setActiveChapterId(newChapter.id);
      }
      setSaveStatus('saved');
      setIsEditMode(false);
    } catch (e) {
      setError("Failed to save chapter.");
      setSaveStatus('idle');
    } finally {
      setTimeout(() => setSaveStatus('idle'), 1500);
    }
  }, [activeChapterId, activeProjectId, chapterTitle, inputText, translatedText, addChapter, updateChapter]);

  const handleNewChapter = useCallback(() => {
    setActiveChapterId(null);
    setChapterTitle('');
    setInputText('');
    setTranslatedText('');
    setTranslationTime(null);
    setError(null);
  }, []);

  // Batch Translation Handlers (for communication with BatchTranslateModal)
  const handleBatchTranslationStart = useCallback((chapterIds: string[]) => {
    setIsBatchTranslating(true);
    setBatchProgress({ current: 0, total: chapterIds.length });
    const initialStatus: Record<string, BatchChapterStatus> = {};
    chapterIds.forEach(id => { initialStatus[id] = 'pending'; });
    setBatchChapterStatus(initialStatus);
    setBatchStreamingChapterId(null);
    setBatchStreamingText('');
  }, []);

  const handleBatchTranslationProgress = useCallback((progress: {
    chapterId: string;
    status: BatchChapterStatus;
    streamingText?: string;
    completedCount?: number;
  }) => {
    // Update chapter status
    setBatchChapterStatus(prev => ({
      ...prev,
      [progress.chapterId]: progress.status
    }));

    // Update streaming state for live text display
    if (progress.status === 'translating') {
      if (batchStreamingChapterId !== progress.chapterId) {
        // New chapter started streaming - reset streaming text
        setBatchStreamingChapterId(progress.chapterId);
        setBatchStreamingText(progress.streamingText || '');
      } else if (progress.streamingText !== undefined) {
        // Same chapter, append streaming text
        setBatchStreamingText(progress.streamingText);
      }
    }

    // Update progress count
    if (progress.completedCount !== undefined) {
      setBatchProgress(prev => ({ ...prev, current: progress.completedCount! }));
    }
  }, [batchStreamingChapterId]);

  const handleBatchTranslationComplete = useCallback(() => {
    setIsBatchTranslating(false);
    setBatchStreamingChapterId(null);
    setBatchStreamingText('');
    // Keep batchChapterStatus for a moment so modal can show final state, then clear
    setTimeout(() => {
      setBatchChapterStatus({});
      setBatchProgress({ current: 0, total: 0 });
    }, 2000);
  }, []);



  // Handler for restoring a project backup
  const handleRestoreProject = useCallback(async (backup: ProjectBackup) => {
    // Create a new project with a modified name to avoid conflicts
    const newProject = await addProject(`${backup.project.name} (Restored)`, backup.project.profilePic || null);

    // Import chapters (using batch for faster restore)
    if (backup.chapters.length > 0) {
      const chaptersToImport = backup.chapters.map(chapter => ({
        title: chapter.title,
        originalText: chapter.originalText,
        translatedText: chapter.translatedText,
        projectId: newProject.id,
      }));
      await addChaptersBatch(chaptersToImport);
    }

    // Import glossary terms
    for (const term of backup.glossary) {
      addTerm(newProject.id, term);
    }

    // Import characters
    if (backup.characters.length > 0) {
      addCharacters(newProject.id, backup.characters.map(c => ({
        name: c.name,
        translatedName: c.translatedName,
        gender: c.gender,
        pronouns: c.pronouns,
      })));
    }

    // Select the restored project
    setActiveProjectId(newProject.id);
  }, [addProject, addChaptersBatch, addTerm, addCharacters]);

  // Global keyboard shortcuts (extracted to hook)
  useKeyboardShortcuts({
    isLoading,
    inputText,
    connectionStatus,
    isEditMode,
    activeProjectId,
    chapterTitle,
    translatedText,
    saveStatus,
    isTranslatedFullscreen,
    isSettingsOpen,
    isExportModalOpen,
    onTranslate: () => handleTranslate(false),
    onSaveChapter: handleSaveChapter,
    onNewChapter: handleNewChapter,
    setIsTranslatedFullscreen,
    setIsSettingsOpen,
    setIsExportModalOpen,
  });


  const handleClearTexts = () => {
    setInputText('');
    setTranslatedText('');
    setSelectedWords([]);
    setError(null);
    setIsEditMode(false);
  }

  const handleSelectProject = (id: string | null) => {
    setActiveProjectId(id);
    setActiveChapterId(null);
    // Chapters will be fetched by the useEffect that watches activeProjectId
  };

  const handleDeleteChapter = useCallback(async (chapterId: string) => {
    try {
      await deleteChapter(chapterId);
      if (activeChapterId === chapterId) {
        setActiveChapterId(null);
      }
    } catch (e) {
      setError("Failed to delete chapter.");
    }
  }, [deleteChapter, activeChapterId]);

  const handleAddTerm = useCallback((term: GlossaryEntry) => {
    if (activeProjectId) {
      addTerm(activeProjectId, term);
    }
  }, [activeProjectId, addTerm]);

  const handleRemoveTerm = useCallback((original: string) => {
    if (activeProjectId) {
      removeTerm(activeProjectId, original);
    }
  }, [activeProjectId, removeTerm]);

  const handleUpdateTerm = useCallback((oldOriginal: string, newEntry: GlossaryEntry) => {
    if (activeProjectId) {
      updateTerm(activeProjectId, oldOriginal, newEntry);
    }
  }, [activeProjectId, updateTerm]);

  const handleAddCharacters = useCallback((characters: Omit<Character, 'id'>[]) => {
    console.log('[App] handleAddCharacters called with', characters.length, 'characters, activeProjectId:', activeProjectId);
    if (activeProjectId) {
      console.log('[App] Adding characters to project:', activeProjectId);
      addCharacters(activeProjectId, characters);
    } else {
      console.warn('[App] Cannot add characters - no active project!');
    }
  }, [activeProjectId, addCharacters]);

  const handleRemoveCharacter = useCallback((id: string) => {
    if (activeProjectId) {
      removeCharacter(activeProjectId, id);
    }
  }, [activeProjectId, removeCharacter]);

  const handleUpdateCharacter = useCallback((id: string, newEntry: Character) => {
    if (activeProjectId) {
      updateCharacter(activeProjectId, id, newEntry);
    }
  }, [activeProjectId, updateCharacter]);

  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection()?.toString().trim();
    if (selection && !selectedWords.includes(selection)) {
      setSelectedWords(prev => [...prev, selection]);
    }
  }, [selectedWords]);

  const handleRemoveSelection = useCallback((selectionToRemove: string) => {
    setSelectedWords(prev => prev.filter(s => s !== selectionToRemove));
  }, []);

  const handleEditSelection = useCallback((oldSelection: string, newSelection: string) => {
    setSelectedWords(prev => prev.map(s => s === oldSelection ? newSelection : s));
  }, []);

  const handleAddFromSelection = useCallback(async () => {
    if (selectedWords.length === 0 || !activeProjectId || !inputText || !translatedText) return;

    setIsFindingOriginal(true);
    setError(null);

    let remainingSelections = [...selectedWords];
    let foundEntries: GlossaryEntry[] = [];
    let attempts = 0;
    const maxAttempts = 3;

    while (remainingSelections.length > 0 && attempts < maxAttempts) {
      attempts++;
      const result = await findOriginalPhrases(
        inputText,
        translatedText,
        remainingSelections,
        settings
      );

      if ('entries' in result && result.entries.length > 0) {
        foundEntries.push(...result.entries);
        const foundOriginals = new Set(result.entries.map(e => e.original.toLowerCase()));
        const foundTranslations = new Set(result.entries.map(e => e.translation.toLowerCase()));

        remainingSelections = remainingSelections.filter(selection => {
          const lowerSelection = selection.toLowerCase();
          return !foundOriginals.has(lowerSelection) && !foundTranslations.has(lowerSelection);
        });
      } else {
        // If there's an error, stop trying
        const errorMessage = ('error' in result && result.error) || 'Could not find original phrases.';
        setError(errorMessage);
        break;
      }
    }

    setIsFindingOriginal(false);

    if (foundEntries.length > 0) {
      foundEntries.forEach(entry => {
        addTerm(activeProjectId, { original: entry.original, translation: entry.translation });
      });
    }

    if (remainingSelections.length === 0) {
      setSelectedWords([]); // Clear selection on full success
    } else {
      // Update the selection list to only show the ones that failed
      setSelectedWords(remainingSelections);
      if (!error) { // Avoid overwriting a more specific error from the loop
        setError(`Could not find matches for: ${remainingSelections.join(', ')}`);
      }
    }
  }, [selectedWords, activeProjectId, inputText, translatedText, settings, addTerm, error]);

  const handleCopy = useCallback(() => {
    if (!translatedText) return;
    navigator.clipboard.writeText(translatedText).then(() => {
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      setError('Failed to copy text.');
    });
  }, [translatedText]);

  const apiKeyMissing =
    (settings.provider === 'gemini' && !settings.apiKey) ||
    (settings.provider === 'deepseek' && !settings.deepseekApiKey) ||
    (settings.provider === 'openrouter' && !settings.openRouterApiKey);

  const isSaveDisabled = !activeProjectId || !chapterTitle.trim() || !translatedText.trim();
  const isConnectDisabled = apiKeyMissing || connectionStatus === 'connecting' || connectionStatus === 'connected';
  const isTranslateDisabled = isLoading || !inputText.trim() || connectionStatus !== 'connected' || isEditMode;

  const translatedTextStyle = {
    fontSize: `${settings.fontSize}rem`,
    color: settings.fontColor || 'inherit',
  };

  const translatedFullscreenStyle = {
    fontSize: `${settings.fontSize * 1.1}rem`,
    color: settings.fontColor || 'inherit',
  };

  return (
    <div className="h-screen text-[var(--text-primary)] flex font-sans bg-[var(--bg-primary)] overflow-hidden">
      {activeProjectId && (
        <ProjectSidebar
          isOpen={isSidebarOpen}
          projects={projects}
          chapters={chapters}
          activeProjectId={activeProjectId}
          activeChapterId={activeChapterId}
          onSelectProject={handleSelectProject}
          onSelectChapter={setActiveChapterId}
          onAddProject={addProject}
          onUpdateProjectProfilePic={updateProjectProfilePic}
          onDeleteProject={deleteProject}
          onDeleteChapter={handleDeleteChapter}
          onDeleteChapters={deleteChaptersByProjectId}
          onDeleteGlossary={deleteGlossary}
          onDeleteCharacterDB={deleteCharacterDB}
          onNewChapter={handleNewChapter}

          onOpenStatistics={() => setIsStatisticsOpen(true)}
          onOpenBackupRestore={() => setIsBackupRestoreOpen(true)}
          glossary={activeGlossary}
          addTerm={handleAddTerm}
          removeTerm={handleRemoveTerm}
          updateTerm={handleUpdateTerm}
          characterDB={activeCharacterDB}
          addCharacters={handleAddCharacters}
          removeCharacter={handleRemoveCharacter}
          updateCharacter={handleUpdateCharacter}
          isAnalyzingCharacters={isAnalyzingCharacters}
          onOpenExportModal={() => setIsExportModalOpen(true)}
          onOpenImportModal={() => setIsImportModalOpen(true)}
          onOpenBatchTranslate={() => setIsBatchTranslateOpen(true)}
          onOpenBatchTitleTranslate={() => setIsBatchTitleTranslateOpen(true)}
          activeGlossaryTerms={activeGlossaryTerms}
          activeCharacters={activeCharacters}
        />
      )}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between gap-4 p-4 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]/80 backdrop-blur-sm">
          <div className="flex items-center gap-2 md:gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors" aria-label="Toggle sidebar">
              <MenuIcon />
            </button>
            <div className="flex items-center gap-3">
              <LogoIcon />
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                  Lingua Scripter
                  <span className="text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] px-2 py-0.5 rounded-full">by Subscribe</span>
                  <a
                    href="https://ko-fi.com/subscribe123"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-[var(--text-on-accent)] px-2 py-0.5 rounded-full flex items-center gap-1 transition-colors"
                    title="Support the developer on Ko-fi"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                    </svg>
                    Donate
                  </a>
                </h1>
                <p className="text-xs text-[var(--text-secondary)]">AI-Powered Novel Translation</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <ConnectionStatus status={connectionStatus} error={connectionError} />
            <button
              onClick={handleConnect}
              disabled={isConnectDisabled}
              className="text-sm bg-[var(--bg-tertiary)] hover:brightness-125 font-semibold px-3 py-1.5 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title={apiKeyMissing ? `Please set your ${settings.provider} API key in Settings` : ''}
            >
              {connectionStatus === 'connecting' ? 'Connecting...' :
                connectionStatus === 'connected' ? 'Connected' :
                  connectionStatus === 'error' ? 'Retry' : 'Connect'}
            </button>
            <button onClick={() => setIsSettingsOpen(true)} className="p-2 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors" aria-label="Open settings">
              <SettingsIcon />
            </button>
          </div>
        </header>

        {/* Batch Translation Indicator - shows when translation is running in background */}
        {isBatchTranslating && (
          <BatchTranslationIndicator
            current={batchProgress.current}
            total={batchProgress.total}
            onClick={() => setIsBatchTranslateOpen(true)}
          />
        )}

        <main className="flex-1 flex flex-col p-4 gap-4 min-h-0">
          {activeProjectId ? (
            <>
              <div className="flex items-center gap-2 md:gap-4">
                <input
                  type="text"
                  value={chapterTitle}
                  onChange={(e) => setChapterTitle(e.target.value)}
                  placeholder="Chapter Title"
                  className="flex-1 bg-transparent text-xl font-bold text-[var(--text-primary)] focus:outline-none"
                  disabled={!activeProjectId}
                />
                <button
                  onClick={handleClearTexts}
                  disabled={!inputText && !translatedText}
                  className="flex items-center justify-center gap-2 font-semibold px-4 py-2 rounded-md transition-colors bg-[var(--bg-tertiary)] hover:brightness-125 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ClearIcon /> <span className="hidden md:inline">Clear</span>
                </button>
                <button
                  onClick={handleSaveChapter}
                  disabled={isSaveDisabled || saveStatus !== 'idle'}
                  className={`flex items-center justify-center gap-2 min-w-[160px] font-semibold px-4 py-2 rounded-md transition-colors disabled:cursor-not-allowed
                                ${saveStatus === 'saved'
                      ? 'bg-[var(--success-primary)] text-white disabled:bg-[var(--success-primary)] disabled:opacity-100'
                      : 'bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-[var(--text-on-accent)] disabled:bg-gray-600'
                    }
                            `}
                >
                  {saveStatus === 'idle' && <><SaveIcon /> <span className="hidden md:inline">Save Chapter</span></>}
                  {saveStatus === 'saving' && <><LoadingSpinner /> <span className="hidden md:inline">Saving...</span></>}
                  {saveStatus === 'saved' && <><CheckIcon /> <span className="hidden md:inline">Saved!</span></>}
                </button>
              </div>

              <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
                <div className="flex flex-col gap-4 bg-[var(--bg-secondary)] rounded-md p-4 border border-[var(--border-primary)]">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-bold text-[var(--accent-primary)]">
                      Original Text ({settings.sourceLanguage})
                    </h2>
                    <ActiveContextInfo activeGlossary={activeGlossaryTerms} activeCharacters={activeCharacters} />
                  </div>
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={activeProjectId ? "Paste your chapter text here..." : "Select a project to start."}
                    className="w-full flex-1 bg-transparent text-[var(--text-primary)] p-1 focus:outline-none resize-none"
                    disabled={!activeProjectId}
                  ></textarea>
                  <button
                    onClick={isLoading ? handleStopTranslation : () => handleTranslate(false)}
                    disabled={!isLoading && isTranslateDisabled}
                    className={`w-full font-bold py-3 px-4 rounded-md transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed
                                ${isLoading
                        ? 'bg-[var(--danger-primary)] hover:brightness-125 text-white'
                        : 'bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-[var(--text-on-accent)] disabled:bg-gray-700'
                      }`}
                    title={isEditMode ? "Exit edit mode to translate" : !isLoading && connectionStatus !== 'connected' ? 'Please connect to the model first' : ''}
                  >
                    {isLoading ? <><StopIcon /> Stop Translating</> : 'Translate'}
                  </button>
                </div>

                <div className="bg-[var(--bg-secondary)] rounded-md p-4 flex flex-col border border-[var(--border-primary)] min-h-0">
                  <div className="flex justify-between items-center mb-2">
                    <h2 className="text-lg font-bold text-[var(--accent-primary)]">
                      Translated Text ({settings.targetLanguage})
                    </h2>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleTranslate(true)}
                        disabled={!translatedText.trim() || isLoading || isEditMode}
                        title="Regenerate Translation"
                        className="p-1.5 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ReloadIcon />
                      </button>
                      <button
                        onClick={() => setIsEditMode(!isEditMode)}
                        disabled={!translatedText.trim()}
                        title={isEditMode ? "Finish Editing" : "Edit Manually"}
                        className="p-1.5 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isEditMode ? <CheckIcon /> : <PencilIcon />}
                      </button>
                      <button
                        onClick={handleCopy}
                        disabled={!translatedText.trim()}
                        title={copyStatus === 'copied' ? 'Copied!' : 'Copy to clipboard'}
                        className="p-1.5 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {copyStatus === 'copied' ? <CheckIcon /> : <CopyIcon />}
                      </button>
                      <button onClick={() => setIsTranslatedFullscreen(true)} title="Fullscreen" className="p-1.5 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors">
                        <ExpandIcon />
                      </button>
                    </div>
                  </div>
                  {showCacheIndicator && cachedTranslation && (
                    <TranslationMemoryIndicator
                      cachedTranslation={cachedTranslation}
                      onUseCached={handleUseCachedTranslation}
                      onDismiss={handleDismissCachedTranslation}
                    />
                  )}
                  {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-md mb-2 text-sm">{error}</div>}
                  {!isEditMode && selectedWords.length > 0 && <GlossaryQuickAdd selections={selectedWords} isLoading={isFindingOriginal} onAddFromSelection={handleAddFromSelection} onClear={() => setSelectedWords([])} onRemove={handleRemoveSelection} onEdit={handleEditSelection} />}
                  <div className="flex-1 flex flex-row gap-4 min-h-0">
                    <div ref={translatedTextContainerRef} onScroll={handleTextScroll} onMouseUp={isEditMode ? undefined : handleTextSelection} className={`flex-1 overflow-y-auto pr-2 ${settings.fontFamily}`} style={translatedTextStyle} aria-live="polite">
                      {/* Show batch streaming text if viewing currently streaming chapter */}
                      {batchStreamingChapterId === activeChapterId && batchStreamingText ? (
                        <div className="relative">
                          <div className="absolute top-0 right-0 flex items-center gap-1.5 text-xs text-[var(--accent-primary)] bg-[var(--bg-tertiary)] px-2 py-1 rounded-bl-md">
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current"></div>
                            Batch translating...
                          </div>
                          <CharacterAwareRenderer
                            text={batchStreamingText}
                            characters={activeCharacterDB}
                            language={settings.targetLanguage}
                          />
                        </div>
                      ) : isLoading && !translatedText ? <LoadingSkeleton />
                        : isEditMode ? (
                          <textarea
                            value={translatedText}
                            onChange={(e) => setTranslatedText(e.target.value)}
                            className="w-full h-full bg-transparent resize-none focus:outline-none leading-relaxed"
                            style={{ color: 'inherit', fontSize: 'inherit' }}
                            aria-label="Editable translated text"
                          />
                        )
                          : translatedText ? (
                            <CharacterAwareRenderer
                              text={translatedText}
                              characters={activeCharacterDB}
                              language={settings.targetLanguage}
                            />
                          ) : <OutputPlaceholder />}
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={scrollPosition}
                      onChange={handleSliderChange}
                      className="h-full w-2.5 appearance-none cursor-pointer bg-transparent focus:outline-none disabled:opacity-50
                                        [&::-webkit-slider-runnable-track]:w-2.5 [&::-webkit-slider-runnable-track]:h-full [&::-webkit-slider-runnable-track]:bg-[var(--bg-tertiary)] [&::-webkit-slider-runnable-track]:rounded-full
                                        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:bg-[var(--accent-primary)] [&::-webkit-slider-thumb]:rounded-full
                                        [&::-moz-range-track]:w-2.5 [&::-moz-range-track]:h-full [&::-moz-range-track]:bg-[var(--bg-tertiary)] [&::-moz-range-track]:rounded-full
                                        [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:bg-[var(--accent-primary)] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-none
                                    "
                      style={{ writingMode: 'vertical-lr' }}
                      disabled={isLoading || !isScrollable}
                      aria-label="Scroll translated text"
                    />
                  </div>
                </div>
              </div>

              {/* Text Statistics */}
              <TextStats
                originalText={inputText}
                translatedText={translatedText}
                translationTime={translationTime}
                selectedTokenizer={selectedTokenizer}
                onTokenizerChange={setSelectedTokenizer}
              />
            </>
          ) : (
            <ProjectSelector
              projects={projects}
              onSelectProject={(id) => handleSelectProject(id)}
              onAddProject={addProject}
              onUpdateProject={updateProject}
              onOpenStatistics={() => setIsStatisticsOpen(true)}
              onOpenBackupRestore={() => setIsBackupRestoreOpen(true)}
            />
          )}
        </main>
      </div>
      {/* Lazy-loaded modals wrapped in Suspense */}
      <Suspense fallback={<ModalLoader />}>
        {isSettingsOpen && (
          <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} currentSettings={settings} onSave={saveSettings} />
        )}
      </Suspense>

      <Suspense fallback={<ModalLoader />}>
        {isExportModalOpen && (
          <ExportModal
            isOpen={isExportModalOpen}
            onClose={() => setIsExportModalOpen(false)}
            project={activeProject}
            chapters={chapters}
            settings={settings}
          />
        )}
      </Suspense>



      <Suspense fallback={<ModalLoader />}>
        {isStatisticsOpen && (
          <StatisticsDashboard
            isOpen={isStatisticsOpen}
            onClose={() => setIsStatisticsOpen(false)}
            projects={projects}
            chapters={chapters}
            selectedProjectId={activeProjectId}
          />
        )}
      </Suspense>

      <Suspense fallback={<ModalLoader />}>
        {isBackupRestoreOpen && (
          <BackupRestoreModal
            isOpen={isBackupRestoreOpen}
            onClose={() => setIsBackupRestoreOpen(false)}
            projects={projects}
            chapters={chapters}
            glossaries={glossaries}
            characterDBs={characterDBs}
            selectedProjectId={activeProjectId}
            onRestoreProject={handleRestoreProject}
          />
        )}
      </Suspense>

      <Suspense fallback={<ModalLoader />}>
        {isImportModalOpen && activeProjectId && (
          <ImportModal
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
            projectId={activeProjectId}
            existingChapterNumbers={projectChapters.map(ch => ch.chapterNumber)}
            onImportChapters={addChaptersBatch}
          />
        )}
      </Suspense>

      <Suspense fallback={<ModalLoader />}>
        {isBatchTranslateOpen && activeProjectId && (
          <BatchTranslateModal
            isOpen={isBatchTranslateOpen}
            onClose={() => setIsBatchTranslateOpen(false)}
            chapters={projectChapters}
            glossary={activeGlossary}
            characterDB={activeCharacterDB}
            settings={settings}
            onUpdateChapter={updateChapter}
            onAddCharacters={handleAddCharacters}
            // Batch state props for parent sync
            isBatchTranslating={isBatchTranslating}
            batchChapterStatus={batchChapterStatus}
            onBatchStart={handleBatchTranslationStart}
            onBatchProgress={handleBatchTranslationProgress}
            onBatchComplete={handleBatchTranslationComplete}
            isConnected={connectionStatus === 'connected'}
          />
        )}
      </Suspense>

      <Suspense fallback={<ModalLoader />}>
        {isBatchTitleTranslateOpen && activeProjectId && (
          <BatchTranslateTitlesModal
            isOpen={isBatchTitleTranslateOpen}
            onClose={() => setIsBatchTitleTranslateOpen(false)}
            chapters={projectChapters}
            settings={settings}
            onUpdateChapter={updateChapter}
            isConnected={connectionStatus === 'connected'}
          />
        )}
      </Suspense>

      {isTranslatedFullscreen && (
        <div className="fixed inset-0 z-50 bg-[var(--bg-primary)] flex flex-col p-4 md:p-8 animate-fade-in">
          <header className="flex justify-between items-center mb-4 flex-shrink-0">
            <h2 className="text-xl font-bold text-[var(--text-primary)] truncate" title={chapterTitle || 'Translated Text'}>
              {chapterTitle || 'Translated Text'}
            </h2>
            <div className="flex items-center gap-4">
              <button
                onClick={handleGoToPreviousChapter}
                disabled={!previousChapter}
                title="Previous Chapter (Left Arrow)"
                className="p-2 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous Page
              </button>
              <div className='relative'>
                <button
                  onClick={() => setIsChapterListOpen(o => !o)}
                  className="p-2 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  Chapters
                </button>
                {isChapterListOpen && (
                  <div ref={chapterListRef} className="absolute top-full mt-2 right-0 w-60 bg-[var(--bg-secondary)] rounded-lg p-2 shadow-lg border border-[var(--border-primary)] max-h-96 overflow-y-auto z-30">
                    <h3 className="text-lg font-bold text-center mb-2">Chapters</h3>
                    <ul className="space-y-1">
                      {projectChapters.map((chapter) => (
                        <li key={chapter.id}
                          className={`cursor-pointer p-2 rounded-md text-sm truncate ${activeChapterId === chapter.id ? 'bg-[var(--accent-primary)] text-white' : 'hover:bg-[var(--bg-tertiary)]'}`}
                          onClick={() => {
                            setActiveChapterId(chapter.id);
                            setIsChapterListOpen(false);
                          }}
                          title={chapter.title}
                        >
                          {chapter.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <button
                onClick={handleGoToNextChapter}
                disabled={!nextChapter}
                title="Next Chapter (Right Arrow)"
                className="p-2 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next Page
              </button>
              <button onClick={() => setIsTranslatedFullscreen(false)} title="Exit Fullscreen" className="p-2 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors">
                <CollapseIcon />
              </button>
            </div>
          </header>
          <div className="flex-1 overflow-y-auto flex justify-center">
            <div className={`max-w-4xl w-full ${settings.fontFamily}`} style={translatedFullscreenStyle} aria-live="polite">
              {/* Show batch streaming text if viewing currently streaming chapter */}
              {batchStreamingChapterId === activeChapterId && batchStreamingText ? (
                <div className="relative">
                  <div className="fixed top-20 right-8 flex items-center gap-1.5 text-xs text-[var(--accent-primary)] bg-[var(--bg-tertiary)] px-3 py-1.5 rounded-md shadow-lg">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current"></div>
                    Batch translating...
                  </div>
                  <div className="whitespace-pre-wrap leading-relaxed">{batchStreamingText}</div>
                </div>
              ) : isLoading && !translatedText ? <LoadingSkeleton />
                : translatedText ? (
                  <div className="whitespace-pre-wrap leading-relaxed">{translatedText}</div>
                ) : <div className="pt-20"><OutputPlaceholder /></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
