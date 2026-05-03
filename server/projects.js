/**
 * Projects API Routes
 */
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { readData, writeData, PROJECTS_FILE, PROJECT_IMAGES_DIR } from './utils.js';

const router = express.Router();

// Async mutex over the single projects.json file. Concurrent PUTs (e.g.
// rapid lastChapterId updates from chapter navigation) would otherwise
// race on read → modify → write and let an older write clobber a newer
// one on disk. All write paths chain through `withProjectsLock`.
let projectsLock = Promise.resolve();
const withProjectsLock = (fn) => {
    const next = projectsLock.then(fn, fn);
    projectsLock = next.catch(() => {});
    return next;
};

// Get all projects
router.get('/', async (req, res) => res.json(await readData(PROJECTS_FILE, [])));

// Create a new project
router.post('/', async (req, res) => {
    const { id, name, createdAt, updatedAt, profilePic } = req.body;

    const newProject = { id, name, createdAt, updatedAt };

    if (profilePic && profilePic.startsWith('data:image/png;base64,')) {
        try {
            const base64Data = profilePic.replace(/^data:image\/png;base64,/, "");
            const imagePath = `${id}.png`;
            const fullPath = path.join(PROJECT_IMAGES_DIR, imagePath);
            await fs.writeFile(fullPath, base64Data, 'base64');
            newProject.profilePic = `/project_images/${imagePath}`;
        } catch (error) {
            console.error("Failed to save project profile picture:", error);
            // Continue without a profile picture if saving fails
        }
    }

    await withProjectsLock(async () => {
        const projects = await readData(PROJECTS_FILE, []);
        projects.push(newProject);
        await writeData(PROJECTS_FILE, projects);
    });
    res.status(201).json(newProject);
});

// Update a project
router.put('/:id', async (req, res) => {
    const { profilePic, name, lastChapterId, lastChapterTitle } = req.body;

    // Profile-picture file write is independent of projects.json and is fine
    // to do outside the lock. We only record the resulting URL so the in-lock
    // read/modify/write knows what to persist.
    let profilePicUrl;
    if (profilePic && profilePic.startsWith('data:image/png;base64,')) {
        try {
            const base64Data = profilePic.replace(/^data:image\/png;base64,/, "");
            const imagePath = `${req.params.id}.png`;
            const fullPath = path.join(PROJECT_IMAGES_DIR, imagePath);
            await fs.writeFile(fullPath, base64Data, 'base64');
            profilePicUrl = `/project_images/${imagePath}`;
        } catch (error) {
            console.error("Failed to update project profile picture:", error);
            return res.status(500).json({ error: "Failed to save image" });
        }
    }

    try {
        const updated = await withProjectsLock(async () => {
            const projects = await readData(PROJECTS_FILE, []);
            const projectIndex = projects.findIndex(p => p.id === req.params.id);
            if (projectIndex === -1) return null;

            const project = projects[projectIndex];

            if (name !== undefined) {
                project.name = name;
                project.updatedAt = Date.now();
            }
            if (lastChapterId !== undefined) {
                project.lastChapterId = lastChapterId;
                project.lastChapterTitle = lastChapterTitle || 'Untitled Chapter';
            }
            if (profilePicUrl) {
                project.profilePic = profilePicUrl;
                project.updatedAt = Date.now();
            }

            await writeData(PROJECTS_FILE, projects);
            return project;
        });

        if (!updated) return res.status(404).json({ message: "Project not found" });
        res.json(updated);
    } catch (error) {
        console.error("Failed to update project:", error);
        res.status(500).json({ error: "Failed to update project" });
    }
});

// Delete a project
router.delete('/:id', async (req, res) => {
    const removed = await withProjectsLock(async () => {
        let projects = await readData(PROJECTS_FILE, []);
        const projectToDelete = projects.find(p => p.id === req.params.id);
        if (!projectToDelete) return null;

        if (projectToDelete.profilePic) {
            try {
                const fileName = path.basename(projectToDelete.profilePic);
                const fullPath = path.join(PROJECT_IMAGES_DIR, fileName);
                await fs.unlink(fullPath);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    console.error("Failed to delete project profile picture:", error);
                }
            }
        }

        projects = projects.filter(p => p.id !== req.params.id);
        await writeData(PROJECTS_FILE, projects);
        return projectToDelete;
    });

    res.status(204).send();
});

export default router;
