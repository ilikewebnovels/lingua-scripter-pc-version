/**
 * Translation Memory API Routes
 */
import express from 'express';
import { readData, writeData, TRANSLATION_MEMORY_FILE } from './utils.js';

const router = express.Router();

// Get translation memory
router.get('/', async (req, res) => {
    res.json(await readData(TRANSLATION_MEMORY_FILE, {}));
});

// Update translation memory
router.put('/', async (req, res) => {
    await writeData(TRANSLATION_MEMORY_FILE, req.body);
    res.json(req.body);
});

export default router;
