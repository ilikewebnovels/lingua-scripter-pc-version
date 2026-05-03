import React, { useState, useMemo, useCallback } from 'react';
import { Chapter, Character, GlossaryEntry, Settings, BatchChapterStatus } from '../types';
import { filterEntriesForChapters } from '../hooks/useBatchTranslator';
import { buildBoundaryRegex } from '../utils/regexBoundary';

interface BatchTranslateModalProps {
    isOpen: boolean;
    onClose: () => void;
    chapters: Chapter[];
    glossary: GlossaryEntry[];
    characterDB: Character[];
    settings: Settings;
    // Parent state sync props for background translation persistence
    isBatchTranslating: boolean;
    batchChapterStatus: Record<string, BatchChapterStatus>;
    // Hook-provided actions (lifted to App.tsx so reading mode can use the same instance)
    runBatch: (chapters: Chapter[]) => Promise<{ translatedCount: number; charactersFound: number } | null>;
    runNextBatch: (allChapters: Chapter[]) => Promise<{ translatedCount: number; charactersFound: number } | null>;
    abortBatch: () => void;
    batchError: string | null;
    batchResult: { translatedCount: number; charactersFound: number } | null;
    clearBatchStatus: () => void;
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

const BatchTranslateModal: React.FC<BatchTranslateModalProps> = ({
    isOpen,
    onClose,
    chapters,
    glossary,
    characterDB,
    settings,
    isBatchTranslating,
    batchChapterStatus,
    runBatch,
    runNextBatch,
    abortBatch,
    batchError,
    batchResult,
    clearBatchStatus,
    isConnected,
}) => {
    const [selectedChapterIds, setSelectedChapterIds] = useState<Set<string>>(new Set());
    const isTranslating = isBatchTranslating;
    const chapterStatus = batchChapterStatus;

    // Range selection state
    const [rangeStart, setRangeStart] = useState<string>('');
    const [rangeEnd, setRangeEnd] = useState<string>('');

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
        // Pre-compile patterns once per render
        const glossaryRegexes = glossary
            .map(term => buildBoundaryRegex(term.original, settings.sourceLanguage))
            .filter((r): r is RegExp => r !== null);
        const characterRegexes = characterDB
            .map(character => buildBoundaryRegex(character.name, settings.sourceLanguage))
            .filter((r): r is RegExp => r !== null);

        const stats: Record<string, { glossaryCount: number; characterCount: number }> = {};

        for (const chapter of sortedChapters) {
            let glossaryCount = 0;
            let characterCount = 0;

            for (const regex of glossaryRegexes) {
                if (regex.test(chapter.originalText)) glossaryCount++;
            }
            for (const regex of characterRegexes) {
                if (regex.test(chapter.originalText)) characterCount++;
            }

            stats[chapter.id] = { glossaryCount, characterCount };
        }

        return stats;
    }, [sortedChapters, glossary, characterDB, settings.sourceLanguage]);

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

        const toSelect = settings.batchSkipTranslated
            ? chaptersInRange.filter(ch => !ch.translatedText?.trim())
            : chaptersInRange;

        setSelectedChapterIds(new Set(toSelect.map(ch => ch.id)));
    };

    // Translate Next Batch - uses hook
    const handleTranslateNextBatch = async () => {
        clearBatchStatus();
        // Pre-select for visual feedback
        const nextBatch = untranslatedChapters.slice(0, settings.batchSize);
        setSelectedChapterIds(new Set(nextBatch.map(ch => ch.id)));
        await runNextBatch(sortedChapters);
        setSelectedChapterIds(new Set());
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
        clearBatchStatus();
        const chaptersToTranslate = sortedChapters.filter(ch => selectedChapterIds.has(ch.id));
        await runBatch(chaptersToTranslate);
    };

    const handleClose = () => {
        // Allow closing even during translation - translation continues in background
        setSelectedChapterIds(new Set());
        clearBatchStatus();
        setRangeStart('');
        setRangeEnd('');
        onClose();
    };

    // Calculate stats for selected chapters
    const selectedBatchStats = useMemo(() => {
        const selectedChapters = sortedChapters.filter(ch => selectedChapterIds.has(ch.id));
        const totalChars = selectedChapters.reduce((sum, ch) => sum + (ch.originalText?.length || 0), 0);

        const { filteredGlossary, filteredCharacters } = filterEntriesForChapters(
            selectedChapters,
            glossary,
            characterDB,
            settings.sourceLanguage,
        );

        return {
            totalChars,
            glossaryCount: filteredGlossary.length,
            characterCount: filteredCharacters.length,
        };
    }, [sortedChapters, selectedChapterIds, glossary, characterDB, settings.sourceLanguage]);

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
                {batchError && (
                    <div className="mx-5 mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <p className="text-sm text-red-400">{batchError}</p>
                    </div>
                )}

                {batchResult && (
                    <div className="mx-5 mb-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <p className="text-sm text-green-400">
                            ✓ Translated {batchResult.translatedCount} chapter{batchResult.translatedCount !== 1 ? 's' : ''}
                            {batchResult.charactersFound > 0 && ` • Found ${batchResult.charactersFound} character${batchResult.charactersFound !== 1 ? 's' : ''}`}
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
                            {isTranslating ? 'Close' : (batchResult ? 'Done' : 'Cancel')}
                        </button>
                        {isTranslating ? (
                            <button
                                onClick={abortBatch}
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
