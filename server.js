/**
 * Lingua Scripter Server
 * 
 * Main entry point - imports modular routes from server/ directory
 * Refactored for maintainability: routes split into focused modules
 */
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Import shared utilities and directory constants
import {
    DATA_DIR,
    GLOSSARIES_DIR,
    CHARACTERS_DIR,
    CHAPTERS_DIR,
    PROJECT_IMAGES_DIR,
    ensureDir
} from './server/utils.js';

// Import route modules
import projectsRouter from './server/projects.js';
import chaptersRouter from './server/chapters.js';
import glossariesRouter from './server/glossaries.js';
import charactersRouter from './server/characters.js';
import presetsRouter from './server/presets.js';
import settingsRouter from './server/settings.js';
import translationMemoryRouter from './server/translationMemory.js';
import aiRouter from './server/ai.js';
import backupRouter from './server/backup.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve project images statically
app.use('/project_images', express.static(PROJECT_IMAGES_DIR));

// Serve frontend static files in production
app.use(express.static(path.join(__dirname, 'dist')));

// ===================
// Route Registration
// ===================

// Data CRUD routes
app.use('/api/projects', projectsRouter);
app.use('/api/chapters', chaptersRouter);
app.use('/api/glossaries', glossariesRouter);
app.use('/api/characters', charactersRouter);
app.use('/api/presets', presetsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/translation-memory', translationMemoryRouter);

// AI API routes (models, test-connection, translate, etc.)
app.use('/api', aiRouter);

// Backup & Restore routes
app.use('/api', backupRouter);



// Serve index.html for all routes (client-side routing)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// ===================
// Server Start
// ===================
app.listen(port, async () => {
    // Ensure data directories exist
    await ensureDir(DATA_DIR);
    await ensureDir(GLOSSARIES_DIR);
    await ensureDir(CHARACTERS_DIR);
    await ensureDir(CHAPTERS_DIR);
    await ensureDir(PROJECT_IMAGES_DIR);

    console.log(`Local data & AI proxy server listening on port ${port}`);
    console.log(`Data will be stored in: ${DATA_DIR}`);
});