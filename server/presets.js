/**
 * Presets API Routes
 */
import express from 'express';
import { readData, writeData, PRESETS_FILE } from './utils.js';

const router = express.Router();

// Get all presets
router.get('/', async (req, res) => res.json(await readData(PRESETS_FILE, [])));

// Create a new preset
router.post('/', async (req, res) => {
    const presets = await readData(PRESETS_FILE, []);
    const newPreset = req.body;
    presets.push(newPreset);
    await writeData(PRESETS_FILE, presets);
    res.status(201).json(newPreset);
});

// Delete a preset
router.delete('/:id', async (req, res) => {
    let presets = await readData(PRESETS_FILE, []);
    presets = presets.filter(p => p.id !== req.params.id);
    await writeData(PRESETS_FILE, presets);
    res.status(204).send();
});

export default router;
