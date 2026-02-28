import React, { useState, useRef, useCallback } from 'react';
import { LoadingSpinner } from './icons';
import JSZip from 'jszip';

// Icons
const UploadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>;
const FileIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>;
const CheckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>;
const CloseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;

interface ParsedChapter {
    title: string;
    originalText: string;
    translatedText: string;
    selected: boolean;
}

interface ImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    existingChapterNumbers: number[]; // For conflict detection
    onImportChapters: (
        chapters: { title: string; originalText: string; translatedText: string; projectId: string }[],
        onProgress?: (current: number, total: number) => void
    ) => Promise<any>;
}

/**
 * Strip HTML tags and decode HTML entities
 */
function stripHtml(html: string): string {
    if (!html) return '';

    // Remove script and style elements
    let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

    // Replace block elements with newlines
    text = text.replace(/<\/(p|div|h[1-6]|li|tr|br)[^>]*>/gi, '\n');
    text = text.replace(/<br\s*\/?>/gi, '\n');

    // Remove all remaining tags
    text = text.replace(/<[^>]+>/g, '');

    // Decode common HTML entities
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    text = text.replace(/&apos;/g, "'");

    // Clean up excessive whitespace
    text = text.replace(/\r\n/g, '\n');
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.trim();

    return text;
}

/**
 * Parse EPUB file into chapters (client-side)
 */
async function parseEpub(arrayBuffer: ArrayBuffer): Promise<{ title: string; originalText: string; translatedText: string }[]> {
    const chapters: { title: string; originalText: string; translatedText: string }[] = [];

    const zip = await JSZip.loadAsync(arrayBuffer);

    // Find the content.opf file (package file)
    let opfPath: string | null = null;
    let opfContent: string | null = null;

    // First, check META-INF/container.xml for the OPF location
    const containerFile = zip.file('META-INF/container.xml');
    if (containerFile) {
        const containerXml = await containerFile.async('text');
        const rootfileMatch = containerXml.match(/full-path="([^"]+\.opf)"/i);
        if (rootfileMatch) {
            opfPath = rootfileMatch[1];
        }
    }

    // If not found, search for .opf files
    if (!opfPath) {
        for (const path of Object.keys(zip.files)) {
            if (path.endsWith('.opf')) {
                opfPath = path;
                break;
            }
        }
    }

    if (opfPath) {
        const opfFile = zip.file(opfPath);
        if (opfFile) {
            opfContent = await opfFile.async('text');
        }
    }

    // Get the base directory of the OPF file
    const opfDir = opfPath ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

    // Extract spine order from OPF
    const spineItems: string[] = [];
    if (opfContent) {
        // Get manifest items
        const manifestItems: Record<string, string> = {};
        const manifestRegex = /<item[^>]+id="([^"]+)"[^>]+href="([^"]+)"[^>]*>/gi;
        let match;
        while ((match = manifestRegex.exec(opfContent)) !== null) {
            manifestItems[match[1]] = match[2];
        }

        // Also try alternate order (href before id)
        const manifestRegex2 = /<item[^>]+href="([^"]+)"[^>]+id="([^"]+)"[^>]*>/gi;
        while ((match = manifestRegex2.exec(opfContent)) !== null) {
            manifestItems[match[2]] = match[1];
        }

        // Get spine order
        const spineRegex = /<itemref[^>]+idref="([^"]+)"[^>]*>/gi;
        while ((match = spineRegex.exec(opfContent)) !== null) {
            if (manifestItems[match[1]]) {
                spineItems.push(manifestItems[match[1]]);
            }
        }
    }

    // Process files in spine order, or all xhtml/html files if no spine
    const filesToProcess = spineItems.length > 0
        ? spineItems.map(href => opfDir + href)
        : Object.keys(zip.files).filter(path =>
            path.match(/\.(xhtml|html|htm)$/i) &&
            !path.includes('toc') &&
            !path.includes('nav')
        ).sort();

    let chapterNumber = 1;

    for (const filePath of filesToProcess) {
        const file = zip.file(filePath);
        if (!file) continue;

        const content = await file.async('text');
        const text = stripHtml(content);

        // Skip empty or very short content (likely nav/toc pages)
        if (text.length < 100) continue;

        // Try to extract title from content
        let title = `Chapter ${chapterNumber}`;

        // Look for h1, h2, or title tags
        const titleMatch = content.match(/<(h1|h2|title)[^>]*>([^<]+)<\/(h1|h2|title)>/i);
        if (titleMatch && titleMatch[2].trim()) {
            title = titleMatch[2].trim();
        }

        chapters.push({
            title,
            originalText: text,
            translatedText: ''
        });

        chapterNumber++;
    }

    return chapters;
}

/**
 * Parse TXT file into chapters (client-side)
 */
async function parseTxt(text: string): Promise<{ title: string; originalText: string; translatedText: string }[]> {
    const chapters: { title: string; originalText: string; translatedText: string }[] = [];

    // Try to split by chapter patterns
    const chapterPatterns = [
        /\n\s*(Chapter\s+\d+[^\n]*)\n/gi,
        /\n\s*(CHAPTER\s+\d+[^\n]*)\n/gi,
        /\n\s*(第[一二三四五六七八九十百千\d]+章[^\n]*)\n/gi,
        /\n\s*(Part\s+\d+[^\n]*)\n/gi
    ];

    let splitPoints: { index: number; title: string }[] = [];

    for (const pattern of chapterPatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            splitPoints.push({
                index: match.index,
                title: match[1].trim()
            });
        }
    }

    if (splitPoints.length > 0) {
        // Sort by index
        splitPoints.sort((a, b) => a.index - b.index);

        // Add chapters based on split points
        for (let i = 0; i < splitPoints.length; i++) {
            const start = splitPoints[i].index;
            const end = i < splitPoints.length - 1 ? splitPoints[i + 1].index : text.length;
            const chapterText = text.substring(start, end).trim();

            if (chapterText.length > 50) {
                chapters.push({
                    title: splitPoints[i].title,
                    originalText: chapterText,
                    translatedText: ''
                });
            }
        }

        // If there's content before the first chapter
        if (splitPoints[0].index > 100) {
            const prologueText = text.substring(0, splitPoints[0].index).trim();
            if (prologueText.length > 100) {
                chapters.unshift({
                    title: 'Prologue',
                    originalText: prologueText,
                    translatedText: ''
                });
            }
        }
    } else {
        // No chapter markers found - import as single chapter
        chapters.push({
            title: 'Imported Text Content',
            originalText: text.trim(),
            translatedText: ''
        });
    }

    return chapters;
}

const ImportModal: React.FC<ImportModalProps> = ({
    isOpen,
    onClose,
    projectId,
    existingChapterNumbers,
    onImportChapters
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filename, setFilename] = useState<string | null>(null);
    const [chapters, setChapters] = useState<ParsedChapter[]>([]);
    const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
    const [rangeStart, setRangeStart] = useState<string>('');
    const [rangeEnd, setRangeEnd] = useState<string>('');
    const [skippedCount, setSkippedCount] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const resetState = useCallback(() => {
        setIsDragging(false);
        setIsProcessing(false);
        setIsImporting(false);
        setError(null);
        setFilename(null);
        setChapters([]);
        setImportProgress({ current: 0, total: 0 });
        setRangeStart('');
        setRangeEnd('');
        setSkippedCount(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, []);

    const handleClose = useCallback(() => {
        resetState();
        onClose();
    }, [onClose, resetState]);

    const processFile = useCallback(async (file: File) => {
        setIsProcessing(true);
        setError(null);
        setFilename(file.name);
        setChapters([]);

        try {
            const ext = file.name.toLowerCase().split('.').pop();
            let parsedChapters: { title: string; originalText: string; translatedText: string }[] = [];

            if (ext === 'epub') {
                const arrayBuffer = await file.arrayBuffer();
                parsedChapters = await parseEpub(arrayBuffer);
            } else if (ext === 'txt') {
                const text = await file.text();
                parsedChapters = await parseTxt(text);
            } else {
                throw new Error('Unsupported file type. Please use EPUB or TXT files.');
            }

            if (parsedChapters.length === 0) {
                throw new Error('No chapters could be extracted from the file');
            }

            // Add selected state to each chapter
            const chaptersWithSelection: ParsedChapter[] = parsedChapters.map(ch => ({
                ...ch,
                selected: true
            }));

            setChapters(chaptersWithSelection);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to process file');
        } finally {
            setIsProcessing(false);
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const file = e.dataTransfer.files[0];
        if (file) {
            const ext = file.name.toLowerCase().split('.').pop();
            if (['epub', 'txt'].includes(ext || '')) {
                processFile(file);
            } else {
                setError('Please drop an EPUB or TXT file');
            }
        }
    }, [processFile]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            processFile(file);
        }
    }, [processFile]);

    const toggleChapter = useCallback((index: number) => {
        setChapters(prev => prev.map((ch, i) =>
            i === index ? { ...ch, selected: !ch.selected } : ch
        ));
    }, []);

    const toggleAll = useCallback(() => {
        const allSelected = chapters.every(ch => ch.selected);
        setChapters(prev => prev.map(ch => ({ ...ch, selected: !allSelected })));
    }, [chapters]);

    const updateChapterTitle = useCallback((index: number, title: string) => {
        setChapters(prev => prev.map((ch, i) =>
            i === index ? { ...ch, title } : ch
        ));
    }, []);

    // Select range of chapters by index
    const selectRange = useCallback(() => {
        const start = parseInt(rangeStart);
        const end = parseInt(rangeEnd);
        if (isNaN(start) || isNaN(end) || start < 1 || end < start) return;

        setChapters(prev => prev.map((ch, i) => ({
            ...ch,
            selected: (i + 1) >= start && (i + 1) <= end
        })));
    }, [rangeStart, rangeEnd]);

    const handleImport = useCallback(async () => {
        const selectedChapters = chapters.filter(ch => ch.selected);
        if (selectedChapters.length === 0) return;

        setIsImporting(true);
        setError(null);
        setSkippedCount(0);

        // Filter out chapters that would conflict with existing chapter numbers
        // We match by checking if the parsed chapter index+1 conflicts with existing
        const chaptersToImport: { title: string; originalText: string; translatedText: string; projectId: string }[] = [];
        let skipped = 0;

        selectedChapters.forEach((ch, idx) => {
            // The chapter number will be assigned sequentially starting from highest existing + 1
            // So we check if this parsed chapter's "position" in the sequence would conflict
            // Since server assigns new numbers, we skip if title suggests same chapter
            // Actually, we need to extract chapter number from title if possible
            const titleMatch = ch.title.match(/(?:Chapter|Ch\.?|Part)\s*(\d+)/i) || ch.title.match(/第([一二三四五六七八九十百千\d]+)章/);
            let chapterNum: number | null = null;

            if (titleMatch) {
                // Try to parse number
                const numStr = titleMatch[1];
                const parsed = parseInt(numStr);
                if (!isNaN(parsed)) {
                    chapterNum = parsed;
                }
            }

            // Skip if this chapter number already exists
            if (chapterNum !== null && existingChapterNumbers.includes(chapterNum)) {
                skipped++;
            } else {
                chaptersToImport.push({
                    title: ch.title,
                    originalText: ch.originalText,
                    translatedText: ch.translatedText,
                    projectId
                });
            }
        });

        setSkippedCount(skipped);
        setImportProgress({ current: 0, total: chaptersToImport.length });

        if (chaptersToImport.length === 0) {
            setError('All selected chapters already exist in this project (matched by chapter number in title).');
            setIsImporting(false);
            return;
        }

        try {
            await onImportChapters(chaptersToImport, (current, total) => {
                setImportProgress({ current, total });
            });

            handleClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to import chapters');
            setIsImporting(false);
        }
    }, [chapters, projectId, existingChapterNumbers, onImportChapters, handleClose]);

    const selectedCount = chapters.filter(ch => ch.selected).length;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-[var(--border-primary)]">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-[var(--border-primary)]">
                    <h2 className="text-2xl font-bold text-[var(--text-primary)]">Import Chapters</h2>
                    <button
                        onClick={handleClose}
                        className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                        aria-label="Close"
                    >
                        <CloseIcon />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* File Upload Zone */}
                    {chapters.length === 0 && !isProcessing && (
                        <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`
                relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all
                ${isDragging
                                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                                    : 'border-[var(--border-primary)] hover:border-[var(--accent-primary)] hover:bg-[var(--bg-tertiary)]'
                                }
              `}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".epub,.txt"
                                onChange={handleFileSelect}
                                className="hidden"
                            />
                            <div className="flex flex-col items-center gap-4 text-[var(--text-secondary)]">
                                <UploadIcon />
                                <div>
                                    <p className="text-lg font-semibold text-[var(--text-primary)]">
                                        {isDragging ? 'Drop your file here' : 'Drag & drop a file here'}
                                    </p>
                                    <p className="text-sm mt-1">or click to browse</p>
                                </div>
                                <div className="flex gap-2 mt-2">
                                    <span className="px-3 py-1 text-xs font-medium bg-[var(--bg-tertiary)] rounded-full">EPUB</span>
                                    <span className="px-3 py-1 text-xs font-medium bg-[var(--bg-tertiary)] rounded-full">TXT</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Processing State */}
                    {isProcessing && (
                        <div className="flex flex-col items-center justify-center py-16 gap-4">
                            <LoadingSpinner />
                            <p className="text-[var(--text-secondary)]">Processing {filename}...</p>
                            <p className="text-sm text-[var(--text-secondary)]">Extracting chapters from your file</p>
                        </div>
                    )}

                    {/* Error State */}
                    {error && (
                        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                            <p className="text-red-400 font-medium">{error}</p>
                            <button
                                onClick={resetState}
                                className="mt-2 text-sm text-[var(--accent-primary)] hover:underline"
                            >
                                Try again
                            </button>
                        </div>
                    )}

                    {/* Chapters Preview */}
                    {chapters.length > 0 && !isProcessing && (
                        <div className="space-y-4">
                            {/* File info */}
                            <div className="flex items-center gap-3 p-3 bg-[var(--bg-tertiary)] rounded-lg">
                                <FileIcon />
                                <div className="flex-1">
                                    <p className="font-medium text-[var(--text-primary)]">{filename}</p>
                                    <p className="text-sm text-[var(--text-secondary)]">{chapters.length} chapters found</p>
                                </div>
                                <button
                                    onClick={resetState}
                                    className="text-sm text-[var(--accent-primary)] hover:underline"
                                >
                                    Change file
                                </button>
                            </div>

                            {/* Select all toggle and range selection */}
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={toggleAll}
                                        className="text-sm text-[var(--accent-primary)] hover:underline"
                                    >
                                        {chapters.every(ch => ch.selected) ? 'Deselect All' : 'Select All'}
                                    </button>
                                    <span className="text-[var(--text-secondary)]">|</span>
                                    <span className="text-xs text-[var(--text-secondary)]">Range:</span>
                                    <input
                                        type="number"
                                        min={1}
                                        max={chapters.length}
                                        value={rangeStart}
                                        onChange={(e) => setRangeStart(e.target.value)}
                                        placeholder="1"
                                        className="w-12 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded px-1.5 py-0.5 text-xs text-center"
                                    />
                                    <span className="text-xs text-[var(--text-secondary)]">to</span>
                                    <input
                                        type="number"
                                        min={1}
                                        max={chapters.length}
                                        value={rangeEnd}
                                        onChange={(e) => setRangeEnd(e.target.value)}
                                        placeholder={String(chapters.length)}
                                        className="w-12 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded px-1.5 py-0.5 text-xs text-center"
                                    />
                                    <button
                                        onClick={selectRange}
                                        disabled={!rangeStart || !rangeEnd}
                                        className="text-xs font-medium px-2 py-0.5 rounded bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/30 disabled:opacity-50"
                                    >
                                        Select
                                    </button>
                                </div>
                                <span className="text-sm text-[var(--text-secondary)]">
                                    {selectedCount} of {chapters.length} selected
                                </span>
                            </div>

                            {/* Skipped warning */}
                            {skippedCount > 0 && (
                                <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-xs text-yellow-400">
                                    ⚠️ {skippedCount} chapter{skippedCount > 1 ? 's' : ''} will be skipped (already exist with same number)
                                </div>
                            )}

                            {/* Chapters list */}
                            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2">
                                {chapters.map((chapter, index) => (
                                    <div
                                        key={index}
                                        className={`
                      flex items-start gap-3 p-3 rounded-lg border transition-all
                      ${chapter.selected
                                                ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/30'
                                                : 'bg-[var(--bg-tertiary)] border-[var(--border-primary)] opacity-60'
                                            }
                    `}
                                    >
                                        <button
                                            onClick={() => toggleChapter(index)}
                                            className={`
                        flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 transition-colors
                        ${chapter.selected
                                                    ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)] text-white'
                                                    : 'border-[var(--border-primary)]'
                                                }
                      `}
                                        >
                                            {chapter.selected && <CheckIcon />}
                                        </button>
                                        <div className="flex-1 min-w-0">
                                            <input
                                                type="text"
                                                value={chapter.title}
                                                onChange={(e) => updateChapterTitle(index, e.target.value)}
                                                className="w-full bg-transparent font-medium text-[var(--text-primary)] border-none focus:outline-none focus:ring-0"
                                                placeholder="Chapter title"
                                            />
                                            <p className="text-xs text-[var(--text-secondary)] mt-1 truncate">
                                                {chapter.originalText.substring(0, 150)}...
                                            </p>
                                        </div>
                                        <span className="text-xs text-[var(--text-secondary)] flex-shrink-0">
                                            {Math.ceil(chapter.originalText.length / 1000)}k chars
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Importing State */}
                    {isImporting && (
                        <div className="flex flex-col items-center justify-center py-8 gap-4">
                            <LoadingSpinner />
                            <p className="text-[var(--text-secondary)]">
                                Importing chapters... {importProgress.current}/{importProgress.total}
                            </p>
                            <div className="w-full max-w-xs bg-[var(--bg-tertiary)] rounded-full h-2 overflow-hidden">
                                <div
                                    className="h-full bg-[var(--accent-primary)] transition-all duration-300"
                                    style={{ width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-[var(--border-primary)]">
                    <button
                        onClick={handleClose}
                        disabled={isImporting}
                        className="px-4 py-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleImport}
                        disabled={selectedCount === 0 || isProcessing || isImporting}
                        className="px-6 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-[var(--text-on-accent)] font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Import {selectedCount > 0 ? `${selectedCount} Chapter${selectedCount > 1 ? 's' : ''}` : ''}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImportModal;
