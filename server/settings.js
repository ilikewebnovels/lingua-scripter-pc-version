/**
 * Settings API Routes
 */
import express from 'express';
import { readData, writeData, SETTINGS_FILE } from './utils.js';

const router = express.Router();

// Default settings configuration
const defaultSettings = {
    provider: 'gemini',
    apiKey: '',
    deepseekApiKey: '',
    openRouterApiKey: '',
    openaiApiKey: '',
    openaiEndpoint: '',
    openRouterModelProviders: '',
    model: 'gemini-2.5-flash',
    theme: 'blue',
    fontFamily: 'font-sans',
    fontSize: 1,
    fontColor: '',
    temperature: 0.5,
    sourceLanguage: 'Auto-detect',
    targetLanguage: 'English',
    systemInstruction: 'You are an expert translator specializing in webnovels. First, detect the language of the provided text, then translate it into fluent, natural {{targetLanguage}}. Your primary goal is to preserve the original tone and narrative style. When a glossary is provided, you MUST adhere to it strictly for the specified terms. You may also be provided with Character Information for context (including their original and translated names); use this to ensure consistent character details (like names and pronouns) in your translation.',
    isStreamingEnabled: true,
    isTranslationMemoryEnabled: true,
    isAutoCharacterDetectionEnabled: true,
    reasoningEffort: 'auto'
};

// Get settings
router.get('/', async (req, res) => {
    res.json(await readData(SETTINGS_FILE, defaultSettings));
});

// Save settings
router.post('/', async (req, res) => {
    await writeData(SETTINGS_FILE, req.body);
    res.json(req.body);
});

export default router;
