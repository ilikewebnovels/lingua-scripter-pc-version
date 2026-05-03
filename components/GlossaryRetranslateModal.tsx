import React, { useMemo, useState } from 'react';
import { Chapter } from '../types';
import { countOccurrences } from '../utils/glossaryReplace';

interface GlossaryRetranslateModalProps {
    isOpen: boolean;
    oldTranslation: string;
    newTranslation: string;
    chapters: Chapter[];
    targetLanguage: string;
    onConfirm: (chapterIds: string[]) => Promise<void> | void;
    onClose: () => void;
}

const GlossaryRetranslateModal: React.FC<GlossaryRetranslateModalProps> = ({
    isOpen,
    oldTranslation,
    newTranslation,
    chapters,
    targetLanguage,
    onConfirm,
    onClose,
}) => {
    const [isApplying, setIsApplying] = useState(false);

    const matches = useMemo(() => {
        if (!isOpen) return [];
        return chapters
            .map(ch => ({
                id: ch.id,
                title: ch.title,
                chapterNumber: ch.chapterNumber,
                count: countOccurrences(ch.translatedText || '', oldTranslation, targetLanguage),
            }))
            .filter(m => m.count > 0)
            .sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));
    }, [chapters, oldTranslation, targetLanguage, isOpen]);

    const totalCount = useMemo(() => matches.reduce((sum, m) => sum + m.count, 0), [matches]);

    if (!isOpen) return null;

    const handleConfirm = async () => {
        setIsApplying(true);
        try {
            await onConfirm(matches.map(m => m.id));
        } finally {
            setIsApplying(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] animate-fade-in">
            <div className="bg-[var(--bg-secondary)] rounded-md p-4 shadow-lg w-full max-w-xl">
                <h3 className="text-lg font-bold text-[var(--accent-primary)] mb-2">Update existing translations?</h3>
                <p className="text-sm text-[var(--text-secondary)] mb-3">
                    Replace <span className="font-semibold text-[var(--text-primary)]">{oldTranslation}</span>
                    <span className="mx-2">→</span>
                    <span className="font-semibold text-[var(--accent-primary)]">{newTranslation}</span>
                    {' '}across all chapters in this project.
                </p>

                {totalCount === 0 ? (
                    <div className="bg-[var(--bg-tertiary)] rounded-md p-3 text-sm text-[var(--text-secondary)] text-center">
                        No occurrences of <span className="font-semibold text-[var(--text-primary)]">{oldTranslation}</span> found in any chapter's translation.
                    </div>
                ) : (
                    <>
                        <div className="text-sm text-[var(--text-primary)] mb-2">
                            Found <span className="font-semibold">{totalCount}</span> occurrence{totalCount === 1 ? '' : 's'} across <span className="font-semibold">{matches.length}</span> chapter{matches.length === 1 ? '' : 's'}:
                        </div>
                        <ul className="max-h-64 overflow-y-auto custom-scrollbar bg-[var(--bg-tertiary)] rounded-md p-2 text-sm space-y-1">
                            {matches.map(m => (
                                <li key={m.id} className="flex justify-between text-[var(--text-primary)]">
                                    <span className="truncate mr-2">
                                        {m.chapterNumber ? `Ch. ${m.chapterNumber}` : ''} {m.title}
                                    </span>
                                    <span className="text-[var(--text-secondary)] flex-shrink-0">{m.count}×</span>
                                </li>
                            ))}
                        </ul>
                    </>
                )}

                <div className="flex justify-end gap-2 mt-4">
                    <button
                        onClick={onClose}
                        disabled={isApplying}
                        className="bg-[var(--bg-tertiary)] hover:brightness-125 text-[var(--text-primary)] font-semibold px-3 py-1.5 rounded-md text-sm disabled:opacity-50"
                    >
                        {totalCount === 0 ? 'Close' : 'Cancel'}
                    </button>
                    {totalCount > 0 && (
                        <button
                            onClick={handleConfirm}
                            disabled={isApplying}
                            className="bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-[var(--text-on-accent)] font-semibold px-3 py-1.5 rounded-md text-sm disabled:opacity-50"
                        >
                            {isApplying ? 'Applying...' : `Replace in ${matches.length} chapter${matches.length === 1 ? '' : 's'}`}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GlossaryRetranslateModal;
