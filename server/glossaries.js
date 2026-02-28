/**
 * Glossary API Routes
 */
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { GLOSSARIES_DIR } from './utils.js';

const router = express.Router();

// Get all glossaries
router.get('/all', async (req, res) => {
    try {
        const allGlossaries = {};
        const files = await fs.readdir(GLOSSARIES_DIR);
        for (const file of files) {
            if (path.extname(file) === '.json') {
                const projectId = path.basename(file, '.json');
                const filePath = path.join(GLOSSARIES_DIR, file);
                const content = await fs.readFile(filePath, 'utf-8');
                allGlossaries[projectId] = JSON.parse(content);
            }
        }
        res.json(allGlossaries);
    } catch (error) {
        if (error.code === 'ENOENT') { // Directory doesn't exist yet
            res.json({});
        } else {
            res.status(500).json({ error: 'Failed to read glossaries' });
        }
    }
});

// Update glossary for a project
router.put('/:projectId', async (req, res) => {
    const { projectId } = req.params;
    const glossaryData = req.body;
    const filePath = path.join(GLOSSARIES_DIR, `${projectId}.json`);
    await fs.writeFile(filePath, JSON.stringify(glossaryData, null, 2), 'utf-8');
    res.status(200).json(glossaryData);
});

// Delete glossary for a project
router.delete('/:projectId', async (req, res) => {
    const { projectId } = req.params;
    const filePath = path.join(GLOSSARIES_DIR, `${projectId}.json`);
    try {
        await fs.unlink(filePath);
        res.status(204).send();
    } catch (error) {
        if (error.code === 'ENOENT') { // File already deleted
            res.status(204).send();
        } else {
            res.status(500).json({ error: 'Failed to delete glossary file' });
        }
    }
});

export default router;
