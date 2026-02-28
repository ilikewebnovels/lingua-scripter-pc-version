import { useEffect } from 'react';

interface KeyboardShortcutsOptions {
    // Conditions
    isLoading: boolean;
    inputText: string;
    connectionStatus: 'idle' | 'connecting' | 'connected' | 'error';
    isEditMode: boolean;
    activeProjectId: string | null;
    chapterTitle: string;
    translatedText: string;
    saveStatus: 'idle' | 'saving' | 'saved';
    isTranslatedFullscreen: boolean;
    isSettingsOpen: boolean;
    isExportModalOpen: boolean;

    // Handlers
    onTranslate: () => void;
    onSaveChapter: () => void;
    onNewChapter: () => void;
    setIsTranslatedFullscreen: (value: boolean) => void;
    setIsSettingsOpen: (value: boolean) => void;
    setIsExportModalOpen: (value: boolean) => void;
}

/**
 * Global keyboard shortcuts hook
 * Handles: Ctrl+Enter (translate), Ctrl+S (save), Ctrl+Shift+N (new chapter), 
 * Escape (close modals), Ctrl+, (settings)
 */
export const useKeyboardShortcuts = (options: KeyboardShortcutsOptions) => {
    const {
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
        onTranslate,
        onSaveChapter,
        onNewChapter,
        setIsTranslatedFullscreen,
        setIsSettingsOpen,
        setIsExportModalOpen,
    } = options;

    useEffect(() => {
        const handleGlobalKeyDown = (event: KeyboardEvent) => {
            // Don't trigger shortcuts when typing in inputs/textareas (unless Ctrl/Cmd is pressed)
            const target = event.target as HTMLElement;
            const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

            // Ctrl/Cmd + Enter: Translate
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault();
                if (!isLoading && inputText.trim() && connectionStatus === 'connected' && !isEditMode) {
                    onTranslate();
                }
                return;
            }

            // Ctrl/Cmd + S: Save chapter
            if ((event.ctrlKey || event.metaKey) && event.key === 's') {
                event.preventDefault();
                if (activeProjectId && chapterTitle.trim() && translatedText.trim() && saveStatus === 'idle') {
                    onSaveChapter();
                }
                return;
            }

            // Ctrl/Cmd + Shift + N: New chapter
            if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'N') {
                event.preventDefault();
                if (activeProjectId) {
                    onNewChapter();
                }
                return;
            }

            // Escape: Close modals or exit fullscreen
            if (event.key === 'Escape') {
                if (isTranslatedFullscreen) {
                    setIsTranslatedFullscreen(false);
                } else if (isSettingsOpen) {
                    setIsSettingsOpen(false);
                } else if (isExportModalOpen) {
                    setIsExportModalOpen(false);
                }
                return;
            }

            // Ctrl/Cmd + ,: Open settings (only when not in input)
            if ((event.ctrlKey || event.metaKey) && event.key === ',' && !isInputFocused) {
                event.preventDefault();
                setIsSettingsOpen(true);
                return;
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [
        isLoading,
        inputText,
        connectionStatus,
        isEditMode,
        onTranslate,
        activeProjectId,
        chapterTitle,
        translatedText,
        saveStatus,
        onSaveChapter,
        onNewChapter,
        isTranslatedFullscreen,
        isSettingsOpen,
        isExportModalOpen,
        setIsTranslatedFullscreen,
        setIsSettingsOpen,
        setIsExportModalOpen,
    ]);
};
