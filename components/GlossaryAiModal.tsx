
import React, { useState, useEffect, useRef } from 'react';

interface GlossaryAiModalProps {
    isOpen: boolean;
    selections: string[];
    onAdd: () => void;
    onClear: () => void;
    onRemove: (selection: string) => void;
    onEdit: (oldSelection: string, newSelection: string) => void;
    onClose: () => void;
    isLoading: boolean;
}

const PlusCircleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
    </svg>
);

const LoadingSpinner = () => <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[var(--text-on-accent)]"></div>;

const GlossaryAiModal: React.FC<GlossaryAiModalProps> = ({ isOpen, selections, onAdd, onClear, onRemove, onEdit, onClose, isLoading }) => {
    const [editedSelections, setEditedSelections] = useState<string[]>([]);

    useEffect(() => {
        setEditedSelections(selections);
    }, [selections]);

    const handleSave = (index: number, newSelection: string) => {
        const oldSelection = selections[index];
        onEdit(oldSelection, newSelection);
    };

    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-[var(--bg-secondary)] rounded-md p-4 shadow-lg w-full max-w-2xl">
                <h3 className="text-lg font-bold text-[var(--accent-primary)] mb-4">Selected Terms for AI Glossary</h3>
                <div className="max-h-96 overflow-y-auto custom-scrollbar">
                    {editedSelections.map((selection, index) => (
                        <div key={index} className="flex items-center gap-2 mb-2">
                            <textarea
                                className="font-mono text-[var(--text-primary)] bg-[var(--bg-tertiary)] p-2 rounded-md w-full"
                                value={selection}
                                onChange={(e) => {
                                    const newEditedSelections = [...editedSelections];
                                    newEditedSelections[index] = e.target.value;
                                    setEditedSelections(newEditedSelections);
                                }}
                                onBlur={(e) => handleSave(index, e.target.value)}
                            />
                            <button
                                onClick={() => onRemove(selection)}
                                className="bg-[var(--danger-primary)] hover:brightness-125 text-white font-semibold px-3 py-1.5 rounded-md text-sm"
                            >
                                Remove
                            </button>
                        </div>
                    ))}
                </div>
                <div className="flex justify-end gap-2 mt-4">
                    <button
                        onClick={onAdd}
                        disabled={isLoading || selections.length === 0}
                        className="bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-[var(--text-on-accent)] font-semibold px-3 py-1.5 rounded-md flex items-center gap-2 text-sm transition-colors disabled:bg-gray-600 disabled:cursor-wait"
                    >
                        {isLoading ? <LoadingSpinner /> : <PlusCircleIcon />}
                        Add to Glossary
                    </button>
                    <button
                        onClick={onClear}
                        disabled={isLoading}
                        className="bg-[var(--bg-tertiary)] hover:brightness-125 text-[var(--text-primary)] font-semibold px-3 py-1.5 rounded-md text-sm transition-colors disabled:opacity-50"
                    >
                        Clear
                    </button>
                    <button
                        onClick={onClose}
                        className="bg-[var(--bg-tertiary)] hover:brightness-125 text-[var(--text-primary)] font-semibold px-3 py-1.5 rounded-md text-sm"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GlossaryAiModal;
