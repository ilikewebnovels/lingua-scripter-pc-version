import { useCallback, useRef, useState } from 'react';
import { Chapter, Character, GlossaryEntry, Settings, BatchChapterStatus } from '../types';
import { translateBatch, translateBatchStream, analyzeForCharacters } from '../services/geminiService';
import { buildBoundaryRegex } from '../utils/regexBoundary';

// Helper - filter glossary/characters that match any chapter's originalText.
// Extracted from BatchTranslateModal.tsx (lines 131-195) to be reused by the hook.
export const filterEntriesForChapters = (
    chaptersToCheck: { id: string; originalText: string }[],
    glossary: GlossaryEntry[],
    characterDB: Character[],
    sourceLanguage: string,
) => {
    const combinedText = chaptersToCheck.map(ch => ch.originalText).join('\n');

    // Pre-compile patterns once
    const glossaryPatterns = glossary.map(term => ({
        term,
        regex: buildBoundaryRegex(term.original, sourceLanguage),
    }));
    const characterPatterns = characterDB.map(character => ({
        character,
        regex: buildBoundaryRegex(character.name, sourceLanguage),
    }));

    const filteredGlossary = glossaryPatterns
        .filter(p => p.regex !== null && p.regex.test(combinedText))
        .map(p => p.term);

    const filteredCharacters = characterPatterns
        .filter(p => p.regex !== null && p.regex.test(combinedText))
        .map(p => p.character);

    // Per-chapter stats (used by the modal UI)
    const chapterStats: Record<string, { glossaryCount: number; characterCount: number }> = {};
    for (const chapter of chaptersToCheck) {
        let glossaryCount = 0;
        let characterCount = 0;

        for (const p of glossaryPatterns) {
            if (p.regex && p.regex.test(chapter.originalText)) glossaryCount++;
        }
        for (const p of characterPatterns) {
            if (p.regex && p.regex.test(chapter.originalText)) characterCount++;
        }

        chapterStats[chapter.id] = { glossaryCount, characterCount };
    }

    return { filteredGlossary, filteredCharacters, chapterStats };
};

export interface BatchProgressPayload {
    chapterId: string;
    status: BatchChapterStatus;
    streamingText?: string;
    completedCount?: number;
}

export interface BatchResultPayload {
    translatedCount: number;
    charactersFound: number;
}

export interface UseBatchTranslatorOptions {
    settings: Settings;
    glossary: GlossaryEntry[];
    characterDB: Character[];
    onUpdateChapter: (id: string, updates: Partial<Chapter>) => Promise<void>;
    onAddCharacters: (characters: Omit<Character, 'id'>[]) => void;
    onBatchStart: (chapterIds: string[]) => void;
    onBatchProgress: (progress: BatchProgressPayload) => void;
    onBatchComplete: () => void;
}

export interface UseBatchTranslatorReturn {
    runBatch: (chapters: Chapter[]) => Promise<BatchResultPayload | null>;
    runNextBatch: (allChapters: Chapter[]) => Promise<BatchResultPayload | null>;
    abort: () => void;
    isRunning: boolean;
    error: string | null;
    result: BatchResultPayload | null;
    clearStatus: () => void;
}

export const useBatchTranslator = ({
    settings,
    glossary,
    characterDB,
    onUpdateChapter,
    onAddCharacters,
    onBatchStart,
    onBatchProgress,
    onBatchComplete,
}: UseBatchTranslatorOptions): UseBatchTranslatorReturn => {
    const [isRunning, setIsRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<BatchResultPayload | null>(null);

    const abortControllerRef = useRef<AbortController | null>(null);
    const isCancelledRef = useRef(false);

    const abort = useCallback(() => {
        isCancelledRef.current = true;
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        onBatchComplete();
        setIsRunning(false);
    }, [onBatchComplete]);

    const clearStatus = useCallback(() => {
        setError(null);
        setResult(null);
    }, []);

    const runBatch = useCallback(async (chapters: Chapter[]): Promise<BatchResultPayload | null> => {
        if (chapters.length === 0) {
            setError('No chapters to translate.');
            return null;
        }

        // Notify parent
        const chapterIds = chapters.map(ch => ch.id);
        onBatchStart(chapterIds);

        // Reset
        isCancelledRef.current = false;
        abortControllerRef.current = new AbortController();
        setError(null);
        setResult(null);
        setIsRunning(true);

        const chaptersToTranslate = chapters.map(ch => ({
            id: ch.id,
            title: ch.title,
            originalText: ch.originalText,
        }));

        const { filteredGlossary, filteredCharacters } = filterEntriesForChapters(
            chaptersToTranslate,
            glossary,
            characterDB,
            settings.sourceLanguage,
        );

        let resultPayload: BatchResultPayload | null = null;

        try {
            if (settings.isStreamingEnabled) {
                let translatedCount = 0;
                let currentChapterStreamingText = '';
                const stream = translateBatchStream(
                    chaptersToTranslate,
                    filteredGlossary,
                    filteredCharacters,
                    settings,
                    abortControllerRef.current?.signal,
                );

                for await (const progress of stream) {
                    if (isCancelledRef.current) break;
                    if (progress.type === 'chunk' && progress.chapterIndex && progress.text) {
                        currentChapterStreamingText += progress.text;
                        const chapterId = chaptersToTranslate[progress.chapterIndex - 1]?.id;
                        if (chapterId) {
                            onBatchProgress({
                                chapterId,
                                status: 'translating',
                                streamingText: currentChapterStreamingText,
                                completedCount: translatedCount,
                            });
                        }
                    } else if (progress.type === 'chapter_complete' && progress.chapterId && progress.fullText) {
                        await onUpdateChapter(progress.chapterId, {
                            translatedText: progress.fullText,
                        });
                        translatedCount++;
                        currentChapterStreamingText = '';
                        onBatchProgress({
                            chapterId: progress.chapterId,
                            status: 'completed',
                            completedCount: translatedCount,
                        });
                    } else if (progress.type === 'error') {
                        setError(progress.error || 'Streaming error');
                        break;
                    }
                }

                let charactersFound = 0;
                if (translatedCount > 0 && settings.isAutoCharacterDetectionEnabled) {
                    const combinedText = chaptersToTranslate.map(ch => ch.originalText).join('\n\n');
                    try {
                        const charResult = await analyzeForCharacters(combinedText, settings);
                        if ('characters' in charResult && charResult.characters.length > 0) {
                            onAddCharacters(charResult.characters);
                            charactersFound = charResult.characters.length;
                        } else if ('error' in charResult) {
                            setError(charResult.error);
                        }
                    } catch (charError) {
                        console.error('[useBatchTranslator] Character analysis exception:', charError);
                    }
                }

                resultPayload = { translatedCount, charactersFound };
                setResult(resultPayload);
            } else {
                // Non-streaming mode
                const response = await translateBatch(
                    chaptersToTranslate,
                    filteredGlossary,
                    filteredCharacters,
                    settings,
                    abortControllerRef.current?.signal,
                );

                if ('error' in response) {
                    setError(response.error);
                    onBatchComplete();
                    setIsRunning(false);
                    return null;
                }

                let translatedCount = 0;
                for (const translation of response.translations) {
                    if (translation.translatedText) {
                        await onUpdateChapter(translation.chapterId, {
                            translatedText: translation.translatedText,
                        });
                        translatedCount++;
                        onBatchProgress({
                            chapterId: translation.chapterId,
                            status: 'completed',
                            completedCount: translatedCount,
                        });
                    }
                }

                if (response.characters && response.characters.length > 0 && settings.isAutoCharacterDetectionEnabled) {
                    onAddCharacters(response.characters);
                }

                resultPayload = {
                    translatedCount,
                    charactersFound: response.characters?.length || 0,
                };
                setResult(resultPayload);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        }

        onBatchComplete();
        setIsRunning(false);
        return resultPayload;
    }, [settings, glossary, characterDB, onUpdateChapter, onAddCharacters, onBatchStart, onBatchProgress, onBatchComplete]);

    const runNextBatch = useCallback(async (allChapters: Chapter[]): Promise<BatchResultPayload | null> => {
        const sorted = [...allChapters].sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));
        const untranslated = sorted.filter(ch => !ch.translatedText?.trim());
        const nextBatch = untranslated.slice(0, settings.batchSize);
        if (nextBatch.length === 0) {
            setError('No untranslated chapters remaining.');
            return null;
        }
        return runBatch(nextBatch);
    }, [runBatch, settings.batchSize]);

    return {
        runBatch,
        runNextBatch,
        abort,
        isRunning,
        error,
        result,
        clearStatus,
    };
};
