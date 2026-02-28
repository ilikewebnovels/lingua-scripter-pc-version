/**
 * Backup & Restore API Routes
 */
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import {
    DATA_DIR,
    GLOSSARIES_DIR,
    CHARACTERS_DIR,
    CHAPTERS_DIR,
    writeData,
    ensureDir
} from './utils.js';

const router = express.Router();

/**
 * POST /api/restore-full-backup
 * Restores a full backup, replacing all existing data
 * 
 * Expected body: {
 *   version: string,
 *   exportedAt: number,
 *   projects: Project[],
 *   chapters: Chapter[],
 *   glossaries: Record<string, GlossaryEntry[]>,
 *   characterDBs: Record<string, Character[]>
 * }
 */
router.post('/restore-full-backup', async (req, res) => {
    try {
        const { projects, chapters, glossaries, characterDBs } = req.body;

        // Validate required fields
        if (!projects || !Array.isArray(projects)) {
            return res.status(400).json({ error: 'Invalid backup: missing projects array' });
        }
        if (!chapters || !Array.isArray(chapters)) {
            return res.status(400).json({ error: 'Invalid backup: missing chapters array' });
        }

        // Step 1: Clear existing data
        console.log('Restoring full backup: Clearing existing data...');

        // Clear glossaries
        try {
            const glossaryFiles = await fs.readdir(GLOSSARIES_DIR);
            for (const file of glossaryFiles) {
                await fs.unlink(path.join(GLOSSARIES_DIR, file));
            }
        } catch (e) {
            if (e.code !== 'ENOENT') throw e;
        }

        // Clear characters
        try {
            const characterFiles = await fs.readdir(CHARACTERS_DIR);
            for (const file of characterFiles) {
                await fs.unlink(path.join(CHARACTERS_DIR, file));
            }
        } catch (e) {
            if (e.code !== 'ENOENT') throw e;
        }

        // Clear chapters (per-project files)
        try {
            await ensureDir(CHAPTERS_DIR);
            const chapterFiles = await fs.readdir(CHAPTERS_DIR);
            for (const file of chapterFiles) {
                await fs.unlink(path.join(CHAPTERS_DIR, file));
            }
        } catch (e) {
            if (e.code !== 'ENOENT') throw e;
        }

        // Step 2: Write new data
        console.log('Restoring full backup: Writing new data...');

        // Write projects
        await writeData('projects.json', projects);

        // Write chapters (grouped by projectId for per-project storage)
        const chaptersByProject = {};
        for (const chapter of chapters) {
            const projectId = chapter.projectId;
            if (!chaptersByProject[projectId]) {
                chaptersByProject[projectId] = [];
            }
            chaptersByProject[projectId].push(chapter);
        }

        await ensureDir(CHAPTERS_DIR);
        for (const [projectId, projectChapters] of Object.entries(chaptersByProject)) {
            const filePath = path.join(CHAPTERS_DIR, `${projectId}.json`);
            await fs.writeFile(filePath, JSON.stringify(projectChapters, null, 2), 'utf-8');
        }

        // Write glossaries
        await ensureDir(GLOSSARIES_DIR);
        if (glossaries) {
            for (const [projectId, glossaryEntries] of Object.entries(glossaries)) {
                const filePath = path.join(GLOSSARIES_DIR, `${projectId}.json`);
                await fs.writeFile(filePath, JSON.stringify(glossaryEntries, null, 2), 'utf-8');
            }
        }

        // Write character databases
        await ensureDir(CHARACTERS_DIR);
        if (characterDBs) {
            for (const [projectId, characters] of Object.entries(characterDBs)) {
                const filePath = path.join(CHARACTERS_DIR, `${projectId}.json`);
                await fs.writeFile(filePath, JSON.stringify(characters, null, 2), 'utf-8');
            }
        }

        console.log('Full backup restored successfully!');
        res.status(200).json({
            success: true,
            message: 'Full backup restored successfully',
            stats: {
                projects: projects.length,
                chapters: chapters.length,
                glossaries: Object.keys(glossaries || {}).length,
                characterDBs: Object.keys(characterDBs || {}).length
            }
        });
    } catch (error) {
        console.error('Full backup restore failed:', error);
        res.status(500).json({ error: `Failed to restore backup: ${error.message}` });
    }
});

export default router;
