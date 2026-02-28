import React, { useState } from 'react';
import GlossaryAiModal from './GlossaryAiModal';

interface GlossaryQuickAddProps {
    selections: string[];
    onAddFromSelection: () => void; // Renamed from onAdd
    onClear: () => void;
    onRemove: (selection: string) => void;
    onEdit: (oldSelection: string, newSelection: string) => void;
    isLoading: boolean;
}

const GlossaryQuickAdd: React.FC<GlossaryQuickAddProps> = ({ selections, onAddFromSelection, onClear, onRemove, onEdit, isLoading }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleAdd = () => {
        onAddFromSelection();
        setIsModalOpen(false); // Close modal after adding
    };

    return (
        <>
            <button
                onClick={() => setIsModalOpen(true)}
                disabled={isLoading || selections.length === 0}
                className="bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-[var(--text-on-accent)] font-semibold px-3 py-1.5 rounded-md flex items-center gap-2 text-sm transition-colors disabled:bg-gray-600 disabled:cursor-wait"
            >
                Send {selections.length} term(s) to AI
            </button>
            <GlossaryAiModal
                isOpen={isModalOpen}
                selections={selections}
                onAdd={handleAdd} // Use the new handler
                onClear={onClear}
                onRemove={onRemove}
                onEdit={onEdit}
                onClose={() => setIsModalOpen(false)}
                isLoading={isLoading}
            />
        </>
    );
};

export default GlossaryQuickAdd;
