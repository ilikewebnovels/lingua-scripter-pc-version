/**
 * Export API Routes (EPUB)
 */
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import JSZip from 'jszip';
import { PROJECT_IMAGES_DIR } from './utils.js';

const router = express.Router();

const escapeXml = (str = '') =>
    String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

const sanitizeFileName = (name) =>
    String(name || 'export').replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 80) || 'export';

const paragraphsToXhtml = (text) => {
    const safe = escapeXml(text || '');
    // Split on blank lines into paragraphs; preserve single line breaks as <br/>.
    const paragraphs = safe.split(/\r?\n\s*\r?\n/);
    return paragraphs
        .map(p => `<p>${p.replace(/\r?\n/g, '<br/>')}</p>`)
        .join('\n');
};

const chapterXhtml = (title, body) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en">
<head>
  <meta charset="utf-8"/>
  <title>${escapeXml(title)}</title>
  <style>
    body { font-family: serif; line-height: 1.5; }
    h1 { text-align: center; margin: 1em 0; }
    p { text-indent: 1.5em; margin: 0.5em 0; text-align: justify; }
  </style>
</head>
<body>
  <h1>${escapeXml(title)}</h1>
  ${body}
</body>
</html>`;

const coverXhtml = (coverHref) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Cover</title>
  <style>
    body { margin: 0; padding: 0; text-align: center; }
    img { max-width: 100%; max-height: 100vh; }
  </style>
</head>
<body epub:type="cover">
  <div><img src="${coverHref}" alt="Cover"/></div>
</body>
</html>`;

/**
 * POST /api/export-epub
 * Body: { projectName, author?, chapters: [{ chapterNumber, title, translatedText }], coverImage?: "/project_images/<file>" | null }
 */
router.post('/export-epub', async (req, res) => {
    try {
        const { projectName, author, chapters, coverImage } = req.body || {};

        if (!projectName || typeof projectName !== 'string') {
            return res.status(400).json({ error: 'projectName is required' });
        }
        if (!Array.isArray(chapters) || chapters.length === 0) {
            return res.status(400).json({ error: 'chapters array is required and must be non-empty' });
        }

        const zip = new JSZip();

        // 1. mimetype - MUST be first entry and stored uncompressed
        zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

        // 2. META-INF/container.xml
        zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

        // 3. Optional cover image
        let coverManifest = '';
        let coverSpineRef = '';
        let coverNavLi = '';
        let coverMeta = '';
        let coverImageProps = '';
        if (coverImage && typeof coverImage === 'string' && coverImage.startsWith('/project_images/')) {
            try {
                const fileName = path.basename(coverImage);
                const fullPath = path.join(PROJECT_IMAGES_DIR, fileName);
                const data = await fs.readFile(fullPath);
                const ext = path.extname(fileName).toLowerCase();
                const mediaType =
                    ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                    ext === '.gif' ? 'image/gif' :
                    ext === '.webp' ? 'image/webp' :
                    'image/png';
                const imgHref = `images/${fileName}`;
                zip.file(`OEBPS/${imgHref}`, data);
                zip.file('OEBPS/cover.xhtml', coverXhtml(imgHref));

                coverManifest = `
    <item id="cover-image" href="${imgHref}" media-type="${mediaType}" properties="cover-image"/>
    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>`;
                coverSpineRef = `\n    <itemref idref="cover" linear="yes"/>`;
                coverNavLi = `\n      <li><a href="cover.xhtml">Cover</a></li>`;
                coverMeta = `\n    <meta name="cover" content="cover-image"/>`;
                coverImageProps = '';
            } catch (err) {
                console.warn('[export-epub] Cover image not found, skipping:', err.message);
            }
        }

        // 4. Chapters
        const chapterEntries = chapters.map((ch, i) => {
            const num = ch.chapterNumber ?? (i + 1);
            const rawTitle = ch.title ? `Chapter ${num}: ${ch.title}` : `Chapter ${num}`;
            const fileName = `chapter-${String(i + 1).padStart(4, '0')}.xhtml`;
            const id = `chap${i + 1}`;
            const body = paragraphsToXhtml(ch.translatedText || '');
            zip.file(`OEBPS/${fileName}`, chapterXhtml(rawTitle, body));
            return { id, fileName, title: rawTitle };
        });

        const manifestItems = chapterEntries
            .map(c => `    <item id="${c.id}" href="${c.fileName}" media-type="application/xhtml+xml"/>`)
            .join('\n');

        const spineItems = chapterEntries
            .map(c => `    <itemref idref="${c.id}"/>`)
            .join('\n');

        const navItems = chapterEntries
            .map(c => `      <li><a href="${c.fileName}">${escapeXml(c.title)}</a></li>`)
            .join('\n');

        // 5. nav.xhtml (EPUB 3 navigation document)
        zip.file('OEBPS/nav.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Table of Contents</title>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Table of Contents</h1>
    <ol>${coverNavLi}
${navItems}
    </ol>
  </nav>
</body>
</html>`);

        // 6. toc.ncx (legacy, helps EPUB 2 readers)
        const ncxNavPoints = chapterEntries
            .map((c, idx) => `    <navPoint id="navpoint-${idx + 1}" playOrder="${idx + 1}">
      <navLabel><text>${escapeXml(c.title)}</text></navLabel>
      <content src="${c.fileName}"/>
    </navPoint>`)
            .join('\n');

        const bookId = `urn:uuid:${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

        zip.file('OEBPS/toc.ncx', `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${bookId}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(projectName)}</text></docTitle>
  <navMap>
${ncxNavPoints}
  </navMap>
</ncx>`);

        // 7. content.opf
        const modified = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
        zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="en">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${bookId}</dc:identifier>
    <dc:title>${escapeXml(projectName)}</dc:title>
    <dc:creator>${escapeXml(author || 'Unknown Author')}</dc:creator>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">${modified}</meta>${coverMeta}
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>${coverManifest}
${manifestItems}
  </manifest>
  <spine toc="ncx">${coverSpineRef}
${spineItems}
  </spine>
</package>`);

        const buffer = await zip.generateAsync({
            type: 'nodebuffer',
            mimeType: 'application/epub+zip',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        const downloadName = `${sanitizeFileName(projectName)}.epub`;
        res.setHeader('Content-Type', 'application/epub+zip');
        res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
        res.setHeader('Content-Length', buffer.length);
        res.send(buffer);
    } catch (error) {
        console.error('[export-epub] Failed to generate EPUB:', error);
        res.status(500).json({ error: error.message || 'Failed to generate EPUB' });
    }
});

export default router;
