import React from 'react';

interface BatchTranslationIndicatorProps {
    current: number;
    total: number;
    onClick: () => void;
}

const LoadingSpinner = () => (
    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
);

const BatchTranslationIndicator: React.FC<BatchTranslationIndicatorProps> = ({
    current,
    total,
    onClick
}) => {
    if (total === 0) return null;

    const progressPercent = total > 0 ? Math.round((current / total) * 100) : 0;

    return (
        <button
            onClick={onClick}
            className="mx-4 mt-2 flex items-center gap-3 px-4 py-2 bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 rounded-lg hover:bg-[var(--accent-primary)]/20 transition-colors cursor-pointer"
            title="Click to open batch translation modal"
        >
            <LoadingSpinner />
            <div className="flex-1 flex items-center gap-3">
                <span className="text-sm font-medium text-[var(--text-primary)]">
                    Translating {current} of {total} chapters...
                </span>
                {/* Progress bar */}
                <div className="flex-1 max-w-[200px] h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                    <div
                        className="h-full bg-[var(--accent-primary)] transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
                <span className="text-xs text-[var(--text-secondary)]">{progressPercent}%</span>
            </div>
            <span className="text-xs text-[var(--accent-primary)] hover:underline">
                View Details
            </span>
        </button>
    );
};

export default BatchTranslationIndicator;
