/**
 * Migration Script: chapters.json -> per-project files
 * 
 * This script migrates the monolithic chapters.json file to per-project files
 * in the data/chapters/ directory.
 * 
 * Usage: node server/migrate-chapters.js
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const CHAPTERS_FILE = path.join(DATA_DIR, 'chapters.json');
const CHAPTERS_DIR = path.join(DATA_DIR, 'chapters');
const BACKUP_FILE = path.join(DATA_DIR, 'chapters.json.backup');

async function migrate() {
    console.log('=== Chapters Migration Script ===\n');

    // Check if source file exists
    try {
        await fs.access(CHAPTERS_FILE);
    } catch {
        console.log('✓ No chapters.json found - nothing to migrate.');
        console.log('  (This is normal for fresh installations or already migrated systems)');
        return;
    }

    // Check if already migrated
    try {
        await fs.access(BACKUP_FILE);
        console.log('⚠ Migration already completed (backup file exists).');
        console.log('  If you want to re-run migration, delete chapters.json.backup first.');
        return;
    } catch {
        // Backup doesn't exist, proceed with migration
    }

    // Read existing chapters
    console.log('1. Reading chapters.json...');
    const content = await fs.readFile(CHAPTERS_FILE, 'utf-8');
    const chapters = JSON.parse(content);
    console.log(`   Found ${chapters.length} chapters`);

    if (chapters.length === 0) {
        console.log('✓ No chapters to migrate.');
        return;
    }

    // Group by projectId
    console.log('\n2. Grouping chapters by project...');
    const chaptersByProject = {};
    for (const chapter of chapters) {
        const projectId = chapter.projectId;
        if (!chaptersByProject[projectId]) {
            chaptersByProject[projectId] = [];
        }
        chaptersByProject[projectId].push(chapter);
    }
    console.log(`   Found ${Object.keys(chaptersByProject).length} projects`);

    // Create chapters directory
    console.log('\n3. Creating chapters directory...');
    await fs.mkdir(CHAPTERS_DIR, { recursive: true });
    console.log(`   Created: ${CHAPTERS_DIR}`);

    // Write per-project files
    console.log('\n4. Writing per-project files...');
    for (const [projectId, projectChapters] of Object.entries(chaptersByProject)) {
        const filePath = path.join(CHAPTERS_DIR, `${projectId}.json`);
        await fs.writeFile(filePath, JSON.stringify(projectChapters, null, 2), 'utf-8');
        console.log(`   ✓ ${projectId}.json (${projectChapters.length} chapters)`);
    }

    // Backup original file
    console.log('\n5. Creating backup...');
    await fs.rename(CHAPTERS_FILE, BACKUP_FILE);
    console.log(`   Renamed chapters.json -> chapters.json.backup`);

    console.log('\n=== Migration Complete! ===');
    console.log(`\nSummary:`);
    console.log(`  - Migrated ${chapters.length} chapters`);
    console.log(`  - Created ${Object.keys(chaptersByProject).length} project files`);
    console.log(`  - Original file backed up to: chapters.json.backup`);
    console.log(`\nYou can now start the server normally.`);
}

migrate().catch(error => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
});
