/**
 * Characters API Routes
 */
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { CHARACTERS_DIR } from './utils.js';

const router = express.Router();

// Get all character databases
router.get('/all', async (req, res) => {
    try {
        const allCharacterDBs = {};
        const files = await fs.readdir(CHARACTERS_DIR);
        for (const file of files) {
            if (path.extname(file) === '.json') {
                const projectId = path.basename(file, '.json');
                const filePath = path.join(CHARACTERS_DIR, file);
                const content = await fs.readFile(filePath, 'utf-8');
                allCharacterDBs[projectId] = JSON.parse(content);
            }
        }
        res.json(allCharacterDBs);
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.json({});
        } else {
            res.status(500).json({ error: 'Failed to read character databases' });
        }
    }
});

// Update character database for a project
router.put('/:projectId', async (req, res) => {
    const { projectId } = req.params;
    const characterData = req.body;
    const filePath = path.join(CHARACTERS_DIR, `${projectId}.json`);
    await fs.writeFile(filePath, JSON.stringify(characterData, null, 2), 'utf-8');
    res.status(200).json(characterData);
});

// Delete character database for a project
router.delete('/:projectId', async (req, res) => {
    const { projectId } = req.params;
    const filePath = path.join(CHARACTERS_DIR, `${projectId}.json`);
    try {
        await fs.unlink(filePath);
        res.status(204).send();
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.status(204).send();
        } else {
            res.status(500).json({ error: 'Failed to delete character database file' });
        }
    }
});

export default router;
