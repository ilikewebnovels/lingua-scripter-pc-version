import { escapeRegex, shouldUseBoundariesForTarget } from './regexBoundary';

const buildReplaceRegex = (needle: string, targetLanguage: string): RegExp | null => {
    if (!needle) return null;
    const boundary = shouldUseBoundariesForTarget(targetLanguage) ? '\\b' : '';
    try {
        // Case-insensitive: AI output title-cases technique names ("Heaven Defying Art")
        // even when the glossary entry is lowercase. We restore the matched casing on replace.
        return new RegExp(`${boundary}${escapeRegex(needle)}${boundary}`, 'gi');
    } catch {
        return null;
    }
};

type CasingClass = 'lower' | 'upper' | 'title' | 'other';

const detectCasing = (s: string): CasingClass => {
    const letters = s.match(/[A-Za-z]+/g);
    if (!letters || letters.length === 0) return 'other';
    if (letters.every(w => w === w.toLowerCase())) return 'lower';
    if (letters.every(w => w === w.toUpperCase())) return 'upper';
    if (letters.every(w => /^[A-Z][a-z]*$/.test(w))) return 'title';
    return 'other';
};

const applyCasing = (s: string, casing: CasingClass): string => {
    switch (casing) {
        case 'lower': return s.toLowerCase();
        case 'upper': return s.toUpperCase();
        case 'title':
            return s.replace(/[A-Za-z]+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
        default: return s;
    }
};

export const countOccurrences = (
    haystack: string,
    needle: string,
    targetLanguage: string,
): number => {
    if (!haystack || !needle) return 0;
    const regex = buildReplaceRegex(needle, targetLanguage);
    if (!regex) return 0;
    return (haystack.match(regex) || []).length;
};

export const replaceAll = (
    haystack: string,
    oldStr: string,
    newStr: string,
    targetLanguage: string,
): string => {
    if (!haystack || !oldStr || oldStr === newStr) return haystack;
    const regex = buildReplaceRegex(oldStr, targetLanguage);
    if (!regex) return haystack;
    return haystack.replace(regex, (matched) => applyCasing(newStr, detectCasing(matched)));
};
