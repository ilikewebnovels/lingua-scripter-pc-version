/**
 * Shared utility functions for the server
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- File Storage Paths ---
export const DATA_DIR = path.join(__dirname, '..', 'data');
export const GLOSSARIES_DIR = path.join(DATA_DIR, 'glossaries');
export const CHARACTERS_DIR = path.join(DATA_DIR, 'characters');
export const CHAPTERS_DIR = path.join(DATA_DIR, 'chapters');
export const PROJECT_IMAGES_DIR = path.join(DATA_DIR, 'project_images');

// --- File Names ---
export const PROJECTS_FILE = 'projects.json';
export const CHAPTERS_FILE = 'chapters.json';
export const PRESETS_FILE = 'presets.json';
export const SETTINGS_FILE = 'settings.json';
export const TRANSLATION_MEMORY_FILE = 'translation_memory.json';

/**
 * Ensure a directory exists, creating it if necessary
 */
export const ensureDir = async (dir) => {
    try {
        await fs.mkdir(dir, { recursive: true });
    } catch (error) {
        if (error.code !== 'EEXIST') throw error;
    }
};

/**
 * Read data from a JSON file in the data directory
 */
export const readData = async (fileName, defaultValue = []) => {
    const filePath = path.join(DATA_DIR, fileName);
    try {
        await fs.access(filePath);
        const fileContent = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(fileContent);
    } catch (error) {
        await writeData(fileName, defaultValue);
        return defaultValue;
    }
};

/**
 * Write data to a JSON file in the data directory
 */
export const writeData = async (fileName, data) => {
    const filePath = path.join(DATA_DIR, fileName);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
};

/**
 * API call logger for debugging
 */
export function logApiCall({ provider, endpoint, requestPayload, response, fullResponseText, startTime, endTime, isStreaming = false }) {
    const streamLabel = isStreaming ? " (STREAMING)" : "";
    const latency = ((endTime - startTime) / 1000).toFixed(2);
    let logMessage = `\n\n--- [${provider}] REQUEST TO ${endpoint}${streamLabel} ---\n`;
    logMessage += `Request Body: ${JSON.stringify(requestPayload, null, 2)}\n`;
    logMessage += `\n--- [${provider}] RESPONSE${streamLabel} ---\n`;
    logMessage += `Assistant: ${fullResponseText}\n`;
    logMessage += `\n--- [${provider}] RESPONSE INFO${streamLabel} ---\n`;
    logMessage += `Latency: ${latency}s\n`;

    // Usage data varies between providers
    if (provider === 'Gemini' && response?.usageMetadata) {
        const { promptTokenCount = 0, candidatesTokenCount = 0, totalTokenCount = 0 } = response.usageMetadata;
        logMessage += `Tokens Used: ${totalTokenCount} (Prompt: ${promptTokenCount}, Completion: ${candidatesTokenCount})\n`;
    } else if (response?.usage) { // DeepSeek, OpenRouter, OpenAI
        const { prompt_tokens = 0, completion_tokens = 0, total_tokens = 0 } = response.usage;
        logMessage += `Tokens Used: ${total_tokens} (Prompt: ${prompt_tokens}, Completion: ${completion_tokens})\n`;
    } else {
        logMessage += "Tokens Used: Not available in this response.\n";
    }

    logMessage += `Raw JSON: ${JSON.stringify(response, null, 2)}\n`;
    console.log(logMessage);
}
