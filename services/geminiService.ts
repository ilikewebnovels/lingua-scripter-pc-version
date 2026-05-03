import { GlossaryEntry, Settings, Character } from '../types';

const API_URL = '/api';

export const testConnection = async (settings: Settings): Promise<{ success: boolean; message: string }> => {
    try {
        const response = await fetch(`${API_URL}/test-connection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings),
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Connection failed.');
        }
        return data;
    } catch (error) {
        console.error("Connection test failed:", error);
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message: `Connection failed: ${message}` };
    }
};

export const translateText = async (
    text: string,
    glossary: GlossaryEntry[],
    mentionedCharacters: Character[],
    settings: Settings,
    signal?: AbortSignal
): Promise<{ translation: string, newCharacters: Omit<Character, 'id'>[] } | { error: string }> => {
    if (!text.trim()) return { translation: "", newCharacters: [] };
    try {
        const response = await fetch(`${API_URL}/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, glossary, mentionedCharacters, ...settings }),
            signal,
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Translation failed.');
        }
        return data;
    } catch (error) {
        console.error("Error during translation:", error);
        if (error instanceof Error) return { error: `Error: Failed to translate. ${error.message}` };
        return { error: "Error: An unknown error occurred during translation." };
    }
};

export async function* translateTextStream(
    text: string,
    glossary: GlossaryEntry[],
    mentionedCharacters: Character[],
    settings: Settings,
    signal?: AbortSignal
): AsyncGenerator<string> {
    if (!text.trim()) return;
    try {
        const response = await fetch(`${API_URL}/translate-stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, glossary, mentionedCharacters, ...settings }),
            signal,
        });

        if (!response.body) {
            throw new Error("Response body is null.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                // Flush any remaining bytes in the decoder
                const remaining = decoder.decode();
                if (remaining) yield remaining;
                break;
            }
            // Use {stream: true} to handle multi-byte UTF-8 characters split across chunks
            yield decoder.decode(value, { stream: true });
        }

    } catch (error) {
        console.error("Error during streaming translation:", error);
        if (error instanceof Error) yield `Error: Failed to translate. ${error.message}`;
        else yield "Error: An unknown error occurred during translation.";
    }
}

export const getPromptPreview = async (
    systemInstruction: string
): Promise<{ systemInstruction: string; userPrompt: string } | { error: string }> => {
    try {
        const response = await fetch(`${API_URL}/prompt-preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ systemInstruction }),
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch prompt preview');
        }
        return data;
    } catch (error) {
        console.error("Error fetching prompt preview:", error);
        if (error instanceof Error) return { error: `Preview failed: ${error.message}` };
        return { error: "An unknown error occurred while fetching the prompt preview." };
    }
};

export const findOriginalPhrases = async (
    originalText: string,
    translatedText: string,
    selectedTranslations: string[],
    settings: Settings
): Promise<{ entries: GlossaryEntry[] } | { error: string }> => {
    if (selectedTranslations.length === 0) {
        return { entries: [] };
    }
    try {
        const response = await fetch(`${API_URL}/find-phrases`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ originalText, translatedText, selectedTranslations, ...settings }),
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'AI lookup failed');
        }
        if (data.entries && Array.isArray(data.entries)) {
            return { entries: data.entries };
        }
        return { error: 'Invalid response format from server.' };
    } catch (error) {
        console.error("Error during phrase finding:", error);
        if (error instanceof Error) return { error: `AI lookup failed: ${error.message}` };
        return { error: "An unknown error occurred during AI lookup." };
    }
};


export const analyzeForCharacters = async (
    originalText: string,
    settings: Settings
): Promise<{ characters: Omit<Character, 'id'>[] } | { error: string }> => {
    if (!originalText.trim()) {
        return { characters: [] };
    }
    try {
        const response = await fetch(`${API_URL}/analyze-characters`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ originalText, ...settings }),
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'AI character analysis failed');
        }
        if (data.characters && Array.isArray(data.characters)) {
            return { characters: data.characters };
        }
        return { error: 'Invalid response format from server for character analysis.' };
    } catch (error) {
        console.error("Error during character analysis:", error);
        if (error instanceof Error) return { error: `Character analysis failed: ${error.message}` };
        return { error: "An unknown error occurred during character analysis." };
    }
};

// Batch translation - translates multiple chapters in a single API call
export const translateBatch = async (
    chapters: { id: string; title: string; originalText: string }[],
    glossary: GlossaryEntry[],
    mentionedCharacters: Character[],
    settings: Settings,
    signal?: AbortSignal
): Promise<{
    translations: { chapterId: string; translatedText: string }[];
    characters: Omit<Character, 'id'>[];
} | { error: string }> => {
    if (chapters.length === 0) {
        return { translations: [], characters: [] };
    }
    try {
        const response = await fetch(`${API_URL}/translate-batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chapters, glossary, mentionedCharacters, ...settings }),
            signal,
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Batch translation failed.');
        }
        return data;
    } catch (error) {
        console.error("Error during batch translation:", error);
        if (error instanceof Error) return { error: `Batch translation failed: ${error.message}` };
        return { error: "An unknown error occurred during batch translation." };
    }
};

// Streaming batch translation - translates multiple chapters with streaming to prevent timeouts
export interface BatchStreamProgress {
    type: 'chunk' | 'chapter_complete' | 'done' | 'error';
    chapterIndex?: number;  // 1-based index
    chapterId?: string;
    text?: string;          // For 'chunk' type - the streamed text
    fullText?: string;      // For 'chapter_complete' - full chapter translation
    error?: string;
}

export async function* translateBatchStream(
    chapters: { id: string; title: string; originalText: string }[],
    glossary: GlossaryEntry[],
    mentionedCharacters: Character[],
    settings: Settings,
    signal?: AbortSignal
): AsyncGenerator<BatchStreamProgress> {
    if (chapters.length === 0) return;

    try {
        const response = await fetch(`${API_URL}/translate-batch-stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chapters, glossary, mentionedCharacters, ...settings }),
            signal,
        });

        if (!response.body) {
            throw new Error("Response body is null.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let fullText = '';
        let currentChapterIndex = 0;
        let chapterTexts: string[] = new Array(chapters.length).fill('');

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                // Flush any remaining bytes in the decoder
                const remaining = decoder.decode();
                if (remaining) {
                    fullText += remaining;
                    yield { type: 'chunk', text: remaining, chapterIndex: currentChapterIndex };
                }
                break;
            }

            // Use {stream: true} to handle multi-byte UTF-8 characters split across chunks
            const chunk = decoder.decode(value, { stream: true });
            fullText += chunk;

            // Check for error
            if (chunk.includes('[ERROR]')) {
                const errorMatch = fullText.match(/\[ERROR\](.*)/);
                yield { type: 'error', error: errorMatch ? errorMatch[1] : 'Unknown error' };
                return;
            }

            // Parse chapter markers to track progress
            // Check which chapter we're currently in based on markers
            for (let i = 0; i < chapters.length; i++) {
                const startMarker = `[CHAPTER_${i + 1}_START]`;
                const endMarker = `[CHAPTER_${i + 1}_END]`;

                const startIdx = fullText.indexOf(startMarker);
                const endIdx = fullText.indexOf(endMarker);

                if (startIdx !== -1) {
                    if (endIdx !== -1 && endIdx > startIdx) {
                        // Chapter complete
                        const chapterContent = fullText
                            .substring(startIdx + startMarker.length, endIdx)
                            .trim();

                        if (chapterTexts[i] !== chapterContent) {
                            chapterTexts[i] = chapterContent;
                            yield {
                                type: 'chapter_complete',
                                chapterIndex: i + 1,
                                chapterId: chapters[i].id,
                                fullText: chapterContent
                            };
                        }
                    } else if (currentChapterIndex !== i + 1) {
                        // Chapter started but not complete
                        currentChapterIndex = i + 1;
                    }
                }
            }

            // Yield the raw chunk for live display
            yield { type: 'chunk', text: chunk, chapterIndex: currentChapterIndex };
        }

        // Final parse to ensure all chapters are extracted
        for (let i = 0; i < chapters.length; i++) {
            const startMarker = `[CHAPTER_${i + 1}_START]`;
            const endMarker = `[CHAPTER_${i + 1}_END]`;

            const startIdx = fullText.indexOf(startMarker);
            const endIdx = fullText.indexOf(endMarker);

            if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
                const chapterContent = fullText
                    .substring(startIdx + startMarker.length, endIdx)
                    .trim();

                if (!chapterTexts[i]) {
                    chapterTexts[i] = chapterContent;
                    yield {
                        type: 'chapter_complete',
                        chapterIndex: i + 1,
                        chapterId: chapters[i].id,
                        fullText: chapterContent
                    };
                }
            }
        }

        yield { type: 'done' };

    } catch (error) {
        console.error("Error during streaming batch translation:", error);
        yield {
            type: 'error',
            error: error instanceof Error ? error.message : "An unknown error occurred"
        };
    }
}

export const getOpenAIModels = async (
    endpoint: string,
    apiKey: string
): Promise<{ models: { id: string }[] } | { error: string }> => {
    try {
        const response = await fetch(`${API_URL}/openai-models`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint, apiKey }),
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch models');
        }
        if (data.models && Array.isArray(data.models)) {
            return { models: data.models };
        }
        return { error: 'Invalid response format from server.' };
    } catch (error) {
        console.error("Error fetching OpenAI models:", error);
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        return { error: `Failed to fetch models: ${message}` };
    }
};

export const getModels = async (
    provider: 'gemini' | 'deepseek' | 'openrouter',
    settings: Settings
): Promise<{ models: { id: string }[] } | { error: string }> => {
    try {
        const response = await fetch(`${API_URL}/models`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...settings, provider }),
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch models');
        }
        if (data.models && Array.isArray(data.models)) {
            return { models: data.models };
        }
        return { error: 'Invalid response format from server.' };
    } catch (error) {
        console.error(`Error fetching ${provider} models:`, error);
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        return { error: `Failed to fetch models: ${message}` };
    }
};