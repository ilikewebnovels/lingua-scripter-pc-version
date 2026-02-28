import React from 'react';
import { TranslationMemoryEntry } from '../hooks/useTranslationMemory';

interface TranslationMemoryIndicatorProps {
  cachedTranslation: TranslationMemoryEntry | null;
  onUseCached: () => void;
  onDismiss: () => void;
}

const DatabaseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z" />
    <path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z" />
    <path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z" />
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
);

const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

const TranslationMemoryIndicator: React.FC<TranslationMemoryIndicatorProps> = ({
  cachedTranslation,
  onUseCached,
  onDismiss,
}) => {
  if (!cachedTranslation) return null;

  return (
    <div className="bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 rounded-md p-3 mb-3 animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="text-[var(--accent-primary)] flex-shrink-0 mt-0.5">
          <DatabaseIcon />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-[var(--accent-primary)]">
              Translation Memory Match
            </span>
            <span className="text-xs bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] px-2 py-0.5 rounded-full">
              Used {cachedTranslation.usedCount}x
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mb-2">
            A cached translation was found for this text. Would you like to use it?
          </p>
          <div className="bg-[var(--bg-secondary)] rounded p-2 text-sm text-[var(--text-primary)] max-h-20 overflow-y-auto">
            {cachedTranslation.translatedText.slice(0, 200)}
            {cachedTranslation.translatedText.length > 200 && '...'}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 mt-3">
        <button
          onClick={onDismiss}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded transition-colors"
        >
          <XIcon />
          Translate New
        </button>
        <button
          onClick={onUseCached}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-[var(--text-on-accent)] rounded transition-colors font-medium"
        >
          <CheckIcon />
          Use Cached
        </button>
      </div>
    </div>
  );
};

export default React.memo(TranslationMemoryIndicator);
