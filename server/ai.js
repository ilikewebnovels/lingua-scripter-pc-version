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
    const { model, provider, apiKey, deepseekApiKey, openRouterApiKey, openaiApiKey, openaiEndpoint } = req.body;
    const startTime = performance.now();
    try {
        if (provider === 'deepseek') {
            if (!deepseekApiKey) return res.status(400).json({ success: false, message: "DeepSeek API Key is missing." });
            const requestPayload = { model, messages: [{ role: 'user', content: 'Hello' }], max_tokens: 5 };
            const response = await fetch(DEEPSEEK_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${deepseekApiKey}` },
                body: JSON.stringify(requestPayload)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message || 'Connection failed.');
            logApiCall({ provider: 'DeepSeek', endpoint: '/test-connection', requestPayload, response: data, fullResponseText: data.choices[0].message.content, startTime, endTime: performance.now() });
            res.json({ success: true, message: "Connection successful." });
        } else if (provider === 'openrouter') {
            if (!openRouterApiKey) return res.status(400).json({ success: false, message: "OpenRouter API Key is missing." });
            const requestPayload = { model, messages: [{ role: 'user', content: 'Hello' }], max_tokens: 5 };
            const response = await fetch(OPENROUTER_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${openRouterApiKey}`,
                    'HTTP-Referer': 'https://github.com/subscribe-to-my-channel-on-youtube/lingua-scripter',
                    'X-Title': 'Lingua Scripter by Subscribe'
                },
                body: JSON.stringify(requestPayload)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message || 'Connection failed.');
            logApiCall({ provider: 'OpenRouter', endpoint: '/test-connection', requestPayload, response: data, fullResponseText: data.choices[0].message.content, startTime, endTime: performance.now() });
            res.json({ success: true, message: "Connection successful." });
        } else if (provider === 'openai') {
            if (!openaiApiKey) return res.status(400).json({ success: false, message: "OpenAI API Key is missing." });
            if (!openaiEndpoint) return res.status(400).json({ success: false, message: "OpenAI Endpoint URL is missing." });
            const requestPayload = { model, messages: [{ role: 'user', content: 'Hello' }], max_tokens: 5 };
            const apiUrl = `${openaiEndpoint.replace(/\/$/, '')}/v1/chat/completions`;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiApiKey}` },
                body: JSON.stringify(requestPayload)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message || 'Connection failed.');
            logApiCall({ provider: 'OpenAI', endpoint: '/test-connection', requestPayload, response: data, fullResponseText: data.choices[0].message.content, startTime, endTime: performance.now() });
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
    const { text, glossary, model, systemInstruction, temperature, provider, apiKey, deepseekApiKey, openRouterApiKey, openaiApiKey, openaiEndpoint, openRouterModelProviders, projectId, mentionedCharacters, targetLanguage } = req.body;

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

            const response = await fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify(requestPayload) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message || 'Translation failed.');

            let jsonString = data.choices[0].message.content;
            const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
            if (jsonMatch && jsonMatch[0]) {
                const parsed = JSON.parse(jsonMatch[0]);
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

// Batch Translation - combines multiple chapters in one request using the SAME simple JSON format as single translation
// This approach saves API requests while maintaining compatibility with all providers
router.post('/translate-batch', async (req, res) => {
    const { chapters, glossary, model, systemInstruction, temperature, provider, apiKey, deepseekApiKey, openRouterApiKey, openaiApiKey, openaiEndpoint, openRouterModelProviders, mentionedCharacters, targetLanguage } = req.body;

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

            const response = await fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify(requestPayload) });

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

            let jsonString = data.choices[0].message.content;
            const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
            if (jsonMatch && jsonMatch[0]) {
                const parsed = JSON.parse(jsonMatch[0]);
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
    const { chapters, glossary, model, systemInstruction, temperature, provider, apiKey, deepseekApiKey, openRouterApiKey, openaiApiKey, openaiEndpoint, openRouterModelProviders, mentionedCharacters, targetLanguage } = req.body;

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

            const response = await fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify(requestPayload) });

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
    const { text, glossary, model, systemInstruction, temperature, provider, apiKey, deepseekApiKey, openRouterApiKey, openaiApiKey, openaiEndpoint, openRouterModelProviders, mentionedCharacters, targetLanguage } = req.body;

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

            const response = await fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify(requestPayload) });
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
    const { originalText, translatedText, selectedTranslations, model, provider, apiKey, deepseekApiKey, openRouterApiKey, openaiApiKey, openaiEndpoint } = req.body;

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

            const response = await fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify(requestPayload) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message || 'AI lookup failed.');

            let jsonString = data.choices[0].message.content;
            const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
            if (!jsonMatch || !jsonMatch[0]) throw new Error("AI did not return a valid JSON object.");
            jsonString = jsonMatch[0];

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
    const { originalText, model, provider, apiKey, deepseekApiKey, openRouterApiKey, openaiApiKey, openaiEndpoint, targetLanguage } = req.body;

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

            const response = await fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify(requestPayload) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message || 'AI analysis failed.');

            let jsonString = data.choices[0].message.content;
            const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
            if (!jsonMatch || !jsonMatch[0]) throw new Error("AI did not return a valid JSON object for character analysis.");
            jsonString = jsonMatch[0];

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
