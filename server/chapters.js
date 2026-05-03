/**
 * Chapters API Routes - Per-Project Storage
 */
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { CHAPTERS_DIR, ensureDir } from './utils.js';

const router = express.Router();

// Per-project async mutex. Concurrent PUT/POST/DELETE on the same project file
// would otherwise race (read → modify → write loop). All write paths funnel
// through `withProjectLock(projectId, fn)` so they serialise.
const projectLocks = new Map();
const withProjectLock = async (projectId, fn) => {
    const prev = projectLocks.get(projectId) || Promise.resolve();
    // Run fn after prev settles, regardless of whether prev rejected.
    const next = prev.then(fn, fn);
    // Future callers wait on the swallow-error tail so a single failure
    // doesn't poison the chain for everyone else.
    const tail = next.catch(() => {});
    projectLocks.set(projectId, tail);
    try {
        return await next;
    } finally {
        // Drop entry only if we're still the latest tail (i.e., no later caller chained on).
        if (projectLocks.get(projectId) === tail) {
            projectLocks.delete(projectId);
        }
    }
};

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

// Helper: Write chapters for a specific project (atomic: tmp+rename)
const writeProjectChapters = async (projectId, chapters) => {
    await ensureDir(CHAPTERS_DIR);
    const filePath = getChaptersFilePath(projectId);
    const tmpPath = `${filePath}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(chapters, null, 2), 'utf-8');
    await fs.rename(tmpPath, filePath);
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

        // Process each project (serialised per-project to avoid clobbering)
        for (const [projectId, projectNewChapters] of Object.entries(chaptersByProject)) {
            const savedChapters = await withProjectLock(projectId, async () => {
                const existingChapters = await readProjectChapters(projectId);

                const maxChapterNumber = existingChapters.reduce(
                    (max, ch) => Math.max(max, ch.chapterNumber || 0), 0
                );

                const assigned = projectNewChapters.map((chapter, index) => ({
                    ...chapter,
                    chapterNumber: maxChapterNumber + index + 1
                }));

                await writeProjectChapters(projectId, [...existingChapters, ...assigned]);
                return assigned;
            });
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
        const saved = await withProjectLock(projectId, async () => {
            const chapters = await readProjectChapters(projectId);
            const maxChapterNumber = chapters.reduce(
                (max, ch) => Math.max(max, ch.chapterNumber || 0), 0
            );
            newChapter.chapterNumber = maxChapterNumber + 1;
            chapters.push(newChapter);
            await writeProjectChapters(projectId, chapters);
            return newChapter;
        });
        res.status(201).json(saved);
    } catch (error) {
        console.error('Failed to create chapter:', error);
        res.status(500).json({ error: 'Failed to create chapter' });
    }
});

// Delete chapters by project ID (must be before /:id)
router.delete('/by-project/:projectId', async (req, res) => {
    const projectId = req.params.projectId;
    try {
        await withProjectLock(projectId, async () => {
            const filePath = getChaptersFilePath(projectId);
            try {
                await fs.unlink(filePath);
            } catch (e) {
                if (e.code !== 'ENOENT') throw e;
            }
        });
        res.status(204).send();
    } catch (error) {
        console.error('Failed to delete project chapters:', error);
        res.status(500).json({ error: 'Failed to delete chapters' });
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

        const result = await withProjectLock(projectId, async () => {
            const chapters = await readProjectChapters(projectId);
            const chapterIndex = chapters.findIndex(c => c.id === chapterId);
            if (chapterIndex === -1) return null;

            chapters[chapterIndex] = {
                ...chapters[chapterIndex],
                ...updates,
                updatedAt: Date.now()
            };
            await writeProjectChapters(projectId, chapters);
            return chapters[chapterIndex];
        });

        if (!result) {
            return res.status(404).json({ message: "Chapter not found" });
        }
        res.json(result);
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
                const removed = await withProjectLock(projectId, async () => {
                    const chapters = await readProjectChapters(projectId);
                    const filteredChapters = chapters.filter(c => c.id !== chapterId);
                    if (filteredChapters.length === chapters.length) return false;
                    await writeProjectChapters(projectId, filteredChapters);
                    return true;
                });
                if (removed) return res.status(204).send();
            }
        }

        res.status(204).send(); // Chapter not found, but that's okay for DELETE
    } catch (error) {
        console.error('Failed to delete chapter:', error);
        res.status(500).json({ error: 'Failed to delete chapter' });
    }
});

export default router;
