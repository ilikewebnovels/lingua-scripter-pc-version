// Languages where word boundaries (\b) don't make sense because text is not space-separated.
const NO_BOUNDARY_LANGUAGES = new Set(['Japanese', 'Chinese (Simplified)', 'Korean']);

const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/g;

export const escapeRegex = (s: string): string => s.replace(REGEX_SPECIAL, '\\$&');

// True when the language is space-separated (boundaries safe).
// Auto-detect is treated as "unknown" → no boundaries (to avoid false negatives on CJK source text).
export const shouldUseBoundaries = (sourceLanguage: string): boolean => {
    if (!sourceLanguage || sourceLanguage === 'Auto-detect') return false;
    return !NO_BOUNDARY_LANGUAGES.has(sourceLanguage);
};

// Variant for known target languages (no Auto-detect handling).
export const shouldUseBoundariesForTarget = (language: string): boolean => {
    return !NO_BOUNDARY_LANGUAGES.has(language);
};

// Build a single-needle regex with optional boundaries based on language.
export const buildBoundaryRegex = (
    needle: string,
    sourceLanguage: string,
    flags: string = 'i',
): RegExp | null => {
    if (!needle) return null;
    const boundary = shouldUseBoundaries(sourceLanguage) ? '\\b' : '';
    try {
        return new RegExp(`${boundary}${escapeRegex(needle)}${boundary}`, flags);
    } catch {
        return null;
    }
};
