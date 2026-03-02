/**
 * AI API Routes
 * Handles translation, streaming, model listing, connection testing, phrase finding, and character analysis
 */
import express from 'express';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold, Type } from '@google/genai';
import { logApiCall } from './utils.js';

const router = express.Router();

// API Endpoints
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Build safety settings for Gemini
const buildSafetySettings = () => [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DEROGATORY, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_TOXICITY, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_VIOLENCE, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUAL, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_MEDICAL, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// Build prompt for translation
const buildPrompt = (text, glossary, mentionedCharacters) => {
    const glossaryPromptPart = glossary.length > 0
        ? `Glossary (Strictly follow these):\n${glossary.map(entry => `- "${entry.original}": "${entry.translation}"`).join('\n')}`
        : 'Glossary: None provided.';

    const characterPromptPart = (mentionedCharacters && mentionedCharacters.length > 0)
        ? `\n\nCharacter Information (For context and consistency):\n${mentionedCharacters.map(char => `- "${char.name}" (Translated Name: "${char.translatedName}"): Gender is ${char.gender || 'not specified'}, Pronouns are ${char.pronouns || 'not specified'}.`).join('\n')}`
        : '';

    const userPrompt = `${glossaryPromptPart}${characterPromptPart}\n\n---\n\nText to translate:\n${text}`;
    return { userPrompt };
};

// Extract text content from OpenAI-compatible response shapes.
// Some providers expose `choices[0].message.content` (chat),
// others return `output_text` / `output` (responses),
// and some Gemini-compatible endpoints return `candidates`.
const extractResponseText = (data) => {
    const readContent = (content) => {
        if (typeof content === 'string') return content;
        if (!Array.isArray(content)) return '';
        return content.map((part) => {
            if (typeof part === 'string') return part;
            if (part && typeof part.text === 'string') return part.text;
            if (part && typeof part.output_text === 'string') return part.output_text;
            if (part && typeof part.content === 'string') return part.content;
            return '';
        }).join('');
    };

    const chatContent = readContent(data?.choices?.[0]?.message?.content);
    if (chatContent) return chatContent;

    const chatText = typeof data?.choices?.[0]?.text === 'string' ? data.choices[0].text : '';
    if (chatText) return chatText;

    const outputText = typeof data?.output_text === 'string' ? data.output_text : '';
    if (outputText) return outputText;

    if (Array.isArray(data?.output)) {
        const outputJoined = data.output.map((item) => {
            if (typeof item?.text === 'string') return item.text;
            return readContent(item?.content);
        }).join('');
        if (outputJoined) return outputJoined;
    }

    if (Array.isArray(data?.candidates)) {
        const candidateJoined = data.candidates.map((candidate) =>
            Array.isArray(candidate?.content?.parts)
                ? candidate.content.parts.map((part) => (typeof part?.text === 'string' ? part.text : '')).join('')
                : ''
        ).join('');
        if (candidateJoined) return candidateJoined;
    }

    return '';
};

const extractJsonObjectString = (text) => {
    if (typeof text !== 'string') return null;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch && jsonMatch[0] ? jsonMatch[0] : null;
};

const normalizeRetryCount = (value) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return 0;
    return Math.max(0, Math.min(10, parsed));
};

const shouldRetryStatus = (status) =>
    status === 408 || status === 425 || status === 429 || status >= 500;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const fetchWithRetry = async (url, options, retryCount, contextLabel) => {
    const totalAttempts = retryCount + 1;

    for (let attempt = 0; attempt < totalAttempts; attempt++) {
        try {
            const response = await fetch(url, options);
            const isLastAttempt = attempt === totalAttempts - 1;

            if (!response.ok && shouldRetryStatus(response.status) && !isLastAttempt) {
                const waitMs = Math.min(3000, 500 * (2 ** attempt));
                console.warn(`[Retry] ${contextLabel} failed with status ${response.status}. Retrying (${attempt + 2}/${totalAttempts}) in ${waitMs}ms...`);
                await sleep(waitMs);
                continue;
            }

            return response;
        } catch (error) {
            const isLastAttempt = attempt === totalAttempts - 1;
            if (isLastAttempt) throw error;
            const waitMs = Math.min(3000, 500 * (2 ** attempt));
            const message = error instanceof Error ? error.message : String(error);
            console.warn(`[Retry] ${contextLabel} request error: ${message}. Retrying (${attempt + 2}/${totalAttempts}) in ${waitMs}ms...`);
            await sleep(waitMs);
        }
    }

    throw new Error(`${contextLabel} failed after ${totalAttempts} attempts.`);
};

// Get OpenAI-compatible models
router.post('/openai-models', async (req, res) => {
    const { endpoint, apiKey } = req.body;
    if (!endpoint || !apiKey) {
        return res.status(400).json({ error: 'Endpoint and API Key are required.' });
    }
    try {
        const url = `${endpoint.replace(/\/$/, '')}/v1/models`;
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error?.message || `Failed to fetch models from ${url}`);
        }
        res.json({ models: data.data || [] });
    } catch (error) {
        console.error("Failed to fetch OpenAI models:", error);
        res.status(500).json({ error: error.message || 'An unknown error occurred' });
    }
});

// Get models by provider
router.post('/models', async (req, res) => {
    const { provider, apiKey, deepseekApiKey, openRouterApiKey } = req.body;

    try {
        if (provider === 'gemini') {
            if (!apiKey) return res.status(400).json({ error: "Gemini API Key is missing." });
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
                const data = await response.json();

                if (!response.ok) {
                    console.error("Failed to fetch Gemini models from API:", data.error?.message || "Unknown error");
                    const models = [
                        { id: 'gemini-1.5-flash' }, { id: 'gemini-1.5-pro' },
                        { id: 'gemini-2.0-flash' }, { id: 'gemini-2.5-flash' }, { id: 'gemini-2.5-pro' }
                    ];
                    return res.json({ models });
                }

                const models = (data.models || [])
                    .filter(model => model.supportedGenerationMethods?.includes('generateContent'))
                    .map(model => ({ id: model.name.replace('models/', '') }));
                res.json({ models });
            } catch (error) {
                console.error("Error fetching Gemini models:", error);
                const models = [
                    { id: 'gemini-1.5-flash' }, { id: 'gemini-1.5-pro' },
                    { id: 'gemini-2.0-flash' }, { id: 'gemini-2.5-flash' }, { id: 'gemini-2.5-pro' }
                ];
                res.json({ models });
            }
        } else if (provider === 'deepseek') {
            if (!deepseekApiKey) return res.status(400).json({ error: "DeepSeek API Key is missing." });
            const response = await fetch('https://api.deepseek.com/v1/models', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${deepseekApiKey}` }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message || 'Failed to fetch models from DeepSeek');
            const models = (data.data || []).map(model => ({ id: model.id }));
            res.json({ models });
        } else if (provider === 'openrouter') {
            if (!openRouterApiKey) return res.status(400).json({ error: "OpenRouter API Key is missing." });
            const response = await fetch('https://openrouter.ai/api/v1/models', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${openRouterApiKey}`,
                    'HTTP-Referer': 'https://github.com/subscribe-to-my-channel-on-youtube/lingua-scripter',
                    'X-Title': 'Lingua Scripter by Subscribe'
                }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message || 'Failed to fetch models from OpenRouter');
            const models = (data.data || []).map(model => ({ id: model.id }));
            res.json({ models });
        } else {
            res.status(400).json({ error: 'Invalid provider.' });
        }
    } catch (error) {
        console.error(`Failed to fetch ${provider} models:`, error);
        res.status(500).json({ error: error.message || 'An unknown error occurred' });
    }
});

// Test connection
router.post('/test-connection', async (req, res) => {
    const { model, provider, apiKey, deepseekApiKey, openRouterApiKey, openaiApiKey, openaiEndpoint, requestRetryCount } = req.body;
    const retryCount = normalizeRetryCount(requestRetryCount);
    const startTime = performance.now();
    try {
        if (provider === 'deepseek') {
            if (!deepseekApiKey) return res.status(400).json({ success: false, message: "DeepSeek API Key is missing." });
            const requestPayload = { model, messages: [{ role: 'user', content: 'Hello' }], max_tokens: 5 };
            const response = await fetchWithRetry(DEEPSEEK_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${deepseekApiKey}` },
                body: JSON.stringify(requestPayload)
            }, retryCount, 'DeepSeek test connection');
            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message || 'Connection failed.');
            logApiCall({ provider: 'DeepSeek', endpoint: '/test-connection', requestPayload, response: data, fullResponseText: extractResponseText(data), startTime, endTime: performance.now() });
            res.json({ success: true, message: "Connection successful." });
        } else if (provider === 'openrouter') {
            if (!openRouterApiKey) return res.status(400).json({ success: false, message: "OpenRouter API Key is missing." });
            const requestPayload = { model, messages: [{ role: 'user', content: 'Hello' }], max_tokens: 5 };
            const response = await fetchWithRetry(OPENROUTER_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${openRouterApiKey}`,
                    'HTTP-Referer': 'https://github.com/subscribe-to-my-channel-on-youtube/lingua-scripter',
                    'X-Title': 'Lingua Scripter by Subscribe'
                },
                body: JSON.stringify(requestPayload)
            }, retryCount, 'OpenRouter test connection');
            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message || 'Connection failed.');
            logApiCall({ provider: 'OpenRouter', endpoint: '/test-connection', requestPayload, response: data, fullResponseText: extractResponseText(data), startTime, endTime: performance.now() });
            res.json({ success: true, message: "Connection successful." });
        } else if (provider === 'openai') {
            if (!openaiApiKey) return res.status(400).json({ success: false, message: "OpenAI API Key is missing." });
            if (!openaiEndpoint) return res.status(400).json({ success: false, message: "OpenAI Endpoint URL is missing." });
            const requestPayload = { model, messages: [{ role: 'user', content: 'Hello' }], max_tokens: 5 };
            const apiUrl = `${openaiEndpoint.replace(/\/$/, '')}/v1/chat/completions`;
            const response = await fetchWithRetry(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiApiKey}` },
                body: JSON.stringify(requestPayload)
            }, retryCount, 'OpenAI test connection');
            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message || 'Connection failed.');
            logApiCall({ provider: 'OpenAI', endpoint: '/test-connection', requestPayload, response: data, fullResponseText: extractResponseText(data), startTime, endTime: performance.now() });
            res.json({ success: true, message: "Connection successful." });
        } else { // Gemini
            if (!apiKey) return res.status(400).json({ success: false, message: "Gemini API Key is missing." });
            const ai = new GoogleGenAI({ apiKey: apiKey });
            const requestPayload = { model, contents: "Hello" };
            const response = await ai.models.generateContent(requestPayload);
            logApiCall({ provider: 'Gemini', endpoint: '/test-connection', requestPayload, response, fullResponseText: response.text, startTime, endTime: performance.now() });
            if (response && typeof response.text === 'string') {
                res.json({ success: true, message: "Connection successful." });
            } else {
                throw new Error("Received an invalid response from the model.");
            }
        }
    } catch (error) {
        console.error("Connection test failed:", error);
        res.status(500).json({ success: false, message: error.message || "An unknown error occurred." });
    }
});

// Prompt preview
router.post('/prompt-preview', (req, res) => {
    const { systemInstruction } = req.body;
    const exampleText = "[Your chapter text will appear here]";
    const exampleGlossary = [
        { original: "Example Term 1", translation: "Example Translation 1" },
        { original: "Example Term 2", translation: "Example Translation 2" }
    ];
    const exampleCharacters = [
        { name: "Protagonist Name", translatedName: "Translated Protagonist Name", gender: "Male", pronouns: "he/him" }
    ];
    const { userPrompt } = buildPrompt(exampleText, exampleGlossary, exampleCharacters);
    res.json({ systemInstruction: systemInstruction || '', userPrompt });
});

// Translation (non-streaming)
router.post('/translate', async (req, res) => {
    const { text, glossary, model, systemInstruction, temperature, provider, apiKey, deepseekApiKey, openRouterApiKey, openaiApiKey, openaiEndpoint, openRouterModelProviders, projectId, mentionedCharacters, targetLanguage, requestRetryCount } = req.body;
    const retryCount = normalizeRetryCount(requestRetryCount);

    let finalSystemInstruction = systemInstruction.replace(/\{\{targetLanguage\}\}/g, targetLanguage || 'English');
    if (!systemInstruction.includes('{{targetLanguage}}')) {
        finalSystemInstruction = finalSystemInstruction.replace(/into fluent, natural English/g, `into fluent, natural ${targetLanguage || 'English'}`);
    }

    const newSystemInstruction = `${finalSystemInstruction}\n\nIn addition to the translation, identify all characters in the text. For each character found, provide their original name from the source text and their name translated into ${targetLanguage || 'English'}. Your response MUST be a single valid JSON object with two keys: "translation" (a string containing the full translated text) and "characters" (an array of objects, where each object has "name", "translatedName", "gender", and "pronouns"). If no characters are found, provide an empty array for the "characters" key. The 'name' field must be the original, raw name.`;
    const { userPrompt } = buildPrompt(text, glossary, mentionedCharacters);
    const startTime = performance.now();

    try {
        let translation = "";
        let newCharacters = [];

        if (provider === 'deepseek' || provider === 'openrouter' || provider === 'openai') {
            let currentApiKey, apiUrl, providerName, headers;

            if (provider === 'deepseek') {
                currentApiKey = deepseekApiKey; apiUrl = DEEPSEEK_API_URL; providerName = 'DeepSeek';
                headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentApiKey}` };
            } else if (provider === 'openrouter') {
                currentApiKey = openRouterApiKey; apiUrl = OPENROUTER_API_URL; providerName = 'OpenRouter';
                headers = {
                    'Content-Type': 'application/json', 'Authorization': `Bearer ${currentApiKey}`,
                    'HTTP-Referer': 'https://github.com/subscribe-to-my-channel-on-youtube/lingua-scripter',
                    'X-Title': 'Lingua Scripter by Subscribe'
                };
            } else {
                currentApiKey = openaiApiKey;
                if (!openaiEndpoint) return res.status(400).json({ error: 'OpenAI Endpoint URL is missing.' });
                apiUrl = `${openaiEndpoint.replace(/\/$/, '')}/v1/chat/completions`; providerName = 'OpenAI';
                headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentApiKey}` };
            }

            if (!currentApiKey) return res.status(400).json({ error: `${providerName} API Key is missing.` });

            const requestPayload = {
                model,
                messages: [{ role: 'system', content: newSystemInstruction }, { role: 'user', content: userPrompt }],
                temperature: temperature ?? 0.7,
                response_format: { type: 'json_object' }
            };

            if (provider === 'openrouter' && openRouterModelProviders?.trim()) {
                requestPayload.route = { providers: openRouterModelProviders.split(',').map(p => p.trim()) };
            }

            const response = await fetchWithRetry(apiUrl, { method: 'POST', headers, body: JSON.stringify(requestPayload) }, retryCount, `${providerName} translate`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message || 'Translation failed.');

            let jsonString = extractResponseText(data);
            if (!jsonString) {
                throw new Error(`${providerName} API returned no readable text content.`);
            }
            const jsonObjectString = extractJsonObjectString(jsonString);
            if (jsonObjectString) {
                const parsed = JSON.parse(jsonObjectString);
                translation = parsed.translation || '';
                newCharacters = parsed.characters || [];
            } else {
                translation = jsonString;
            }
            logApiCall({ provider: providerName, endpoint: '/translate', requestPayload, response: data, fullResponseText: jsonString, startTime, endTime: performance.now() });

        } else { // Gemini
            if (!apiKey) return res.status(400).json({ error: "Gemini API Key is missing." });

            const requestPayload = {
                model,
                contents: userPrompt,
                safetySettings: buildSafetySettings(),
                config: {
                    systemInstruction: newSystemInstruction,
                    temperature: temperature ?? 0.5,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            translation: { type: Type.STRING },
                            characters: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        name: { type: Type.STRING },
                                        translatedName: { type: Type.STRING },
                                        gender: { type: Type.STRING },
                                        pronouns: { type: Type.STRING }
                                    },
                                    required: ['name', 'translatedName', 'gender', 'pronouns']
                                }
                            }
                        },
                        required: ['translation', 'characters']
                    }
                }
            };
            const ai = new GoogleGenAI({ apiKey: apiKey });
            const response = await ai.models.generateContent(requestPayload);
            const jsonString = response.text.trim();
            const parsed = JSON.parse(jsonString);
            translation = parsed.translation || '';
            newCharacters = parsed.characters || [];
            logApiCall({ provider: 'Gemini', endpoint: '/translate', requestPayload, response, fullResponseText: jsonString, startTime, endTime: performance.now() });
        }

        res.json({ translation, newCharacters });
    } catch (error) {
        console.error("Translation failed:", error);
        res.status(500).json({ error: error.message || "An unknown error." });
    }
});

// Chapter title translation (single JSON payload)
router.post('/translate-chapter-titles', async (req, res) => {
    const {
        chapters,
        model,
        provider,
        apiKey,
        deepseekApiKey,
        openRouterApiKey,
        openaiApiKey,
        openaiEndpoint,
        openRouterModelProviders,
        targetLanguage,
        requestRetryCount
    } = req.body;

    if (!Array.isArray(chapters) || chapters.length === 0) {
        return res.status(400).json({ error: 'chapters array is required.' });
    }

    const retryCount = normalizeRetryCount(requestRetryCount);
    const safeChapters = chapters.map((chapter, index) => ({
        id: String(chapter?.id || `chapter-${index + 1}`),
        title: String(chapter?.title || '').trim() || `Chapter ${index + 1}`
    }));

    const systemInstruction = `You are a translation engine. Translate chapter titles into ${targetLanguage || 'English'}.
You will receive a JSON object with this schema: {"chapters":[{"id":"...","title":"..."}]}.
Rules:
1. Keep every "id" exactly unchanged.
2. Translate only the "title" values.
3. Keep the same number of items in the same order.
4. Return ONLY valid JSON with the exact same schema and no extra text.`;

    const userPrompt = JSON.stringify({ chapters: safeChapters }, null, 2);
    const startTime = performance.now();

    try {
        let translatedTitles = [];

        if (provider === 'deepseek' || provider === 'openrouter' || provider === 'openai') {
            let currentApiKey, apiUrl, providerName, headers;

            if (provider === 'deepseek') {
                currentApiKey = deepseekApiKey; apiUrl = DEEPSEEK_API_URL; providerName = 'DeepSeek';
                headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentApiKey}` };
            } else if (provider === 'openrouter') {
                currentApiKey = openRouterApiKey; apiUrl = OPENROUTER_API_URL; providerName = 'OpenRouter';
                headers = {
                    'Content-Type': 'application/json', 'Authorization': `Bearer ${currentApiKey}`,
                    'HTTP-Referer': 'https://github.com/subscribe-to-my-channel-on-youtube/lingua-scripter',
                    'X-Title': 'Lingua Scripter by Subscribe'
                };
            } else {
                currentApiKey = openaiApiKey;
                if (!openaiEndpoint) return res.status(400).json({ error: 'OpenAI Endpoint URL is missing.' });
                apiUrl = `${openaiEndpoint.replace(/\/$/, '')}/v1/chat/completions`; providerName = 'OpenAI';
                headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentApiKey}` };
            }

            if (!currentApiKey) return res.status(400).json({ error: `${providerName} API Key is missing.` });

            const requestPayload = {
                model,
                messages: [{ role: 'system', content: systemInstruction }, { role: 'user', content: userPrompt }],
                temperature: 0.2,
                response_format: { type: 'json_object' }
            };

            if (provider === 'openrouter' && openRouterModelProviders?.trim()) {
                requestPayload.route = { providers: openRouterModelProviders.split(',').map(p => p.trim()) };
            }

            const response = await fetchWithRetry(apiUrl, { method: 'POST', headers, body: JSON.stringify(requestPayload) }, retryCount, `${providerName} translate chapter titles`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message || 'Chapter title translation failed.');

            const jsonString = extractResponseText(data);
            if (!jsonString) throw new Error(`${providerName} API returned no readable text content.`);
            const jsonObjectString = extractJsonObjectString(jsonString);
            if (!jsonObjectString) throw new Error('AI did not return valid JSON for chapter titles.');

            const parsed = JSON.parse(jsonObjectString);
            if (!Array.isArray(parsed?.chapters)) throw new Error('AI returned invalid chapter title response format.');

            translatedTitles = safeChapters.map((original, index) => {
                const fromResponse = parsed.chapters.find((item) => String(item?.id) === original.id) || parsed.chapters[index];
                const translatedTitle = typeof fromResponse?.title === 'string' && fromResponse.title.trim()
                    ? fromResponse.title.trim()
                    : original.title;
                return { id: original.id, translatedTitle };
            });

            logApiCall({ provider: providerName, endpoint: '/translate-chapter-titles', requestPayload, response: data, fullResponseText: jsonObjectString, startTime, endTime: performance.now() });
        } else {
            if (!apiKey) return res.status(400).json({ error: "Gemini API Key is missing." });

            const requestPayload = {
                model,
                contents: userPrompt,
                safetySettings: buildSafetySettings(),
                config: {
                    systemInstruction,
                    temperature: 0.2,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            chapters: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        id: { type: Type.STRING },
                                        title: { type: Type.STRING }
                                    },
                                    required: ['id', 'title']
                                }
                            }
                        },
                        required: ['chapters']
                    }
                }
            };

            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent(requestPayload);
            const jsonString = response.text.trim();
            const parsed = JSON.parse(jsonString);
            if (!Array.isArray(parsed?.chapters)) throw new Error('AI returned invalid chapter title response format.');

            translatedTitles = safeChapters.map((original, index) => {
                const fromResponse = parsed.chapters.find((item) => String(item?.id) === original.id) || parsed.chapters[index];
                const translatedTitle = typeof fromResponse?.title === 'string' && fromResponse.title.trim()
                    ? fromResponse.title.trim()
                    : original.title;
                return { id: original.id, translatedTitle };
            });

            logApiCall({ provider: 'Gemini', endpoint: '/translate-chapter-titles', requestPayload, response, fullResponseText: jsonString, startTime, endTime: performance.now() });
        }

        res.json({ titles: translatedTitles });
    } catch (error) {
        console.error('Chapter title translation failed:', error);
        res.status(500).json({ error: error.message || 'Failed to translate chapter titles.' });
    }
});

// Batch Translation - combines multiple chapters in one request using the SAME simple JSON format as single translation
// This approach saves API requests while maintaining compatibility with all providers
router.post('/translate-batch', async (req, res) => {
    const { chapters, glossary, model, systemInstruction, temperature, provider, apiKey, deepseekApiKey, openRouterApiKey, openaiApiKey, openaiEndpoint, openRouterModelProviders, mentionedCharacters, targetLanguage, requestRetryCount } = req.body;
    const retryCount = normalizeRetryCount(requestRetryCount);

    if (!chapters || !Array.isArray(chapters) || chapters.length === 0) {
        return res.status(400).json({ error: 'chapters array is required' });
    }

    console.log(`[Batch Translation] Starting combined translation of ${chapters.length} chapters`);
    console.log(`[Batch Translation] Provider: ${provider}, Model: ${model}`);

    // Build combined text with chapter markers
    const combinedText = chapters.map((ch, idx) =>
        `[CHAPTER_${idx + 1}_START]\n${ch.originalText}\n[CHAPTER_${idx + 1}_END]`
    ).join('\n\n');

    console.log(`[Batch Translation] Combined text length: ${combinedText.length} characters`);

    // Prepare system instruction - SAME format as single translation, but with chapter marker instructions
    let finalSystemInstruction = systemInstruction.replace(/\{\{targetLanguage\}\}/g, targetLanguage || 'English');
    if (!systemInstruction.includes('{{targetLanguage}}')) {
        finalSystemInstruction = finalSystemInstruction.replace(/into fluent, natural English/g, `into fluent, natural ${targetLanguage || 'English'}`);
    }

    // Use the SAME JSON format as single translation: {translation, characters}
    // The only addition is asking to preserve chapter markers
    const newSystemInstruction = `${finalSystemInstruction}

IMPORTANT: The text contains ${chapters.length} chapters marked with [CHAPTER_N_START] and [CHAPTER_N_END] tags. You MUST preserve these exact markers in your translated output so the chapters can be separated afterward. Translate the content between each pair of markers.

In addition to the translation, identify all characters across ALL chapters. For each character found, provide their original name from the source text and their name translated into ${targetLanguage || 'English'}. Your response MUST be a single valid JSON object with two keys: "translation" (a string containing the full translated text WITH chapter markers preserved) and "characters" (an array of objects, where each object has "name", "translatedName", "gender", and "pronouns"). If no characters are found, provide an empty array for the "characters" key. The 'name' field must be the original, raw name.`;

    const { userPrompt } = buildPrompt(combinedText, glossary, mentionedCharacters);
    const startTime = performance.now();

    try {
        let fullTranslation = "";
        let allCharacters = [];

        if (provider === 'deepseek' || provider === 'openrouter' || provider === 'openai') {
            let currentApiKey, apiUrl, providerName, headers;

            if (provider === 'deepseek') {
                currentApiKey = deepseekApiKey; apiUrl = DEEPSEEK_API_URL; providerName = 'DeepSeek';
                headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentApiKey}` };
            } else if (provider === 'openrouter') {
                currentApiKey = openRouterApiKey; apiUrl = OPENROUTER_API_URL; providerName = 'OpenRouter';
                headers = {
                    'Content-Type': 'application/json', 'Authorization': `Bearer ${currentApiKey}`,
                    'HTTP-Referer': 'https://github.com/subscribe-to-my-channel-on-youtube/lingua-scripter',
                    'X-Title': 'Lingua Scripter by Subscribe'
                };
            } else {
                currentApiKey = openaiApiKey;
                if (!openaiEndpoint) {
                    return res.status(400).json({ error: 'OpenAI Endpoint URL is missing.' });
                }
                apiUrl = `${openaiEndpoint.replace(/\/$/, '')}/v1/chat/completions`; providerName = 'OpenAI';
                headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentApiKey}` };
            }

            if (!currentApiKey) {
                return res.status(400).json({ error: `${providerName} API Key is missing.` });
            }

            // SAME request payload structure as single translation
            const requestPayload = {
                model,
                messages: [{ role: 'system', content: newSystemInstruction }, { role: 'user', content: userPrompt }],
                temperature: temperature ?? 0.7,
                response_format: { type: 'json_object' }
            };

            if (provider === 'openrouter' && openRouterModelProviders?.trim()) {
                requestPayload.route = { providers: openRouterModelProviders.split(',').map(p => p.trim()) };
            }

            console.log(`[Batch Translation] Calling ${providerName} API`);

            const response = await fetchWithRetry(apiUrl, { method: 'POST', headers, body: JSON.stringify(requestPayload) }, retryCount, `${providerName} batch translate`);

            // Check content type before parsing
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const textResponse = await response.text();
                console.error(`[Batch] ${providerName} returned non-JSON:`, textResponse.substring(0, 300));
                throw new Error(`${providerName} API returned an invalid response. Status: ${response.status}`);
            }

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error?.message || 'Batch translation failed.');
            }

            let jsonString = extractResponseText(data);
            if (!jsonString) {
                throw new Error(`${providerName} API returned no readable text content.`);
            }
            const jsonObjectString = extractJsonObjectString(jsonString);
            if (jsonObjectString) {
                const parsed = JSON.parse(jsonObjectString);
                fullTranslation = parsed.translation || '';
                allCharacters = parsed.characters || [];
            } else {
                fullTranslation = jsonString;
            }
            logApiCall({ provider: providerName, endpoint: '/translate-batch', requestPayload, response: data, fullResponseText: jsonString, startTime, endTime: performance.now() });

        } else { // Gemini - use SAME schema as single translation
            if (!apiKey) {
                return res.status(400).json({ error: "Gemini API Key is missing." });
            }

            const requestPayload = {
                model,
                contents: userPrompt,
                safetySettings: buildSafetySettings(),
                config: {
                    systemInstruction: newSystemInstruction,
                    temperature: temperature ?? 0.5,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            translation: { type: Type.STRING },
                            characters: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        name: { type: Type.STRING },
                                        translatedName: { type: Type.STRING },
                                        gender: { type: Type.STRING },
                                        pronouns: { type: Type.STRING }
                                    },
                                    required: ['name', 'translatedName', 'gender', 'pronouns']
                                }
                            }
                        },
                        required: ['translation', 'characters']
                    }
                }
            };
            const ai = new GoogleGenAI({ apiKey: apiKey });
            const response = await ai.models.generateContent(requestPayload);
            const jsonString = response.text.trim();
            const parsed = JSON.parse(jsonString);
            fullTranslation = parsed.translation || '';
            allCharacters = parsed.characters || [];
            logApiCall({ provider: 'Gemini', endpoint: '/translate-batch', requestPayload, response, fullResponseText: jsonString, startTime, endTime: performance.now() });
        }

        // Split the combined translation back into individual chapters using the markers
        const results = [];
        for (let i = 0; i < chapters.length; i++) {
            const startMarker = `[CHAPTER_${i + 1}_START]`;
            const endMarker = `[CHAPTER_${i + 1}_END]`;

            const startIdx = fullTranslation.indexOf(startMarker);
            const endIdx = fullTranslation.indexOf(endMarker);

            let chapterTranslation = '';
            if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
                chapterTranslation = fullTranslation
                    .substring(startIdx + startMarker.length, endIdx)
                    .trim();
            } else {
                // Fallback: if markers not found, try to split evenly or use what we have
                console.warn(`[Batch Translation] Could not find markers for chapter ${i + 1}`);
                if (chapters.length === 1) {
                    // Single chapter - use entire translation
                    chapterTranslation = fullTranslation.replace(/\[CHAPTER_\d+_(START|END)\]/g, '').trim();
                }
            }

            results.push({
                chapterId: chapters[i].id,
                translatedText: chapterTranslation
            });
        }

        console.log(`[Batch Translation] Successfully split translation into ${results.length} chapters`);
        res.json({ translations: results, characters: allCharacters });

    } catch (error) {
        console.error("Batch translation failed:", error);
        res.status(500).json({ error: error.message || "An unknown error occurred during batch translation." });
    }
});

// Batch Translation (streaming) - streams translation with chapter markers to prevent timeouts
router.post('/translate-batch-stream', async (req, res) => {
    const { chapters, glossary, model, systemInstruction, temperature, provider, apiKey, deepseekApiKey, openRouterApiKey, openaiApiKey, openaiEndpoint, openRouterModelProviders, mentionedCharacters, targetLanguage, requestRetryCount } = req.body;
    const retryCount = normalizeRetryCount(requestRetryCount);

    if (!chapters || !Array.isArray(chapters) || chapters.length === 0) {
        return res.status(400).json({ error: 'chapters array is required' });
    }

    console.log(`[Batch Stream] Starting streaming translation of ${chapters.length} chapters`);
    console.log(`[Batch Stream] Provider: ${provider}, Model: ${model}`);

    // Build combined text with chapter markers
    const combinedText = chapters.map((ch, idx) =>
        `[CHAPTER_${idx + 1}_START]\n${ch.originalText}\n[CHAPTER_${idx + 1}_END]`
    ).join('\n\n');

    console.log(`[Batch Stream] Combined text length: ${combinedText.length} characters`);

    // Prepare system instruction - same as regular batch but with streaming-friendly format
    let finalSystemInstruction = systemInstruction.replace(/\{\{targetLanguage\}\}/g, targetLanguage || 'English');
    if (!systemInstruction.includes('{{targetLanguage}}')) {
        finalSystemInstruction = finalSystemInstruction.replace(/into fluent, natural English/g, `into fluent, natural ${targetLanguage || 'English'}`);
    }

    // System instruction for streaming - just ask for translation with markers, no JSON
    const streamSystemInstruction = `${finalSystemInstruction}

IMPORTANT: The text contains ${chapters.length} chapters marked with [CHAPTER_N_START] and [CHAPTER_N_END] tags. 
You MUST preserve these exact markers in your translated output. Translate the content between each pair of markers.
Do NOT output any JSON. Just output the translated text with the chapter markers preserved.`;

    const { userPrompt } = buildPrompt(combinedText, glossary, mentionedCharacters);

    // Set up streaming response
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    const startTime = performance.now();
    let fullResponseText = "";

    try {
        if (provider === 'deepseek' || provider === 'openrouter' || provider === 'openai') {
            let currentApiKey, apiUrl, providerName, headers;

            if (provider === 'deepseek') {
                currentApiKey = deepseekApiKey; apiUrl = DEEPSEEK_API_URL; providerName = 'DeepSeek';
                headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentApiKey}` };
            } else if (provider === 'openrouter') {
                currentApiKey = openRouterApiKey; apiUrl = OPENROUTER_API_URL; providerName = 'OpenRouter';
                headers = {
                    'Content-Type': 'application/json', 'Authorization': `Bearer ${currentApiKey}`,
                    'HTTP-Referer': 'https://github.com/subscribe-to-my-channel-on-youtube/lingua-scripter',
                    'X-Title': 'Lingua Scripter by Subscribe'
                };
            } else {
                currentApiKey = openaiApiKey;
                if (!openaiEndpoint) throw new Error('OpenAI Endpoint URL is missing.');
                apiUrl = `${openaiEndpoint.replace(/\/$/, '')}/v1/chat/completions`; providerName = 'OpenAI';
                headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentApiKey}` };
            }

            if (!currentApiKey) throw new Error(`${providerName} API Key is missing.`);

            const requestPayload = {
                model,
                messages: [{ role: 'system', content: streamSystemInstruction }, { role: 'user', content: userPrompt }],
                temperature: temperature ?? 0.7,
                stream: true
            };

            if (provider === 'openrouter' && openRouterModelProviders?.trim()) {
                requestPayload.route = { providers: openRouterModelProviders.split(',').map(p => p.trim()) };
            }

            console.log(`[Batch Stream] Calling ${providerName} API with streaming`);

            const response = await fetchWithRetry(apiUrl, { method: 'POST', headers, body: JSON.stringify(requestPayload) }, retryCount, `${providerName} batch stream`);

            // Check for non-streaming error response
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'Streaming batch translation failed.');
            }

            if (!response.ok) {
                throw new Error(`API returned status ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let sseBuffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    // Flush any remaining data in SSE buffer
                    if (sseBuffer.trim()) {
                        const line = sseBuffer.trim();
                        if (line.startsWith('data: ')) {
                            const data = line.substring(6);
                            if (data !== '[DONE]') {
                                try {
                                    const json = JSON.parse(data);
                                    const content = json.choices[0]?.delta?.content;
                                    if (content) {
                                        fullResponseText += content;
                                        res.write(content);
                                    }
                                } catch (e) { /* ignore */ }
                            }
                        }
                    }
                    break;
                }

                // Use {stream: true} to handle multi-byte UTF-8 characters split across chunks
                const chunk = decoder.decode(value, { stream: true });
                sseBuffer += chunk;

                // Process complete SSE lines only
                const lines = sseBuffer.split('\n');
                sseBuffer = lines.pop() || ''; // Keep the incomplete line in buffer

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!trimmedLine) continue;
                    if (trimmedLine.startsWith('data: ')) {
                        const data = trimmedLine.substring(6);
                        if (data === '[DONE]') break;
                        try {
                            const json = JSON.parse(data);
                            const content = json.choices[0]?.delta?.content;
                            if (content) {
                                fullResponseText += content;
                                res.write(content);
                            }
                        } catch (e) {
                            // Ignore parse errors for incomplete chunks
                        }
                    }
                }
            }

            logApiCall({ provider: providerName, endpoint: '/translate-batch-stream', requestPayload, response: { note: "Streaming response" }, fullResponseText, startTime, endTime: performance.now(), isStreaming: true });

        } else { // Gemini
            if (!apiKey) throw new Error("Gemini API Key is missing.");

            const requestPayload = {
                model,
                contents: userPrompt,
                safetySettings: buildSafetySettings(),
                config: { systemInstruction: streamSystemInstruction, temperature: temperature ?? 0.5 }
            };

            const ai = new GoogleGenAI({ apiKey: apiKey });
            const responseStream = await ai.models.generateContentStream(requestPayload);

            let lastChunk;
            for await (const chunk of responseStream) {
                const chunkText = chunk.text;
                fullResponseText += chunkText;
                lastChunk = chunk;
                res.write(chunkText);
            }

            logApiCall({ provider: 'Gemini', endpoint: '/translate-batch-stream', requestPayload, response: lastChunk, fullResponseText, startTime, endTime: performance.now(), isStreaming: true });
        }

        console.log(`[Batch Stream] Streaming completed, total length: ${fullResponseText.length}`);
        res.end();

    } catch (error) {
        console.error("Streaming batch translation failed:", error);
        res.write(`[ERROR]${error.message}`);
        res.end();
    }
});

// Translation (streaming)
router.post('/translate-stream', async (req, res) => {
    const { text, glossary, model, systemInstruction, temperature, provider, apiKey, deepseekApiKey, openRouterApiKey, openaiApiKey, openaiEndpoint, openRouterModelProviders, mentionedCharacters, targetLanguage, requestRetryCount } = req.body;
    const retryCount = normalizeRetryCount(requestRetryCount);

    let finalSystemInstruction = systemInstruction.replace(/\{\{targetLanguage\}\}/g, targetLanguage || 'English');
    if (!systemInstruction.includes('{{targetLanguage}}')) {
        finalSystemInstruction = finalSystemInstruction.replace(/into fluent, natural English/g, `into fluent, natural ${targetLanguage || 'English'}`);
    }

    const { userPrompt } = buildPrompt(text, glossary, mentionedCharacters);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    const startTime = performance.now();
    let fullResponseText = "";

    try {
        if (provider === 'deepseek' || provider === 'openrouter' || provider === 'openai') {
            let currentApiKey, apiUrl, providerName, headers;

            if (provider === 'deepseek') {
                currentApiKey = deepseekApiKey; apiUrl = DEEPSEEK_API_URL; providerName = 'DeepSeek';
                headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentApiKey}` };
            } else if (provider === 'openrouter') {
                currentApiKey = openRouterApiKey; apiUrl = OPENROUTER_API_URL; providerName = 'OpenRouter';
                headers = {
                    'Content-Type': 'application/json', 'Authorization': `Bearer ${currentApiKey}`,
                    'HTTP-Referer': 'https://github.com/subscribe-to-my-channel-on-youtube/lingua-scripter',
                    'X-Title': 'Lingua Scripter by Subscribe'
                };
            } else {
                currentApiKey = openaiApiKey;
                if (!openaiEndpoint) throw new Error('OpenAI Endpoint URL is missing.');
                apiUrl = `${openaiEndpoint.replace(/\/$/, '')}/v1/chat/completions`; providerName = 'OpenAI';
                headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentApiKey}` };
            }

            if (!currentApiKey) throw new Error(`${providerName} API Key is missing.`);

            const requestPayload = {
                model,
                messages: [{ role: 'system', content: finalSystemInstruction }, { role: 'user', content: userPrompt }],
                temperature: temperature ?? 0.7,
                stream: true
            };
            if (provider === 'openrouter' && openRouterModelProviders?.trim()) {
                requestPayload.route = { providers: openRouterModelProviders.split(',').map(p => p.trim()) };
            }

            const response = await fetchWithRetry(apiUrl, { method: 'POST', headers, body: JSON.stringify(requestPayload) }, retryCount, `${providerName} translate stream`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'Streaming translation failed.');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let sseBuffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    // Flush any remaining data in SSE buffer
                    if (sseBuffer.trim()) {
                        const line = sseBuffer.trim();
                        if (line.startsWith('data: ')) {
                            const data = line.substring(6);
                            if (data !== '[DONE]') {
                                try {
                                    const json = JSON.parse(data);
                                    const content = json.choices[0]?.delta?.content;
                                    if (content) {
                                        fullResponseText += content;
                                        res.write(content);
                                    }
                                } catch (e) { /* ignore */ }
                            }
                        }
                    }
                    break;
                }

                // Use {stream: true} to handle multi-byte UTF-8 characters split across chunks
                const chunk = decoder.decode(value, { stream: true });
                sseBuffer += chunk;

                // Process complete SSE lines only
                const lines = sseBuffer.split('\n');
                sseBuffer = lines.pop() || ''; // Keep the incomplete line in buffer

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!trimmedLine) continue;
                    if (trimmedLine.startsWith('data: ')) {
                        const data = trimmedLine.substring(6);
                        if (data === '[DONE]') break;
                        try {
                            const json = JSON.parse(data);
                            const content = json.choices[0]?.delta?.content;
                            if (content) {
                                fullResponseText += content;
                                res.write(content);
                            }
                        } catch (e) {
                            console.error('Could not parse stream chunk:', data, e);
                        }
                    }
                }
            }
            logApiCall({ provider: providerName, endpoint: '/translate-stream', requestPayload, response: { note: "Usage data not available in final stream chunk." }, fullResponseText, startTime, endTime: performance.now(), isStreaming: true });

        } else { // Gemini
            if (!apiKey) throw new Error("Gemini API Key is missing.");

            const requestPayload = {
                model,
                contents: userPrompt,
                safetySettings: buildSafetySettings(),
                config: { systemInstruction: finalSystemInstruction, temperature: temperature ?? 0.5 }
            };
            const ai = new GoogleGenAI({ apiKey: apiKey });
            const responseStream = await ai.models.generateContentStream(requestPayload);
            let lastChunk;
            for await (const chunk of responseStream) {
                const chunkText = chunk.text;
                fullResponseText += chunkText;
                lastChunk = chunk;
                res.write(chunkText);
            }
            logApiCall({ provider: 'Gemini', endpoint: '/translate-stream', requestPayload, response: lastChunk, fullResponseText, startTime, endTime: performance.now(), isStreaming: true });
        }
        res.end();
    } catch (error) {
        console.error("Streaming translation failed:", error);
        res.write(`Error: Failed to translate. ${error.message}`);
        res.end();
    }
});

// Find phrases (for glossary)
router.post('/find-phrases', async (req, res) => {
    const { originalText, translatedText, selectedTranslations, model, provider, apiKey, deepseekApiKey, openRouterApiKey, openaiApiKey, openaiEndpoint, requestRetryCount } = req.body;
    const retryCount = normalizeRetryCount(requestRetryCount);

    const systemInstruction = `You are an expert linguistic analysis tool. Your task is to find the corresponding phrases in an original text given its translation and a list of selected translated phrases. Respond ONLY with a valid JSON object and nothing else. The JSON object should contain an 'entries' key, which holds an array of objects. Each object in the array should have 'translation' and 'original' keys. The 'original' value should be the exact, unmodified phrase from the original text. If a corresponding phrase cannot be found for a given translation, omit it from the array. Do not include any explanatory text, markdown formatting, or anything besides the JSON object.`;
    const userPrompt = `
Original Text:\n---\n${originalText}\n---\n
Translated Text:\n---\n${translatedText}\n---\n
Find the exact phrases in the "Original Text" that correspond to the following translated phrases:
${selectedTranslations.map(t => `- "${t}"`).join('\n')}
Respond with a JSON object in the format: {"entries": [{"translation": "...", "original": "..."}, ...]}`;

    const startTime = performance.now();
    try {
        if (provider === 'deepseek' || provider === 'openrouter' || provider === 'openai') {
            let currentApiKey, apiUrl, providerName, headers;
            if (provider === 'deepseek') {
                currentApiKey = deepseekApiKey; apiUrl = DEEPSEEK_API_URL; providerName = 'DeepSeek';
                headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentApiKey}` };
            } else if (provider === 'openrouter') {
                currentApiKey = openRouterApiKey; apiUrl = OPENROUTER_API_URL; providerName = 'OpenRouter';
                headers = {
                    'Content-Type': 'application/json', 'Authorization': `Bearer ${currentApiKey}`,
                    'HTTP-Referer': 'https://github.com/subscribe-to-my-channel-on-youtube/lingua-scripter', 'X-Title': 'Lingua Scripter by Subscribe'
                };
            } else {
                currentApiKey = openaiApiKey;
                if (!openaiEndpoint) return res.status(400).json({ error: 'OpenAI Endpoint URL is missing.' });
                apiUrl = `${openaiEndpoint.replace(/\/$/, '')}/v1/chat/completions`; providerName = 'OpenAI';
                headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentApiKey}` };
            }
            if (!currentApiKey) return res.status(400).json({ error: `${providerName} API Key is missing.` });

            const requestPayload = { model, messages: [{ role: 'system', content: systemInstruction }, { role: 'user', content: userPrompt }], temperature: 0.1, response_format: { type: 'json_object' } };

            const response = await fetchWithRetry(apiUrl, { method: 'POST', headers, body: JSON.stringify(requestPayload) }, retryCount, `${providerName} find phrases`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message || 'AI lookup failed.');

            let jsonString = extractResponseText(data);
            if (!jsonString) throw new Error(`${providerName} API returned no readable text content.`);
            const jsonObjectString = extractJsonObjectString(jsonString);
            if (!jsonObjectString) throw new Error("AI did not return a valid JSON object.");
            jsonString = jsonObjectString;

            logApiCall({ provider: providerName, endpoint: '/find-phrases', requestPayload, response: data, fullResponseText: jsonString, startTime, endTime: performance.now() });
            res.json(JSON.parse(jsonString));

        } else { // Gemini
            if (!apiKey) return res.status(400).json({ error: "Gemini API Key is missing." });

            const requestPayload = {
                model,
                contents: userPrompt,
                safetySettings: buildSafetySettings(),
                config: {
                    systemInstruction,
                    responseMimeType: "application/json",
                    responseSchema: { type: Type.OBJECT, properties: { entries: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { translation: { type: Type.STRING }, original: { type: Type.STRING } }, required: ['translation', 'original'] } } }, required: ['entries'] }
                }
            };
            const ai = new GoogleGenAI({ apiKey: apiKey });
            const response = await ai.models.generateContent(requestPayload);
            const jsonString = response.text.trim();
            logApiCall({ provider: 'Gemini', endpoint: '/find-phrases', requestPayload, response, fullResponseText: jsonString, startTime, endTime: performance.now() });
            res.json(JSON.parse(jsonString));
        }
    } catch (error) {
        console.error("Find phrases failed:", error);
        res.status(500).json({ error: `AI lookup failed: ${error.message}` });
    }
});

// Analyze characters
router.post('/analyze-characters', async (req, res) => {
    const { originalText, model, provider, apiKey, deepseekApiKey, openRouterApiKey, openaiApiKey, openaiEndpoint, targetLanguage, requestRetryCount } = req.body;
    const retryCount = normalizeRetryCount(requestRetryCount);

    const systemInstruction = `Analyze the provided text to identify all characters. For each character, provide their original name, their name translated into ${targetLanguage || 'English'}, their gender (e.g., "Male", "Female", "Non-binary", or "Unknown"), and common pronouns (e.g., "he/him", "she/her", "they/them"). Respond ONLY with a valid JSON object. The object must have a single key "characters" which is an array of objects. Each object in the array should have "name", "translatedName", "gender", and "pronouns" keys. The 'name' field must be the original, raw name from the source text. If no characters are found, return an empty array. Do not include any explanatory text, markdown formatting, or anything besides the JSON object.`;
    const userPrompt = `Text to analyze:\n---\n${originalText}\n---\n`;

    const startTime = performance.now();
    try {
        if (provider === 'deepseek' || provider === 'openrouter' || provider === 'openai') {
            let currentApiKey, apiUrl, providerName, headers;
            if (provider === 'deepseek') {
                currentApiKey = deepseekApiKey; apiUrl = DEEPSEEK_API_URL; providerName = 'DeepSeek';
                headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentApiKey}` };
            } else if (provider === 'openrouter') {
                currentApiKey = openRouterApiKey; apiUrl = OPENROUTER_API_URL; providerName = 'OpenRouter';
                headers = {
                    'Content-Type': 'application/json', 'Authorization': `Bearer ${currentApiKey}`,
                    'HTTP-Referer': 'https://github.com/subscribe-to-my-channel-on-youtube/lingua-scripter', 'X-Title': 'Lingua Scripter by Subscribe'
                };
            } else {
                currentApiKey = openaiApiKey;
                if (!openaiEndpoint) return res.status(400).json({ error: 'OpenAI Endpoint URL is missing.' });
                apiUrl = `${openaiEndpoint.replace(/\/$/, '')}/v1/chat/completions`; providerName = 'OpenAI';
                headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentApiKey}` };
            }
            if (!currentApiKey) return res.status(400).json({ error: `${providerName} API Key is missing.` });

            const requestPayload = { model, messages: [{ role: 'system', content: systemInstruction }, { role: 'user', content: userPrompt }], temperature: 0.1, response_format: { type: 'json_object' } };

            const response = await fetchWithRetry(apiUrl, { method: 'POST', headers, body: JSON.stringify(requestPayload) }, retryCount, `${providerName} analyze characters`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message || 'AI analysis failed.');

            let jsonString = extractResponseText(data);
            if (!jsonString) throw new Error(`${providerName} API returned no readable text content.`);
            const jsonObjectString = extractJsonObjectString(jsonString);
            if (!jsonObjectString) throw new Error("AI did not return a valid JSON object for character analysis.");
            jsonString = jsonObjectString;

            logApiCall({ provider: providerName, endpoint: '/analyze-characters', requestPayload, response: data, fullResponseText: jsonString, startTime, endTime: performance.now() });
            res.json(JSON.parse(jsonString));

        } else { // Gemini
            if (!apiKey) return res.status(400).json({ error: "Gemini API Key is missing." });

            const requestPayload = {
                model,
                contents: userPrompt,
                safetySettings: buildSafetySettings(),
                config: {
                    systemInstruction,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            characters: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        name: { type: Type.STRING },
                                        translatedName: { type: Type.STRING },
                                        gender: { type: Type.STRING },
                                        pronouns: { type: Type.STRING }
                                    },
                                    required: ['name', 'translatedName', 'gender', 'pronouns']
                                }
                            }
                        },
                        required: ['characters']
                    }
                }
            };
            const ai = new GoogleGenAI({ apiKey: apiKey });
            const response = await ai.models.generateContent(requestPayload);
            const jsonString = response.text.trim();
            logApiCall({ provider: 'Gemini', endpoint: '/analyze-characters', requestPayload, response, fullResponseText: jsonString, startTime, endTime: performance.now() });
            res.json(JSON.parse(jsonString));
        }
    } catch (error) {
        console.error("Character analysis failed:", error);
        res.status(500).json({ error: `Character analysis failed: ${error.message}` });
    }
});

export default router;
