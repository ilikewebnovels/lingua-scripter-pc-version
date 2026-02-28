import React, { useMemo, useState } from 'react';
import {
  TokenizerModel,
  TOKENIZER_CONFIGS,
  computeTextMetrics,
  getTokensFromMetrics,
  getWordCount,
  getCharCount,
  formatNumber,
  formatDuration,
} from '../utils/tokenizer';

interface TextStatsProps {
  originalText: string;
  translatedText: string;
  translationTime: number | null; // in milliseconds
  selectedTokenizer: TokenizerModel;
  onTokenizerChange: (model: TokenizerModel) => void;
}

const ChevronDownIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

const ClockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
  </svg>
);

const TextStats: React.FC<TextStatsProps> = ({
  originalText,
  translatedText,
  translationTime,
  selectedTokenizer,
  onTokenizerChange,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Pre-compute text metrics (expensive - only when text changes)
  const textMetrics = useMemo(() => ({
    original: computeTextMetrics(originalText),
    translated: computeTextMetrics(translatedText),
    originalWords: getWordCount(originalText),
    translatedWords: getWordCount(translatedText),
    originalChars: getCharCount(originalText),
    translatedChars: getCharCount(translatedText),
  }), [originalText, translatedText]);

  // Calculate tokens from pre-computed metrics (cheap - just math)
  const stats = useMemo(() => ({
    original: {
      words: textMetrics.originalWords,
      chars: textMetrics.originalChars,
      tokens: getTokensFromMetrics(textMetrics.original, selectedTokenizer),
    },
    translated: {
      words: textMetrics.translatedWords,
      chars: textMetrics.translatedChars,
      tokens: getTokensFromMetrics(textMetrics.translated, selectedTokenizer),
    },
  }), [textMetrics, selectedTokenizer]);

  const totalTokens = stats.original.tokens + stats.translated.tokens;

  return (
    <div className="bg-[var(--bg-tertiary)] rounded-md border border-[var(--border-primary)] text-xs">
      {/* Compact View - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-[var(--bg-secondary)] transition-colors rounded-md"
      >
        <div className="flex items-center gap-4 text-[var(--text-secondary)]">
          <span>
            <span className="text-[var(--text-primary)] font-medium">{formatNumber(stats.original.words)}</span> words
          </span>
          <span>
            <span className="text-[var(--text-primary)] font-medium">~{formatNumber(totalTokens)}</span> tokens
          </span>
          {translationTime !== null && (
            <span className="flex items-center gap-1 text-[var(--accent-primary)]">
              <ClockIcon />
              {formatDuration(translationTime)}
            </span>
          )}
        </div>
        <div className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
          <ChevronDownIcon />
        </div>
      </button>

      {/* Expanded View */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-[var(--border-primary)]">
          {/* Tokenizer Selection */}
          <div className="pt-3">
            <label className="block text-[var(--text-secondary)] mb-1">Token Estimation Model</label>
            <select
              value={selectedTokenizer}
              onChange={(e) => onTokenizerChange(e.target.value as TokenizerModel)}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded px-2 py-1 text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] outline-none"
            >
              {Object.entries(TOKENIZER_CONFIGS).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.name}
                </option>
              ))}
            </select>
          </div>

          {/* Stats Table */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="text-[var(--text-secondary)]"></div>
            <div className="text-[var(--text-secondary)] font-medium">Words</div>
            <div className="text-[var(--text-secondary)] font-medium">Chars</div>
            <div className="text-[var(--text-secondary)] font-medium">Tokens</div>

            <div className="text-[var(--text-secondary)] text-left">Original</div>
            <div className="text-[var(--text-primary)]">{formatNumber(stats.original.words)}</div>
            <div className="text-[var(--text-primary)]">{formatNumber(stats.original.chars)}</div>
            <div className="text-[var(--text-primary)]">{formatNumber(stats.original.tokens)}</div>

            <div className="text-[var(--text-secondary)] text-left">Translated</div>
            <div className="text-[var(--text-primary)]">{formatNumber(stats.translated.words)}</div>
            <div className="text-[var(--text-primary)]">{formatNumber(stats.translated.chars)}</div>
            <div className="text-[var(--text-primary)]">{formatNumber(stats.translated.tokens)}</div>

            <div className="text-[var(--accent-primary)] text-left font-medium">Total</div>
            <div className="text-[var(--accent-primary)] font-medium">
              {formatNumber(stats.original.words + stats.translated.words)}
            </div>
            <div className="text-[var(--accent-primary)] font-medium">
              {formatNumber(stats.original.chars + stats.translated.chars)}
            </div>
            <div className="text-[var(--accent-primary)] font-medium">{formatNumber(totalTokens)}</div>
          </div>

          {/* Translation Time */}
          {translationTime !== null && (
            <div className="pt-2 border-t border-[var(--border-primary)]">
              <div className="flex items-center justify-between text-[var(--text-secondary)]">
                <span>Translation Time</span>
                <span className="text-[var(--accent-primary)] font-medium">{formatDuration(translationTime)}</span>
              </div>
              {stats.translated.tokens > 0 && (
                <div className="flex items-center justify-between text-[var(--text-secondary)] mt-1">
                  <span>Speed</span>
                  <span className="text-[var(--text-primary)]">
                    {((stats.translated.tokens / translationTime) * 1000).toFixed(1)} tokens/sec
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default React.memo(TextStats);
