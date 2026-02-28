/**
 * Chapters API Routes - Per-Project Storage
 */
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { CHAPTERS_DIR, ensureDir } from './utils.js';

const router = express.Router();

// Helper: Get file path for a project's chapters
const getChaptersFilePath = (projectId) => path.join(CHAPTERS_DIR, `${projectId}.json`);

// Helper: Read chapters for a specific project
const readProjectChapters = async (projectId) => {
    const filePath = getChaptersFilePath(projectId);
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
};

// Helper: Write chapters for a specific project
const writeProjectChapters = async (projectId, chapters) => {
    await ensureDir(CHAPTERS_DIR);
    const filePath = getChaptersFilePath(projectId);
    await fs.writeFile(filePath, JSON.stringify(chapters, null, 2), 'utf-8');
};

// Get all chapters (for backward compatibility / backup restore)
router.get('/', async (req, res) => {
    try {
        const allChapters = [];
        await ensureDir(CHAPTERS_DIR);
        const files = await fs.readdir(CHAPTERS_DIR);
        for (const file of files) {
            if (path.extname(file) === '.json') {
                const filePath = path.join(CHAPTERS_DIR, file);
                const content = await fs.readFile(filePath, 'utf-8');
                const chapters = JSON.parse(content);
                allChapters.push(...chapters);
            }
        }
        res.json(allChapters);
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.json([]);
        } else {
            console.error('Failed to read all chapters:', error);
            res.status(500).json({ error: 'Failed to read chapters' });
        }
    }
});

// Get chapters for a specific project
router.get('/project/:projectId', async (req, res) => {
    try {
        const chapters = await readProjectChapters(req.params.projectId);
        res.json(chapters);
    } catch (error) {
        console.error('Failed to read project chapters:', error);
        res.status(500).json({ error: 'Failed to read chapters' });
    }
});

// Batch create chapters (for import - must be before /:id routes)
router.post('/batch', async (req, res) => {
    try {
        const { chapters: newChapters } = req.body;

        if (!Array.isArray(newChapters) || newChapters.length === 0) {
            return res.status(400).json({ error: 'chapters array is required' });
        }

        // Group new chapters by projectId
        const chaptersByProject = {};
        for (const chapter of newChapters) {
            const projectId = chapter.projectId;
            if (!chaptersByProject[projectId]) {
                chaptersByProject[projectId] = [];
            }
            chaptersByProject[projectId].push(chapter);
        }

        const allSavedChapters = [];

        // Process each project
        for (const [projectId, projectNewChapters] of Object.entries(chaptersByProject)) {
            const existingChapters = await readProjectChapters(projectId);

            // Get max chapter number for this project
            const maxChapterNumber = existingChapters.reduce(
                (max, ch) => Math.max(max, ch.chapterNumber || 0), 0
            );

            // Assign chapter numbers
            const savedChapters = projectNewChapters.map((chapter, index) => ({
                ...chapter,
                chapterNumber: maxChapterNumber + index + 1
            }));

            // Write back
            await writeProjectChapters(projectId, [...existingChapters, ...savedChapters]);
            allSavedChapters.push(...savedChapters);
        }

        res.status(201).json({ chapters: allSavedChapters, count: allSavedChapters.length });
    } catch (error) {
        console.error('Batch chapter save failed:', error);
        res.status(500).json({ error: `Failed to save chapters: ${error.message}` });
    }
});

// Create a new chapter
router.post('/', async (req, res) => {
    try {
        const newChapter = req.body;
        const projectId = newChapter.projectId;
        const chapters = await readProjectChapters(projectId);

        // Auto-increment chapter number
        const maxChapterNumber = chapters.reduce(
            (max, ch) => Math.max(max, ch.chapterNumber || 0), 0
        );
        newChapter.chapterNumber = maxChapterNumber + 1;

        chapters.push(newChapter);
        await writeProjectChapters(projectId, chapters);
        res.status(201).json(newChapter);
    } catch (error) {
        console.error('Failed to create chapter:', error);
        res.status(500).json({ error: 'Failed to create chapter' });
    }
});

// Delete chapters by project ID (must be before /:id)
router.delete('/by-project/:projectId', async (req, res) => {
    try {
        const filePath = getChaptersFilePath(req.params.projectId);
        await fs.unlink(filePath);
        res.status(204).send();
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.status(204).send(); // Already gone
        } else {
            console.error('Failed to delete project chapters:', error);
            res.status(500).json({ error: 'Failed to delete chapters' });
        }
    }
});

// Update a chapter
router.put('/:id', async (req, res) => {
    try {
        const chapterId = req.params.id;
        const updates = req.body;

        // We need projectId to find the right file
        // Try to get it from the request body, or search all files
        let projectId = updates.projectId;

        if (!projectId) {
            // Search through all project files to find this chapter
            await ensureDir(CHAPTERS_DIR);
            const files = await fs.readdir(CHAPTERS_DIR);
            for (const file of files) {
                if (path.extname(file) === '.json') {
                    const filePath = path.join(CHAPTERS_DIR, file);
                    const content = await fs.readFile(filePath, 'utf-8');
                    const chapters = JSON.parse(content);
                    const found = chapters.find(c => c.id === chapterId);
                    if (found) {
                        projectId = path.basename(file, '.json');
                        break;
                    }
                }
            }
        }

        if (!projectId) {
            return res.status(404).json({ message: "Chapter not found" });
        }

        const chapters = await readProjectChapters(projectId);
        const chapterIndex = chapters.findIndex(c => c.id === chapterId);

        if (chapterIndex === -1) {
            return res.status(404).json({ message: "Chapter not found" });
        }

        chapters[chapterIndex] = {
            ...chapters[chapterIndex],
            ...updates,
            updatedAt: Date.now()
        };

        await writeProjectChapters(projectId, chapters);
        res.json(chapters[chapterIndex]);
    } catch (error) {
        console.error('Failed to update chapter:', error);
        res.status(500).json({ error: 'Failed to update chapter' });
    }
});

// Delete a chapter
router.delete('/:id', async (req, res) => {
    try {
        const chapterId = req.params.id;

        // Search through all project files to find and delete this chapter
        await ensureDir(CHAPTERS_DIR);
        const files = await fs.readdir(CHAPTERS_DIR);

        for (const file of files) {
            if (path.extname(file) === '.json') {
                const projectId = path.basename(file, '.json');
                const chapters = await readProjectChapters(projectId);
                const filteredChapters = chapters.filter(c => c.id !== chapterId);

                if (filteredChapters.length !== chapters.length) {
                    await writeProjectChapters(projectId, filteredChapters);
                    return res.status(204).send();
                }
            }
        }

        res.status(204).send(); // Chapter not found, but that's okay for DELETE
    } catch (error) {
        console.error('Failed to delete chapter:', error);
        res.status(500).json({ error: 'Failed to delete chapter' });
    }
});

export default router;
