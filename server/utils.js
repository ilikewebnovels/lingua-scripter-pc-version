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
export const BACKUPS_DIR = path.join(DATA_DIR, '.backups');

// --- File Names ---
export const PROJECTS_FILE = 'projects.json';
export const CHAPTERS_FILE = 'chapters.json';
export const PRESETS_FILE = 'presets.json';
export const SETTINGS_FILE = 'settings.json';
export const TRANSLATION_MEMORY_FILE = 'translation_memory.json';

// Files that should get rolling backups on every successful write
const ROLLING_BACKUP_FILES = new Set([
    PROJECTS_FILE,
    PRESETS_FILE,
    SETTINGS_FILE,
]);
const ROLLING_BACKUP_KEEP = 10;

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
 * Keep the last N rolling backups for a file. Best-effort; never throws.
 */
const rotateBackups = async (fileName, content) => {
    if (!ROLLING_BACKUP_FILES.has(fileName)) return;
    try {
        await ensureDir(BACKUPS_DIR);
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(BACKUPS_DIR, `${fileName}.${ts}`);
        await fs.writeFile(backupPath, content, 'utf-8');

        // Prune old backups for this file
        const entries = await fs.readdir(BACKUPS_DIR);
        const prefix = `${fileName}.`;
        const own = entries
            .filter(e => e.startsWith(prefix))
            .sort(); // ISO timestamps sort lexicographically
        const toRemove = own.slice(0, Math.max(0, own.length - ROLLING_BACKUP_KEEP));
        await Promise.all(
            toRemove.map(name =>
                fs.unlink(path.join(BACKUPS_DIR, name)).catch(() => {})
            )
        );
    } catch (e) {
        console.warn(`[backup] Failed to rotate backup for ${fileName}:`, e.message);
    }
};

/**
 * Read data from a JSON file in the data directory.
 *
 * IMPORTANT: This used to overwrite the file with the default on ANY error
 * (including transient I/O errors and JSON parse failures), which silently
 * destroyed real data. We now only seed the default file when it genuinely
 * does not exist (ENOENT). For any other error we log loudly and return the
 * default in memory so the app keeps running, but the file on disk is left
 * untouched so the user can recover it.
 */
export const readData = async (fileName, defaultValue = []) => {
    const filePath = path.join(DATA_DIR, fileName);
    try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        if (fileContent.trim() === '') {
            console.error(`[readData] ${fileName} is empty. Returning default value WITHOUT overwriting the file. Inspect data/${fileName} and data/.backups/.`);
            return defaultValue;
        }
        return JSON.parse(fileContent);
    } catch (error) {
        if (error && error.code === 'ENOENT') {
            // True missing file - safe to seed with default
            try {
                await writeData(fileName, defaultValue);
            } catch (writeErr) {
                console.error(`[readData] Failed to seed missing ${fileName}:`, writeErr);
            }
            return defaultValue;
        }
        // Any other failure (parse error, EBUSY, EACCES, etc.) must NOT clobber the file.
        console.error(`[readData] Failed to read ${fileName} (${error?.code || 'unknown'}): ${error?.message}. Returning default in memory; file left untouched.`);
        return defaultValue;
    }
};

/**
 * Write data to a JSON file in the data directory.
 *
 * Atomic write: serialise to a .tmp file in the same directory, then rename
 * over the target. This prevents truncation/half-written files if the
 * process is killed or the disk hiccups mid-write. For configured files we
 * also keep a rolling backup of the previously-written content.
 */
export const writeData = async (fileName, data) => {
    const filePath = path.join(DATA_DIR, fileName);
    const tmpPath = `${filePath}.tmp`;
    const serialised = JSON.stringify(data, null, 2);
    await fs.writeFile(tmpPath, serialised, 'utf-8');
    await fs.rename(tmpPath, filePath);
    // Fire-and-forget rolling backup. Never block the write on this.
    rotateBackups(fileName, serialised).catch(() => {});
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
