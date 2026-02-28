import React, { useState, useEffect, useRef } from 'react';
import { GlossaryEntry, Character } from '../types';
import { InfoIcon } from './icons';

interface ActiveContextInfoProps {
    activeGlossary: GlossaryEntry[];
    activeCharacters: Character[];
}

/**
 * Displays a popup showing which glossary terms and characters are
 * detected in the current text and will be sent to the AI
 */
const ActiveContextInfo: React.FC<ActiveContextInfoProps> = ({ activeGlossary, activeCharacters }) => {
    const [isOpen, setIsOpen] = useState(false);
    const hasContent = activeGlossary.length > 0 || activeCharacters.length > 0;
    const popupRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [position, setPosition] = useState('bottom');

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && buttonRef.current) {
            const buttonRect = buttonRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - buttonRect.bottom;
            if (spaceBelow < 250) {
                setPosition('top');
            } else {
                setPosition('bottom');
            }
        }
    }, [isOpen]);


    return (
        <div className="relative">
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(o => !o)}
                className="p-1 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50"
                disabled={!hasContent}
                aria-label="Active AI Context"
            >
                <InfoIcon />
            </button>
            {isOpen && hasContent && (
                <div
                    ref={popupRef}
                    className={`absolute right-0 w-80 bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-xs rounded-md p-3 shadow-lg border border-[var(--border-primary)] z-20 max-h-[250px] flex flex-col animate-fade-in
                        ${position === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2'}
                    `}
                >
                    <div className='flex justify-between items-center mb-2'>
                        <h4 className="font-bold text-sm text-[var(--accent-primary)]">AI Context Preview</h4>
                        <button onClick={() => setIsOpen(false)} className='p-1 rounded-full hover:bg-[var(--bg-secondary)]'>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mb-3">The following entries are detected in your text and will be sent to the AI.</p>
                    <div className='overflow-y-auto'>
                        {activeGlossary.length > 0 && (
                            <div className="mb-2">
                                <h5 className="font-semibold mb-1">Glossary Terms ({activeGlossary.length})</h5>
                                <ul className="space-y-2">
                                    {activeGlossary.map(term =>
                                        <li key={term.original} className="truncate p-1 rounded-md bg-[var(--bg-secondary)]"><strong>{term.original}</strong> → {term.translation}</li>
                                    )}
                                </ul>
                            </div>
                        )}
                        {activeCharacters.length > 0 && (
                            <div>
                                <h5 className="font-semibold mb-1">Characters ({activeCharacters.length})</h5>
                                <ul className="space-y-2">
                                    {activeCharacters.map(char =>
                                        <li key={char.id} className="truncate p-1 rounded-md bg-[var(--bg-secondary)]"><strong>{char.name}</strong> → {char.translatedName}</li>
                                    )}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default React.memo(ActiveContextInfo);
