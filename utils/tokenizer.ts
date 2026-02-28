// Simple tokenizer utilities for estimating token counts
// These are approximations based on common tokenization patterns

export type TokenizerModel = 'gpt-4' | 'gpt-3.5' | 'claude' | 'gemini' | 'llama' | 'general';

interface TokenizerConfig {
  name: string;
  charsPerToken: number; // Average characters per token
  description: string;
}

export const TOKENIZER_CONFIGS: Record<TokenizerModel, TokenizerConfig> = {
  'gpt-4': {
    name: 'GPT-4 / GPT-4o',
    charsPerToken: 4,
    description: 'OpenAI GPT-4 family models'
  },
  'gpt-3.5': {
    name: 'GPT-3.5 Turbo',
    charsPerToken: 4,
    description: 'OpenAI GPT-3.5 models'
  },
  'claude': {
    name: 'Claude',
    charsPerToken: 3.5,
    description: 'Anthropic Claude models'
  },
  'gemini': {
    name: 'Gemini',
    charsPerToken: 4,
    description: 'Google Gemini models'
  },
  'llama': {
    name: 'Llama / Mistral',
    charsPerToken: 3.8,
    description: 'Meta Llama and Mistral models'
  },
  'general': {
    name: 'General (Average)',
    charsPerToken: 4,
    description: 'General approximation for most models'
  }
};

// Regex for CJK characters (Chinese, Japanese, Korean)
const CJK_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g;

/**
 * Pre-computed text metrics for fast tokenizer switching
 * Call this once when text changes, then use getTokensFromMetrics for instant recalculation
 */
export interface TextMetrics {
  nonCjkLength: number;
  cjkCount: number;
}

/**
 * Pre-compute text metrics (expensive - runs regex)
 * Cache this result and reuse when only tokenizer changes
 */
export function computeTextMetrics(text: string): TextMetrics {
  if (!text) return { nonCjkLength: 0, cjkCount: 0 };

  const cjkMatches = text.match(CJK_REGEX) || [];
  const cjkCount = cjkMatches.length;
  const nonCjkText = text.replace(CJK_REGEX, '');

  return {
    nonCjkLength: nonCjkText.length,
    cjkCount
  };
}

/**
 * Get token count from pre-computed metrics (cheap - just math)
 */
export function getTokensFromMetrics(metrics: TextMetrics, model: TokenizerModel = 'general'): number {
  const config = TOKENIZER_CONFIGS[model];
  const nonCjkTokens = Math.ceil(metrics.nonCjkLength / config.charsPerToken);
  const cjkTokens = Math.ceil(metrics.cjkCount * 1.5);
  return nonCjkTokens + cjkTokens;
}

/**
 * Estimate token count for a given text
 * This is an approximation - actual token counts vary by model
 * 
 * NOTE: For frequently changing tokenizer selection, use computeTextMetrics + getTokensFromMetrics
 */
export function estimateTokenCount(text: string, model: TokenizerModel = 'general'): number {
  if (!text) return 0;
  const metrics = computeTextMetrics(text);
  return getTokensFromMetrics(metrics, model);
}

/**
 * Get word count
 */
export function getWordCount(text: string): number {
  if (!text.trim()) return 0;

  // Split by whitespace and filter empty strings
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);

  // For CJK text, count characters as "words" since they don't use spaces
  const cjkMatches = text.match(CJK_REGEX) || [];

  // If mostly CJK, return character count
  if (cjkMatches.length > words.length) {
    return cjkMatches.length;
  }

  return words.length;
}

/**
 * Get character count (excluding whitespace)
 */
export function getCharCount(text: string): number {
  if (!text) return 0;
  return text.replace(/\s/g, '').length;
}

/**
 * Get character count (including whitespace)
 */
export function getCharCountWithSpaces(text: string): number {
  if (!text) return 0;
  return text.length;
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Format number with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}
