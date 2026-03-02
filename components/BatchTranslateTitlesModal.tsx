import React, { useMemo, useState, useCallback, useRef } from 'react';
import { Chapter, Settings } from '../types';
import { translateChapterTitles } from '../services/geminiService';

interface BatchTranslateTitlesModalProps {
    isOpen: boolean;
    onClose: () => void;
    chapters: Chapter[];
    settings: Settings;
    onUpdateChapter: (id: string, updates: Partial<Chapter>) => Promise<void>;
    isConnected: boolean;
}

const LoadingSpinner = () => <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>;
const PlayIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>;
const CheckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>;
const StopIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><rect x="6" y="6" width="8" height="8" rx="1" /></svg>;

const BatchTranslateTitlesModal: React.FC<BatchTranslateTitlesModalProps> = ({
    isOpen,
    onClose,
    chapters,
    settings,
    onUpdateChapter,
    isConnected
}) => {
    const [selectedChapterIds, setSelectedChapterIds] = useState<Set<string>>(new Set());
    const [rangeStart, setRangeStart] = useState('');
    const [rangeEnd, setRangeEnd] = useState('');
    const [isTranslating, setIsTranslating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<{ updated: number; total: number } | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const sortedChapters = useMemo(() =>
        [...chapters].sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0)),
        [chapters]
    );

    const minChapterNum = sortedChapters.length > 0 ? sortedChapters[0].chapterNumber : 1;
    const maxChapterNum = sortedChapters.length > 0 ? sortedChapters[sortedChapters.length - 1].chapterNumber : 1;

    const selectedChapters = useMemo(() =>
        sortedChapters.filter(ch => selectedChapterIds.has(ch.id)),
        [sortedChapters, selectedChapterIds]
    );

    const handleSelectAll = () => setSelectedChapterIds(new Set(sortedChapters.map(ch => ch.id)));
    const handleClearSelection = () => setSelectedChapterIds(new Set());

    const handleSelectFirstN = () => {
        const firstBatch = sortedChapters.slice(0, settings.batchSize);
        setSelectedChapterIds(new Set(firstBatch.map(ch => ch.id)));
    };

    const handleSelectRange = () => {
        const start = parseInt(rangeStart, 10);
        const end = parseInt(rangeEnd, 10);
        if (isNaN(start) || isNaN(end) || start > end) return;

        const inRange = sortedChapters.filter(ch => ch.chapterNumber >= start && ch.chapterNumber <= end);
        setSelectedChapterIds(new Set(inRange.map(ch => ch.id)));
    };

    const handleToggleChapter = (chapterId: string) => {
        setSelectedChapterIds(prev => {
            const next = new Set(prev);
            if (next.has(chapterId)) next.delete(chapterId);
            else next.add(chapterId);
            return next;
        });
    };

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsTranslating(false);
    };

    const handleTranslateTitles = useCallback(async () => {
        if (selectedChapters.length === 0) return;

        setIsTranslating(true);
        setError(null);
        setResult(null);
        abortControllerRef.current = new AbortController();

        try {
            const payload = selectedChapters.map(ch => ({
                id: ch.id,
                title: ch.title || `Chapter ${ch.chapterNumber}`
            }));

            const response = await translateChapterTitles(payload, settings, abortControllerRef.current.signal);
            if ('error' in response) {
                setError(response.error);
                return;
            }

            const map = new Map(response.titles.map(item => [item.id, item.translatedTitle]));
            let updatedCount = 0;

            for (const chapter of selectedChapters) {
                const translatedTitle = map.get(chapter.id);
                if (translatedTitle && translatedTitle !== chapter.title) {
                    await onUpdateChapter(chapter.id, { title: translatedTitle });
                    updatedCount++;
                }
            }

            setResult({ updated: updatedCount, total: selectedChapters.length });
        } catch (err) {
            const errorName = typeof err === 'object' && err !== null && 'name' in err
                ? String((err as { name: string }).name)
                : '';
            if (errorName !== 'AbortError') {
                setError(err instanceof Error ? err.message : 'Failed to translate chapter titles.');
            }
        } finally {
            abortControllerRef.current = null;
            setIsTranslating(false);
        }
    }, [selectedChapters, settings, onUpdateChapter]);

    const handleClose = () => {
        if (isTranslating) return;
        setSelectedChapterIds(new Set());
        setRangeStart('');
        setRangeEnd('');
        setError(null);
        setResult(null);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50" onClick={handleClose}>
            <div
                className="bg-[var(--bg-secondary)] rounded-xl shadow-2xl w-full max-w-lg border border-[var(--border-primary)] animate-fade-in max-h-[80vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-primary)]">
                    <h2 className="text-lg font-bold text-[var(--text-primary)]">Translate Chapter Titles</h2>
                    <button onClick={handleClose} disabled={isTranslating} className="p-1 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="px-5 py-3 border-b border-[var(--border-primary)] bg-[var(--bg-tertiary)]/50 space-y-3">
                    {!isConnected && (
                        <div className="flex items-center gap-2 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-md px-3 py-2">
                            Please connect to the API first before translating titles
                        </div>
                    )}

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

                    <div className="flex gap-2">
                        <button onClick={handleSelectAll} disabled={isTranslating} className="text-xs font-medium px-3 py-1.5 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50">
                            Select All
                        </button>
                        <button onClick={handleSelectFirstN} disabled={isTranslating} className="text-xs font-medium px-3 py-1.5 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50">
                            First {Math.min(settings.batchSize, sortedChapters.length)}
                        </button>
                        <button onClick={handleClearSelection} disabled={isTranslating} className="text-xs font-medium px-3 py-1.5 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50">
                            Clear
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {sortedChapters.length === 0 ? (
                        <p className="text-center text-[var(--text-secondary)] py-8">No chapters available</p>
                    ) : (
                        sortedChapters.map(chapter => {
                            const isSelected = selectedChapterIds.has(chapter.id);
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
                                    </div>
                                </label>
                            );
                        })
                    )}
                </div>

                {error && (
                    <div className="mx-5 mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <p className="text-sm text-red-400">{error}</p>
                    </div>
                )}

                {result && (
                    <div className="mx-5 mb-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <p className="text-sm text-green-400">
                            <span className="inline-flex items-center gap-1"><CheckIcon /> Updated {result.updated} of {result.total} title{result.total !== 1 ? 's' : ''}</span>
                        </p>
                    </div>
                )}

                <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-[var(--border-primary)] bg-[var(--bg-tertiary)]/50">
                    <div className="text-xs text-[var(--text-secondary)]">
                        {selectedChapterIds.size} chapter{selectedChapterIds.size !== 1 ? 's' : ''} selected
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleClose}
                            disabled={isTranslating}
                            className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        {isTranslating ? (
                            <button
                                onClick={handleStop}
                                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors"
                            >
                                <StopIcon />
                                Stop
                            </button>
                        ) : (
                            <button
                                onClick={handleTranslateTitles}
                                disabled={selectedChapterIds.size === 0 || !isConnected}
                                className="flex items-center gap-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-[var(--text-on-accent)] font-semibold px-5 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
                                title={!isConnected ? 'Please connect to the API first' : ''}
                            >
                                <PlayIcon />
                                Translate Titles
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BatchTranslateTitlesModal;
