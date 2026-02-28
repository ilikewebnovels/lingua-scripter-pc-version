import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Chapter, Character, GlossaryEntry, Settings } from '../types';
import { translateBatch, translateBatchStream, analyzeForCharacters } from '../services/geminiService';
import type { BatchChapterStatus } from '../App';

interface BatchTranslateModalProps {
    isOpen: boolean;
    onClose: () => void;
    chapters: Chapter[];
    glossary: GlossaryEntry[];
    characterDB: Character[];
    settings: Settings;
    onUpdateChapter: (id: string, updates: Partial<Chapter>) => Promise<void>;
    onAddCharacters: (characters: Omit<Character, 'id'>[]) => void;
    // Parent state sync props for background translation persistence
    isBatchTranslating: boolean;
    batchChapterStatus: Record<string, BatchChapterStatus>;
    onBatchStart: (chapterIds: string[]) => void;
    onBatchProgress: (progress: {
        chapterId: string;
        status: BatchChapterStatus;
        streamingText?: string;
        completedCount?: number;
    }) => void;
    onBatchComplete: () => void;
    // Connection status - must be connected to translate
    isConnected: boolean;
}

// Icons
const LoadingSpinner = () => <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>;
const CheckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>;
const PlayIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>;
const GlossaryIcon = () => <span className="text-blue-400 text-xs font-medium">G</span>;
const CharacterIcon = () => <span className="text-purple-400 text-xs font-medium">C</span>;
const StopIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><rect x="6" y="6" width="8" height="8" rx="1" /></svg>;

// Chapter translation status
type ChapterStatus = 'pending' | 'translating' | 'completed' | 'error';

const BatchTranslateModal: React.FC<BatchTranslateModalProps> = ({
    isOpen,
    onClose,
    chapters,
    glossary,
    characterDB,
    settings,
    onUpdateChapter,
    onAddCharacters,
    // Parent state sync props
    isBatchTranslating,
    batchChapterStatus,
    onBatchStart,
    onBatchProgress,
    onBatchComplete,
    isConnected
}) => {
    const [selectedChapterIds, setSelectedChapterIds] = useState<Set<string>>(new Set());
    // Use parent's isTranslating state instead of local
    const isTranslating = isBatchTranslating;
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<{ translatedCount: number; charactersFound: number } | null>(null);

    // Use parent's chapter status instead of local (for display when modal re-opens)
    const chapterStatus = batchChapterStatus;
    // Local streaming text for display in modal (mirrors what parent tracks)
    const [streamingText, setStreamingText] = useState<string>('');
    const [currentStreamingChapter, setCurrentStreamingChapter] = useState<number>(0);

    // Range selection state
    const [rangeStart, setRangeStart] = useState<string>('');
    const [rangeEnd, setRangeEnd] = useState<string>('');

    // Abort controller for cancelling batch translation
    const batchAbortController = useRef<AbortController | null>(null);
    const isBatchCancelled = useRef(false);
    // Sort chapters
    const sortedChapters = useMemo(() =>
        [...chapters].sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0)),
        [chapters]
    );

    // Filter for untranslated chapters
    const untranslatedChapters = useMemo(() =>
        sortedChapters.filter(ch => !ch.translatedText?.trim()),
        [sortedChapters]
    );

    // Get min/max chapter numbers for validation
    const minChapterNum = sortedChapters.length > 0 ? sortedChapters[0].chapterNumber : 1;
    const maxChapterNum = sortedChapters.length > 0 ? sortedChapters[sortedChapters.length - 1].chapterNumber : 1;

    // Pre-compute regex match stats for all chapters (for UI display)
    const allChapterStats = useMemo(() => {
        const noBoundaryLanguages = ['Japanese', 'Chinese (Simplified)', 'Korean'];
        const useBoundaries = settings.sourceLanguage !== 'Auto-detect' && !noBoundaryLanguages.includes(settings.sourceLanguage);
        const boundary = useBoundaries ? '\\b' : '';

        const stats: Record<string, { glossaryCount: number; characterCount: number }> = {};

        for (const chapter of sortedChapters) {
            let glossaryCount = 0;
            let characterCount = 0;

            for (const term of glossary) {
                if (!term.original) continue;
                try {
                    const escaped = term.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(`${boundary}${escaped}${boundary}`, 'i');
                    if (regex.test(chapter.originalText)) glossaryCount++;
                } catch { /* ignore */ }
            }

            for (const character of characterDB) {
                if (!character.name) continue;
                try {
                    const escaped = character.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(`${boundary}${escaped}${boundary}`, 'i');
                    if (regex.test(chapter.originalText)) characterCount++;
                } catch { /* ignore */ }
            }

            stats[chapter.id] = { glossaryCount, characterCount };
        }

        return stats;
    }, [sortedChapters, glossary, characterDB, settings.sourceLanguage]);

    // Helper function to filter glossary and characters based on chapter text
    // Also computes per-chapter match statistics
    const filterEntriesForChapters = (chaptersToCheck: { id: string; originalText: string }[]) => {
        // Determine if we should use word boundaries based on source language
        const noBoundaryLanguages = ['Japanese', 'Chinese (Simplified)', 'Korean'];
        const useBoundaries = settings.sourceLanguage !== 'Auto-detect' && !noBoundaryLanguages.includes(settings.sourceLanguage);
        const boundary = useBoundaries ? '\\b' : '';

        // Combine all chapter texts for total filtering
        const combinedText = chaptersToCheck.map(ch => ch.originalText).join('\n');

        // Filter glossary entries that appear in any chapter
        const filteredGlossary = glossary.filter(term => {
            if (!term.original) return false;
            try {
                const escapedOriginal = term.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`${boundary}${escapedOriginal}${boundary}`, 'i');
                return regex.test(combinedText);
            } catch {
                return false;
            }
        });

        // Filter characters that appear in any chapter
        const filteredCharacters = characterDB.filter(character => {
            if (!character.name) return false;
            try {
                const escapedName = character.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`${boundary}${escapedName}${boundary}`, 'i');
                return regex.test(combinedText);
            } catch {
                return false;
            }
        });

        // Compute per-chapter stats
        const chapterStats: Record<string, { glossaryCount: number; characterCount: number }> = {};

        for (const chapter of chaptersToCheck) {
            let glossaryCount = 0;
            let characterCount = 0;

            // Count glossary matches for this chapter
            for (const term of glossary) {
                if (!term.original) continue;
                try {
                    const escapedOriginal = term.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(`${boundary}${escapedOriginal}${boundary}`, 'i');
                    if (regex.test(chapter.originalText)) glossaryCount++;
                } catch { /* ignore */ }
            }

            // Count character matches for this chapter
            for (const character of characterDB) {
                if (!character.name) continue;
                try {
                    const escapedName = character.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(`${boundary}${escapedName}${boundary}`, 'i');
                    if (regex.test(chapter.originalText)) characterCount++;
                } catch { /* ignore */ }
            }

            chapterStats[chapter.id] = { glossaryCount, characterCount };
        }

        return { filteredGlossary, filteredCharacters, chapterStats };
    };

    if (!isOpen) return null;

    const handleSelectAll = () => {
        if (settings.batchSkipTranslated) {
            setSelectedChapterIds(new Set(untranslatedChapters.map(ch => ch.id)));
        } else {
            setSelectedChapterIds(new Set(sortedChapters.map(ch => ch.id)));
        }
    };

    const handleSelectNone = () => {
        setSelectedChapterIds(new Set());
    };

    const handleSelectUntranslated = () => {
        setSelectedChapterIds(new Set(untranslatedChapters.map(ch => ch.id)));
    };

    // Select range of chapters
    const handleSelectRange = () => {
        const start = parseInt(rangeStart);
        const end = parseInt(rangeEnd);

        if (isNaN(start) || isNaN(end)) return;
        if (start > end) return;

        const chaptersInRange = sortedChapters.filter(ch =>
            ch.chapterNumber >= start && ch.chapterNumber <= end
        );

        // If skip translated is enabled, only select untranslated in range
        const toSelect = settings.batchSkipTranslated
            ? chaptersInRange.filter(ch => !ch.translatedText?.trim())
            : chaptersInRange;

        setSelectedChapterIds(new Set(toSelect.map(ch => ch.id)));
    };

    // Handle stopping batch translation
    const handleStopBatchTranslation = useCallback(() => {
        isBatchCancelled.current = true;
        if (batchAbortController.current) {
            batchAbortController.current.abort();
            batchAbortController.current = null;
        }
        onBatchComplete();
    }, [onBatchComplete]);

    // Translate Next Batch - selects next N untranslated chapters and starts translation
    const handleTranslateNextBatch = async () => {
        // Get next batch of untranslated chapters
        const nextBatch = untranslatedChapters.slice(0, settings.batchSize);

        if (nextBatch.length === 0) {
            setError('No untranslated chapters remaining.');
            return;
        }

        // Select them
        setSelectedChapterIds(new Set(nextBatch.map(ch => ch.id)));

        // Notify parent that batch translation is starting
        const chapterIds = nextBatch.map(ch => ch.id);
        onBatchStart(chapterIds);
        // Reset cancellation state and create new AbortController
        isBatchCancelled.current = false;
        batchAbortController.current = new AbortController();
        setError(null);
        setResult(null);
        setStreamingText('');
        setCurrentStreamingChapter(0);

        const chaptersToTranslate = nextBatch.map(ch => ({
            id: ch.id,
            title: ch.title,
            originalText: ch.originalText
        }));

        // Filter glossary and characters to only include entries that appear in the batch chapters
        const { filteredGlossary, filteredCharacters } = filterEntriesForChapters(chaptersToTranslate);

        try {
            if (settings.isStreamingEnabled) {
                // Streaming mode - update chapters as they complete
                let translatedCount = 0;
                let currentChapterStreamingText = '';
                const stream = translateBatchStream(
                    chaptersToTranslate,
                    filteredGlossary,
                    filteredCharacters,
                    settings,
                    batchAbortController.current?.signal
                );

                for await (const progress of stream) {
                    // Check if cancelled
                    if (isBatchCancelled.current) break;
                    if (progress.type === 'chunk' && progress.chapterIndex && progress.text) {
                        // Update streaming text for live display
                        currentChapterStreamingText += progress.text;
                        setStreamingText(prev => prev + progress.text);
                        setCurrentStreamingChapter(progress.chapterIndex);

                        // Notify parent of streaming progress
                        const chapterId = chaptersToTranslate[progress.chapterIndex - 1]?.id;
                        if (chapterId) {
                            onBatchProgress({
                                chapterId,
                                status: 'translating',
                                streamingText: currentChapterStreamingText,
                                completedCount: translatedCount
                            });
                        }
                    } else if (progress.type === 'chapter_complete' && progress.chapterId && progress.fullText) {
                        // Save completed chapter
                        await onUpdateChapter(progress.chapterId, {
                            translatedText: progress.fullText
                        });
                        translatedCount++;
                        // Reset streaming text for next chapter
                        currentChapterStreamingText = '';
                        // Notify parent of completion
                        onBatchProgress({
                            chapterId: progress.chapterId,
                            status: 'completed',
                            completedCount: translatedCount
                        });
                    } else if (progress.type === 'error') {
                        setError(progress.error || 'Streaming error');
                        break;
                    }
                }

                // After streaming batch completes, analyze for new characters (like single chapter streaming does)
                let charactersFound = 0;
                if (translatedCount > 0 && settings.isAutoCharacterDetectionEnabled) {
                    // Combine all original texts for character analysis
                    const combinedText = chaptersToTranslate.map(ch => ch.originalText).join('\n\n');
                    console.log('[BatchTranslate] Starting character analysis for streaming batch...');
                    console.log('[BatchTranslate] Combined text length:', combinedText.length);
                    try {
                        const charResult = await analyzeForCharacters(combinedText, settings);
                        console.log('[BatchTranslate] Character analysis result:', charResult);
                        if ('characters' in charResult && charResult.characters.length > 0) {
                            console.log('[BatchTranslate] Found', charResult.characters.length, 'characters, adding to database...');
                            onAddCharacters(charResult.characters);
                            charactersFound = charResult.characters.length;
                        } else if ('error' in charResult) {
                            console.error('[BatchTranslate] Character analysis error:', charResult.error);
                            setError(charResult.error);
                        } else {
                            console.log('[BatchTranslate] No characters found in analysis');
                        }
                    } catch (charError) {
                        console.error('[BatchTranslate] Character analysis exception:', charError);
                    }
                } else {
                    console.log('[BatchTranslate] Skipping character analysis - translatedCount:', translatedCount, 'isAutoEnabled:', settings.isAutoCharacterDetectionEnabled);
                }

                setResult({ translatedCount, charactersFound });
                setSelectedChapterIds(new Set());

            } else {
                // Non-streaming mode - existing logic
                const response = await translateBatch(
                    chaptersToTranslate,
                    filteredGlossary,
                    filteredCharacters,
                    settings,
                    batchAbortController.current?.signal
                );

                if ('error' in response) {
                    setError(response.error);
                    onBatchComplete();
                    return;
                }

                // Update each chapter with its translation
                let translatedCount = 0;
                for (const translation of response.translations) {
                    if (translation.translatedText) {
                        await onUpdateChapter(translation.chapterId, {
                            translatedText: translation.translatedText
                        });
                        translatedCount++;
                        onBatchProgress({
                            chapterId: translation.chapterId,
                            status: 'completed',
                            completedCount: translatedCount
                        });
                    }
                }

                // Add new characters to the database
                if (response.characters && response.characters.length > 0 && settings.isAutoCharacterDetectionEnabled) {
                    onAddCharacters(response.characters);
                }

                setResult({
                    translatedCount,
                    charactersFound: response.characters?.length || 0
                });

                // Clear selection after successful batch
                setSelectedChapterIds(new Set());
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        }

        onBatchComplete();
    };

    const handleToggleChapter = (chapterId: string) => {
        setSelectedChapterIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(chapterId)) {
                newSet.delete(chapterId);
            } else {
                newSet.add(chapterId);
            }
            return newSet;
        });
    };

    const handleBatchTranslate = async () => {
        if (selectedChapterIds.size === 0) return;

        // Notify parent that batch translation is starting
        const chapterIds = Array.from(selectedChapterIds);
        onBatchStart(chapterIds);
        // Reset cancellation state and create new AbortController
        isBatchCancelled.current = false;
        batchAbortController.current = new AbortController();
        setError(null);
        setResult(null);
        setStreamingText('');
        setCurrentStreamingChapter(0);

        // Prepare chapters for translation
        const chaptersToTranslate = sortedChapters
            .filter(ch => selectedChapterIds.has(ch.id))
            .map(ch => ({
                id: ch.id,
                title: ch.title,
                originalText: ch.originalText
            }));

        // Filter glossary and characters to only include entries that appear in the batch chapters
        const { filteredGlossary, filteredCharacters } = filterEntriesForChapters(chaptersToTranslate);

        try {
            if (settings.isStreamingEnabled) {
                // Streaming mode
                let translatedCount = 0;
                let currentChapterStreamingText = '';
                const stream = translateBatchStream(
                    chaptersToTranslate,
                    filteredGlossary,
                    filteredCharacters,
                    settings,
                    batchAbortController.current?.signal
                );

                for await (const progress of stream) {
                    // Check if cancelled
                    if (isBatchCancelled.current) break;
                    if (progress.type === 'chunk' && progress.chapterIndex && progress.text) {
                        currentChapterStreamingText += progress.text;
                        setStreamingText(prev => prev + progress.text);
                        setCurrentStreamingChapter(progress.chapterIndex);

                        // Notify parent of streaming progress
                        const chapterId = chaptersToTranslate[progress.chapterIndex - 1]?.id;
                        if (chapterId) {
                            onBatchProgress({
                                chapterId,
                                status: 'translating',
                                streamingText: currentChapterStreamingText,
                                completedCount: translatedCount
                            });
                        }
                    } else if (progress.type === 'chapter_complete' && progress.chapterId && progress.fullText) {
                        await onUpdateChapter(progress.chapterId, {
                            translatedText: progress.fullText
                        });
                        translatedCount++;
                        // Reset streaming text for next chapter
                        currentChapterStreamingText = '';
                        // Notify parent of completion
                        onBatchProgress({
                            chapterId: progress.chapterId,
                            status: 'completed',
                            completedCount: translatedCount
                        });
                    } else if (progress.type === 'error') {
                        setError(progress.error || 'Streaming error');
                        break;
                    }
                }

                // After streaming batch completes, analyze for new characters (like single chapter streaming does)
                let charactersFound = 0;
                if (translatedCount > 0 && settings.isAutoCharacterDetectionEnabled) {
                    // Combine all original texts for character analysis
                    const combinedText = chaptersToTranslate.map(ch => ch.originalText).join('\n\n');
                    console.log('[BatchTranslate] Starting character analysis for streaming batch...');
                    console.log('[BatchTranslate] Combined text length:', combinedText.length);
                    try {
                        const charResult = await analyzeForCharacters(combinedText, settings);
                        console.log('[BatchTranslate] Character analysis result:', charResult);
                        if ('characters' in charResult && charResult.characters.length > 0) {
                            console.log('[BatchTranslate] Found', charResult.characters.length, 'characters, adding to database...');
                            onAddCharacters(charResult.characters);
                            charactersFound = charResult.characters.length;
                        } else if ('error' in charResult) {
                            console.error('[BatchTranslate] Character analysis error:', charResult.error);
                            setError(charResult.error);
                        } else {
                            console.log('[BatchTranslate] No characters found in analysis');
                        }
                    } catch (charError) {
                        console.error('[BatchTranslate] Character analysis exception:', charError);
                    }
                } else {
                    console.log('[BatchTranslate] Skipping character analysis - translatedCount:', translatedCount, 'isAutoEnabled:', settings.isAutoCharacterDetectionEnabled);
                }

                setResult({ translatedCount, charactersFound });

            } else {
                // Non-streaming mode
                const response = await translateBatch(
                    chaptersToTranslate,
                    filteredGlossary,
                    filteredCharacters,
                    settings,
                    batchAbortController.current?.signal
                );

                if ('error' in response) {
                    setError(response.error);
                    onBatchComplete();
                    return;
                }

                let translatedCount = 0;
                for (const translation of response.translations) {
                    if (translation.translatedText) {
                        await onUpdateChapter(translation.chapterId, {
                            translatedText: translation.translatedText
                        });
                        translatedCount++;
                        onBatchProgress({
                            chapterId: translation.chapterId,
                            status: 'completed',
                            completedCount: translatedCount
                        });
                    }
                }

                if (response.characters && response.characters.length > 0 && settings.isAutoCharacterDetectionEnabled) {
                    onAddCharacters(response.characters);
                }

                setResult({
                    translatedCount,
                    charactersFound: response.characters?.length || 0
                });
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        }

        onBatchComplete();
    };

    const handleClose = () => {
        // Allow closing even during translation - translation continues in background
        // Don't reset batch state since it's now managed by parent for persistence
        setSelectedChapterIds(new Set());
        setError(null);
        setResult(null);
        setRangeStart('');
        setRangeEnd('');
        // Local streaming text can be reset since parent tracks it independently
        setStreamingText('');
        setCurrentStreamingChapter(0);
        onClose();
    };

    // Calculate stats for selected chapters
    const selectedBatchStats = useMemo(() => {
        const selectedChapters = sortedChapters.filter(ch => selectedChapterIds.has(ch.id));
        const totalChars = selectedChapters.reduce((sum, ch) => sum + (ch.originalText?.length || 0), 0);

        // Get unique glossary and character matches across all selected chapters
        const glossarySet = new Set<string>();
        const characterSet = new Set<string>();

        for (const chapter of selectedChapters) {
            const stats = allChapterStats[chapter.id];
            if (stats) {
                // We count unique matches per chapter, so we need to track which matched
                glossarySet.add(`${chapter.id}-g-${stats.glossaryCount}`);
                characterSet.add(`${chapter.id}-c-${stats.characterCount}`);
            }
        }

        // Sum up the counts from each chapter
        let totalGlossary = 0;
        let totalCharacters = 0;
        for (const chapter of selectedChapters) {
            const stats = allChapterStats[chapter.id];
            if (stats) {
                totalGlossary = Math.max(totalGlossary, stats.glossaryCount); // Use max as unique count
                totalCharacters = Math.max(totalCharacters, stats.characterCount);
            }
        }

        // Actually compute properly - filter entries that match ANY selected chapter
        const { filteredGlossary, filteredCharacters } = filterEntriesForChapters(selectedChapters);

        return {
            totalChars,
            glossaryCount: filteredGlossary.length,
            characterCount: filteredCharacters.length
        };
    }, [sortedChapters, selectedChapterIds, allChapterStats, filterEntriesForChapters]);

    // Legacy - for backward compatibility
    const totalCharCount = selectedBatchStats.totalChars;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50" onClick={handleClose}>
            <div
                className="bg-[var(--bg-secondary)] rounded-xl shadow-2xl w-full max-w-lg border border-[var(--border-primary)] animate-fade-in max-h-[80vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-primary)]">
                    <h2 className="text-lg font-bold text-[var(--text-primary)]">Batch Translate</h2>
                    <button onClick={handleClose} className="p-1 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Quick Actions */}
                <div className="px-5 py-3 border-b border-[var(--border-primary)] bg-[var(--bg-tertiary)]/50 space-y-3">
                    {/* Connection warning */}
                    {!isConnected && (
                        <div className="flex items-center gap-2 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-md px-3 py-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            Please connect to the API first before translating
                        </div>
                    )}
                    {/* Translate Next Batch - prominent button */}
                    <button
                        onClick={handleTranslateNextBatch}
                        disabled={isTranslating || untranslatedChapters.length === 0 || !isConnected}
                        className="w-full flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-[var(--text-on-accent)] transition-colors disabled:opacity-50"
                        title={!isConnected ? 'Please connect to the API first' : ''}
                    >
                        {isTranslating ? <LoadingSpinner /> : <PlayIcon />}
                        Translate Next {Math.min(settings.batchSize, untranslatedChapters.length)} Chapters
                    </button>

                    {/* Range Selection */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--text-secondary)]">Range:</span>
                        <input
                            type="number"
                            min={minChapterNum}
                            max={maxChapterNum}
                            value={rangeStart}
                            onChange={(e) => setRangeStart(e.target.value)}
                            placeholder={String(minChapterNum)}
                            disabled={isTranslating}
                            className="w-16 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-md px-2 py-1 text-xs text-[var(--text-primary)] outline-none text-center"
                        />
                        <span className="text-xs text-[var(--text-secondary)]">to</span>
                        <input
                            type="number"
                            min={minChapterNum}
                            max={maxChapterNum}
                            value={rangeEnd}
                            onChange={(e) => setRangeEnd(e.target.value)}
                            placeholder={String(maxChapterNum)}
                            disabled={isTranslating}
                            className="w-16 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-md px-2 py-1 text-xs text-[var(--text-primary)] outline-none text-center"
                        />
                        <button
                            onClick={handleSelectRange}
                            disabled={isTranslating || !rangeStart || !rangeEnd}
                            className="text-xs font-medium px-3 py-1.5 rounded-md bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/30 transition-colors disabled:opacity-50"
                        >
                            Select
                        </button>
                    </div>

                    {/* Other selection buttons */}
                    <div className="flex gap-2">
                        <button onClick={handleSelectAll} disabled={isTranslating} className="text-xs font-medium px-3 py-1.5 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50">
                            Select All
                        </button>
                        <button onClick={handleSelectUntranslated} disabled={isTranslating} className="text-xs font-medium px-3 py-1.5 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50">
                            Untranslated ({untranslatedChapters.length})
                        </button>
                        <button onClick={handleSelectNone} disabled={isTranslating} className="text-xs font-medium px-3 py-1.5 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50">
                            Clear
                        </button>
                    </div>
                </div>

                {/* Chapter List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {sortedChapters.length === 0 ? (
                        <p className="text-center text-[var(--text-secondary)] py-8">No chapters available</p>
                    ) : (
                        sortedChapters.map(chapter => {
                            const isSelected = selectedChapterIds.has(chapter.id);
                            const hasTranslation = !!chapter.translatedText?.trim();

                            return (
                                <label
                                    key={chapter.id}
                                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${isSelected
                                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                                        : 'border-[var(--border-primary)] bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)]/80'
                                        } ${isTranslating ? 'opacity-70 pointer-events-none' : ''}`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => handleToggleChapter(chapter.id)}
                                        disabled={isTranslating}
                                        className="h-4 w-4 rounded border-gray-500 bg-[var(--bg-tertiary)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]/50"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                                            Ch. {chapter.chapterNumber}: {chapter.title || 'Untitled'}
                                        </p>
                                        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                                            <span>{chapter.originalText?.length?.toLocaleString() || 0} chars</span>
                                            {allChapterStats[chapter.id] && (
                                                <>
                                                    <span className="text-[var(--border-primary)]">•</span>
                                                    <span className="flex items-center gap-0.5" title="Glossary matches">
                                                        <GlossaryIcon /> {allChapterStats[chapter.id].glossaryCount}
                                                    </span>
                                                    <span className="flex items-center gap-0.5" title="Character matches">
                                                        <CharacterIcon /> {allChapterStats[chapter.id].characterCount}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    {/* Status indicator */}
                                    {chapterStatus[chapter.id] === 'translating' && (
                                        <span className="flex items-center gap-1 text-xs text-yellow-400">
                                            <LoadingSpinner /> Translating...
                                        </span>
                                    )}
                                    {chapterStatus[chapter.id] === 'completed' && (
                                        <span className="flex items-center gap-1 text-xs text-green-400">
                                            <CheckIcon /> Done
                                        </span>
                                    )}
                                    {chapterStatus[chapter.id] === 'error' && (
                                        <span className="text-xs text-red-400">Error</span>
                                    )}
                                    {!chapterStatus[chapter.id] && hasTranslation && (
                                        <span className="flex items-center gap-1 text-xs text-green-400">
                                            <CheckIcon /> Translated
                                        </span>
                                    )}
                                </label>
                            );
                        })
                    )}
                </div>

                {/* Status / Error */}
                {error && (
                    <div className="mx-5 mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <p className="text-sm text-red-400">{error}</p>
                    </div>
                )}

                {result && (
                    <div className="mx-5 mb-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <p className="text-sm text-green-400">
                            ✓ Translated {result.translatedCount} chapter{result.translatedCount !== 1 ? 's' : ''}
                            {result.charactersFound > 0 && ` • Found ${result.charactersFound} character${result.charactersFound !== 1 ? 's' : ''}`}
                        </p>
                    </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-[var(--border-primary)] bg-[var(--bg-tertiary)]/50">
                    <div className="text-xs text-[var(--text-secondary)]">
                        {selectedChapterIds.size > 0 ? (
                            <div className="flex items-center gap-2 flex-wrap">
                                <span>
                                    <span className="font-medium text-[var(--text-primary)]">{selectedChapterIds.size}</span> chapter{selectedChapterIds.size !== 1 ? 's' : ''}
                                </span>
                                <span className="text-[var(--border-primary)]">•</span>
                                <span>{totalCharCount.toLocaleString()} chars</span>
                                <span className="text-[var(--border-primary)]">•</span>
                                <span className="flex items-center gap-0.5" title="Glossary entries matched">
                                    <GlossaryIcon /> {selectedBatchStats.glossaryCount}
                                </span>
                                <span className="flex items-center gap-0.5" title="Characters matched">
                                    <CharacterIcon /> {selectedBatchStats.characterCount}
                                </span>
                            </div>
                        ) : (
                            `Batch size: ${settings.batchSize} • ${untranslatedChapters.length} untranslated`
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleClose}
                            className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                        >
                            {isTranslating ? 'Close' : (result ? 'Done' : 'Cancel')}
                        </button>
                        {isTranslating ? (
                            <button
                                onClick={handleStopBatchTranslation}
                                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors"
                            >
                                <StopIcon />
                                Stop Translating
                            </button>
                        ) : (
                            <button
                                onClick={handleBatchTranslate}
                                disabled={selectedChapterIds.size === 0 || !isConnected}
                                className="flex items-center gap-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-[var(--text-on-accent)] font-semibold px-5 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
                                title={!isConnected ? 'Please connect to the API first' : ''}
                            >
                                {`Translate ${selectedChapterIds.size > 0 ? selectedChapterIds.size : ''} Chapter${selectedChapterIds.size !== 1 ? 's' : ''}`}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BatchTranslateModal;
