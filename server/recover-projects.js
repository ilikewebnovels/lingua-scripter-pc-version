/**
 * Recovery Script: Rebuild projects.json from orphaned per-project files
 *
 * The data/projects.json file was wiped (set to []), but the per-project
 * data files in data/chapters/, data/characters/, and data/glossaries/
 * still exist (each filename is a project UUID).
 *
 * This script reconstructs projects.json by:
 *   1. Collecting the union of UUIDs from those three directories.
 *   2. Reading each project's chapter file to derive createdAt/updatedAt
 *      (chapter files don't carry a project name, so a placeholder is used).
 *   3. Detecting matching <UUID>.png in data/project_images/.
 *   4. Writing the assembled array atomically to data/projects.json.
 *
 * Usage: node server/recover-projects.js
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const CHAPTERS_DIR = path.join(DATA_DIR, 'chapters');
const CHARACTERS_DIR = path.join(DATA_DIR, 'characters');
const GLOSSARIES_DIR = path.join(DATA_DIR, 'glossaries');
const PROJECT_IMAGES_DIR = path.join(DATA_DIR, 'project_images');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function listIds(dir, ext) {
    try {
        const entries = await fs.readdir(dir);
        return entries
            .filter(f => f.endsWith(ext))
            .map(f => f.slice(0, -ext.length))
            .filter(id => UUID_RE.test(id));
    } catch (e) {
        if (e.code === 'ENOENT') return [];
        throw e;
    }
}

async function deriveTimestamps(projectId) {
    const candidates = [
        path.join(CHAPTERS_DIR, `${projectId}.json`),
        path.join(CHARACTERS_DIR, `${projectId}.json`),
        path.join(GLOSSARIES_DIR, `${projectId}.json`),
        path.join(PROJECT_IMAGES_DIR, `${projectId}.png`),
    ];

    let earliest = Infinity;
    let latest = 0;
    let chapterCount = 0;
    let firstChapterTitle = null;

    for (const p of candidates) {
        try {
            const stat = await fs.stat(p);
            const ctime = stat.birthtimeMs || stat.ctimeMs;
            const mtime = stat.mtimeMs;
            if (ctime && ctime < earliest) earliest = ctime;
            if (mtime && mtime > latest) latest = mtime;
        } catch (e) {
            if (e.code !== 'ENOENT') throw e;
        }
    }

    // Try to refine timestamps and grab a sample chapter title from the chapter file
    try {
        const chapterPath = path.join(CHAPTERS_DIR, `${projectId}.json`);
        const content = await fs.readFile(chapterPath, 'utf-8');
        const chapters = JSON.parse(content);
        if (Array.isArray(chapters) && chapters.length > 0) {
            chapterCount = chapters.length;
            firstChapterTitle = chapters[0]?.title ?? null;
            for (const ch of chapters) {
                if (typeof ch.createdAt === 'number' && ch.createdAt < earliest) earliest = ch.createdAt;
                if (typeof ch.updatedAt === 'number' && ch.updatedAt > latest) latest = ch.updatedAt;
            }
        }
    } catch (e) {
        // Ignore - fall back to file mtimes
    }

    if (!isFinite(earliest)) earliest = Date.now();
    if (!latest) latest = earliest;

    return { createdAt: Math.floor(earliest), updatedAt: Math.floor(latest), chapterCount, firstChapterTitle };
}

async function hasProfilePic(projectId) {
    try {
        await fs.access(path.join(PROJECT_IMAGES_DIR, `${projectId}.png`));
        return true;
    } catch {
        return false;
    }
}

async function atomicWrite(filePath, content) {
    const tmp = `${filePath}.tmp`;
    await fs.writeFile(tmp, content, 'utf-8');
    await fs.rename(tmp, filePath);
}

async function main() {
    console.log('=== Project Recovery Script ===\n');

    // Confirm projects.json is actually empty/missing before clobbering
    let existing = [];
    try {
        const raw = await fs.readFile(PROJECTS_FILE, 'utf-8');
        existing = JSON.parse(raw);
        if (!Array.isArray(existing)) existing = [];
    } catch {
        existing = [];
    }

    if (existing.length > 0) {
        console.log(`projects.json already contains ${existing.length} entries. Aborting to avoid overwriting good data.`);
        console.log('If you really want to rebuild, delete or rename projects.json first.');
        process.exit(0);
    }

    console.log('1. Collecting project UUIDs from data subdirectories...');
    const [chapterIds, characterIds, glossaryIds, imageIds] = await Promise.all([
        listIds(CHAPTERS_DIR, '.json'),
        listIds(CHARACTERS_DIR, '.json'),
        listIds(GLOSSARIES_DIR, '.json'),
        listIds(PROJECT_IMAGES_DIR, '.png'),
    ]);

    const allIds = new Set([...chapterIds, ...characterIds, ...glossaryIds, ...imageIds]);
    console.log(`   Found ${allIds.size} unique project UUIDs.`);
    console.log(`     chapters:   ${chapterIds.length}`);
    console.log(`     characters: ${characterIds.length}`);
    console.log(`     glossaries: ${glossaryIds.length}`);
    console.log(`     images:     ${imageIds.length}`);

    console.log('\n2. Building project records...');
    const recovered = [];
    for (const id of allIds) {
        const { createdAt, updatedAt, chapterCount, firstChapterTitle } = await deriveTimestamps(id);
        const pic = await hasProfilePic(id);
        const shortId = id.slice(0, 8);
        const project = {
            id,
            name: `Recovered Project ${shortId}`,
            createdAt,
            updatedAt,
        };
        if (pic) project.profilePic = `/project_images/${id}.png`;
        recovered.push(project);
        const created = new Date(createdAt).toISOString().slice(0, 10);
        const updated = new Date(updatedAt).toISOString().slice(0, 10);
        const titleHint = firstChapterTitle ? ` first-chapter="${String(firstChapterTitle).slice(0, 40)}"` : '';
        console.log(`   - ${id}  chapters=${chapterCount}  created=${created}  updated=${updated}  pic=${pic ? 'yes' : 'no'}${titleHint}`);
    }

    // Sort newest first by updatedAt
    recovered.sort((a, b) => b.updatedAt - a.updatedAt);

    console.log(`\n3. Writing ${recovered.length} projects to projects.json (atomic)...`);
    await atomicWrite(PROJECTS_FILE, JSON.stringify(recovered, null, 2));

    console.log('\n=== Recovery Complete ===');
    console.log('Open the app and rename each project as needed (the original names could not be recovered).');
}

main().catch(err => {
    console.error('\nRecovery failed:', err);
    process.exit(1);
});
