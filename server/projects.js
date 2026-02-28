/**
 * Projects API Routes
 */
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { readData, writeData, PROJECTS_FILE, PROJECT_IMAGES_DIR } from './utils.js';

const router = express.Router();

// Get all projects
router.get('/', async (req, res) => res.json(await readData(PROJECTS_FILE, [])));

// Create a new project
router.post('/', async (req, res) => {
    const projects = await readData(PROJECTS_FILE, []);
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

    projects.push(newProject);
    await writeData(PROJECTS_FILE, projects);
    res.status(201).json(newProject);
});

// Update a project
router.put('/:id', async (req, res) => {
    let projects = await readData(PROJECTS_FILE, []);
    const projectIndex = projects.findIndex(p => p.id === req.params.id);

    if (projectIndex === -1) return res.status(404).json({ message: "Project not found" });

    const project = projects[projectIndex];
    const { profilePic, name, lastChapterId, lastChapterTitle } = req.body;

    // Handle name update
    if (name !== undefined) {
        project.name = name;
        project.updatedAt = Date.now();
    }

    // Handle last chapter read update
    if (lastChapterId !== undefined) {
        project.lastChapterId = lastChapterId;
        project.lastChapterTitle = lastChapterTitle || 'Untitled Chapter';
    }

    // Handle profile picture update
    if (profilePic && profilePic.startsWith('data:image/png;base64,')) {
        try {
            const base64Data = profilePic.replace(/^data:image\/png;base64,/, "");
            const imagePath = `${req.params.id}.png`;
            const fullPath = path.join(PROJECT_IMAGES_DIR, imagePath);
            await fs.writeFile(fullPath, base64Data, 'base64');

            project.profilePic = `/project_images/${imagePath}`;
            project.updatedAt = Date.now();
        } catch (error) {
            console.error("Failed to update project profile picture:", error);
            return res.status(500).json({ error: "Failed to save image" });
        }
    }

    await writeData(PROJECTS_FILE, projects);
    res.json(project);
});

// Delete a project
router.delete('/:id', async (req, res) => {
    let projects = await readData(PROJECTS_FILE, []);
    const projectToDelete = projects.find(p => p.id === req.params.id);

    if (projectToDelete && projectToDelete.profilePic) {
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
    res.status(204).send();
});

export default router;
