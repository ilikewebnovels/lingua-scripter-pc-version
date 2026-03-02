/**
 * Export API Routes
 * Provides EPUB export for selected project chapters.
 */
import express from 'express';
import JSZip from 'jszip';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { PROJECT_IMAGES_DIR } from './utils.js';

const router = express.Router();

const escapeXml = (value = '') =>
    String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

const toXhtmlParagraphs = (text = '') => {
    const normalized = String(text).replace(/\r\n/g, '\n').trim();
    if (!normalized) return '<p></p>';

    return normalized
        .split(/\n{2,}/)
        .map((block) => `<p>${escapeXml(block).replace(/\n/g, '<br />')}</p>`)
        .join('\n');
};

const getMimeTypeFromFileName = (fileName) => {
    const ext = path.extname(fileName).toLowerCase();
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.png') return 'image/png';
    if (ext === '.gif') return 'image/gif';
    if (ext === '.webp') return 'image/webp';
    return null;
};

router.post('/export-epub', async (req, res) => {
    try {
        const { projectName, author, chapters, coverImage } = req.body;

        if (!Array.isArray(chapters) || chapters.length === 0) {
            return res.status(400).json({ error: 'No chapters provided for export.' });
        }

        const title = (projectName || 'Untitled Project').trim();
        const bookAuthor = (author || 'Unknown Author').trim();
        const sortedChapters = [...chapters].sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));
        const bookId = `urn:uuid:${randomUUID()}`;
        const nowIso = new Date().toISOString();

        const zip = new JSZip();
        zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

        zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

        zip.file('OEBPS/style.css', `body { font-family: serif; line-height: 1.55; margin: 5%; }
h1, h2 { margin: 0 0 1rem; }
p { text-align: justify; margin: 0 0 1rem; }
.cover { text-align: center; margin-top: 15%; }
.cover img { max-width: 90%; max-height: 80vh; }`);

        const manifestItems = [
            `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
            `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`,
            `<item id="css" href="style.css" media-type="text/css"/>`
        ];
        const spineItems = [];
        const navItems = [];
        const tocItems = [];

        let coverImageHref = null;
        let coverImageId = null;

        if (typeof coverImage === 'string' && coverImage.startsWith('/project_images/')) {
            const fileName = path.basename(coverImage);
            const mimeType = getMimeTypeFromFileName(fileName);

            if (mimeType) {
                const imagePath = path.join(PROJECT_IMAGES_DIR, fileName);
                try {
                    const imageBuffer = await fs.readFile(imagePath);
                    coverImageHref = `images/${fileName}`;
                    coverImageId = 'cover-image';
                    zip.file(`OEBPS/${coverImageHref}`, imageBuffer);
                    manifestItems.push(`<item id="${coverImageId}" href="${coverImageHref}" media-type="${mimeType}"/>`);
                } catch (readError) {
                    console.warn('[EPUB Export] Failed to read cover image:', readError.message);
                }
            }
        }

        if (coverImageHref) {
            zip.file('OEBPS/cover.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <title>${escapeXml(title)} - Cover</title>
    <link rel="stylesheet" type="text/css" href="style.css"/>
  </head>
  <body>
    <section class="cover">
      <img src="${escapeXml(coverImageHref)}" alt="Cover image"/>
    </section>
  </body>
</html>`);
            manifestItems.push(`<item id="cover-page" href="cover.xhtml" media-type="application/xhtml+xml"/>`);
            spineItems.push('<itemref idref="cover-page"/>');
        }

        sortedChapters.forEach((chapter, index) => {
            const chapterNum = chapter.chapterNumber || index + 1;
            const chapterTitle = chapter.title || `Chapter ${chapterNum}`;
            const chapterId = `chapter-${index + 1}`;
            const chapterHref = `${chapterId}.xhtml`;
            const chapterBody = toXhtmlParagraphs(chapter.translatedText || '');

            zip.file(`OEBPS/${chapterHref}`, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <title>${escapeXml(chapterTitle)}</title>
    <link rel="stylesheet" type="text/css" href="style.css"/>
  </head>
  <body>
    <h2>${escapeXml(chapterTitle)}</h2>
    ${chapterBody}
  </body>
</html>`);

            manifestItems.push(`<item id="${chapterId}" href="${chapterHref}" media-type="application/xhtml+xml"/>`);
            spineItems.push(`<itemref idref="${chapterId}"/>`);
            navItems.push(`<li><a href="${chapterHref}">${escapeXml(chapterTitle)}</a></li>`);
            tocItems.push(`<navPoint id="navPoint-${index + 1}" playOrder="${index + 1}">
      <navLabel><text>${escapeXml(chapterTitle)}</text></navLabel>
      <content src="${chapterHref}"/>
    </navPoint>`);
        });

        zip.file('OEBPS/nav.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <head><title>Table of Contents</title></head>
  <body>
    <nav epub:type="toc" id="toc">
      <h1>Contents</h1>
      <ol>
        ${navItems.join('\n        ')}
      </ol>
    </nav>
  </body>
</html>`);

        zip.file('OEBPS/toc.ncx', `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${escapeXml(bookId)}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(title)}</text></docTitle>
  <navMap>
    ${tocItems.join('\n    ')}
  </navMap>
</ncx>`);

        const coverMeta = coverImageId ? `<meta name="cover" content="${coverImageId}"/>` : '';
        zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:creator>${escapeXml(bookAuthor)}</dc:creator>
    <dc:language>en</dc:language>
    <dc:identifier id="BookId">${escapeXml(bookId)}</dc:identifier>
    <dc:date>${escapeXml(nowIso)}</dc:date>
    ${coverMeta}
  </metadata>
  <manifest>
    ${manifestItems.join('\n    ')}
  </manifest>
  <spine toc="ncx">
    ${spineItems.join('\n    ')}
  </spine>
</package>`);

        const epubBuffer = await zip.generateAsync({
            type: 'nodebuffer',
            mimeType: 'application/epub+zip',
            compression: 'DEFLATE',
            compressionOptions: { level: 9 }
        });

        const safeName = title.replace(/[^a-zA-Z0-9-_]/g, '_') || 'export';
        res.setHeader('Content-Type', 'application/epub+zip');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}.epub"`);
        res.send(epubBuffer);
    } catch (error) {
        console.error('EPUB export failed:', error);
        res.status(500).json({ error: error.message || 'Failed to generate EPUB.' });
    }
});

export default router;
