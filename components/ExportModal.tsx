import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Project, Chapter, Settings } from '../types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  chapters: Chapter[];
  settings: Settings;
}

const LoadingSpinner = () => <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>;

const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, project, chapters, settings }) => {
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingEpub, setIsExportingEpub] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const projectChapters = useMemo(() => {
    if (!project) return [];
    return chapters
      .filter(c => c.projectId === project.id)
      .sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));
  }, [chapters, project]);

  // Set default range and clear errors when modal opens
  useEffect(() => {
    if (isOpen) {
      if (projectChapters.length > 0) {
        const maxChapter = Math.max(0, ...projectChapters.map(c => c.chapterNumber || 0));
        setRangeStart('1');
        setRangeEnd(String(maxChapter));
      } else {
        setRangeStart('');
        setRangeEnd('');
      }
      setExportError(null);
      setIsExportingPdf(false);
      setIsExportingEpub(false);
    }
  }, [isOpen, projectChapters]);
  
  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);
  
  const chaptersToExport = useMemo(() => {
    const start = parseInt(rangeStart, 10);
    const end = parseInt(rangeEnd, 10);
    if (isNaN(start) || isNaN(end) || start > end) {
      return [];
    }
    return projectChapters.filter(c => c.chapterNumber >= start && c.chapterNumber <= end);
  }, [rangeStart, rangeEnd, projectChapters]);

  const generatePrintableHtml = useCallback(() => {
      // Generate cover image HTML if project has a profile picture
      const coverImageHtml = project?.profilePic
        ? `<div class="cover-page">
             <img src="http://localhost:3001${project.profilePic}" alt="${project.name} cover" class="cover-image" />
           </div>`
        : '';

      let content = `
        <html>
          <head>
            <title>${project?.name || 'Export'}</title>
            <style>
              body { font-family: ${settings.fontFamily === 'font-sans' ? 'sans-serif' : settings.fontFamily === 'font-serif' ? 'serif' : 'monospace'}; font-size: 16px; line-height: 1.6; margin: 40px; }
              .cover-page {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 80vh;
                page-break-after: always;
              }
              .cover-image {
                max-width: 60%;
                max-height: 70vh;
                object-fit: contain;
                border-radius: 4px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
              }
              h1 { font-size: 2.5em; text-align: center; margin-bottom: 2em; page-break-after: avoid; }
              h2 { font-size: 1.8em; margin-top: 2em; margin-bottom: 1em; page-break-before: always; page-break-after: avoid; }
              p { white-space: pre-wrap; text-align: justify; }
              p { page-break-inside: avoid; }
              h2:first-of-type { page-break-before: auto; }
              @page {
                  margin: 1in;
              }
            </style>
          </head>
          <body>
            ${coverImageHtml}
            <h1>${project?.name}</h1>
      `;

      chaptersToExport.forEach(chapter => {
          const sanitizedText = chapter.translatedText.replace(/</g, "&lt;").replace(/>/g, "&gt;");
          content += `
            <h2>Chapter ${chapter.chapterNumber}: ${chapter.title}</h2>
            <p>${sanitizedText}</p>
          `;
      });

      content += `
          </body>
        </html>
      `;
      return content;
  }, [project, chaptersToExport, settings]);

  const handleExportPdf = useCallback(async () => {
    if (!project || chaptersToExport.length === 0) return;

    setIsExportingPdf(true);
    setExportError(null);

    const htmlContent = generatePrintableHtml();
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        try {
          printWindow.print();
        } catch (e) {
          console.error("Printing failed.", e);
          setExportError("Printing failed. Please try again or check browser console.");
        } finally {
          if (!printWindow.closed) {
            printWindow.close();
          }
        }
      }, 500);
    } else {
      setExportError('Could not open print window. Please disable pop-up blockers.');
    }
    
    setTimeout(() => {
      setIsExportingPdf(false);
      if (!exportError) onClose();
    }, 1000);
  }, [project, chaptersToExport, onClose, generatePrintableHtml, exportError]);
  
  const handleExportEpub = useCallback(async () => {
    if (!project || chaptersToExport.length === 0) return;

    setIsExportingEpub(true);
    setExportError(null);

    try {
      const response = await fetch('/api/export-epub', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectName: project.name,
          author: 'Unknown Author', // In the future, we could add author input field
          chapters: chaptersToExport,
          coverImage: project.profilePic || null // Send cover image path if available
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate EPUB');
      }

      // Get the blob and create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.replace(/[^a-zA-Z0-9-_]/g, '_')}.epub`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      // Close modal after successful export
      setTimeout(() => {
        setIsExportingEpub(false);
        onClose();
      }, 1000);
    } catch (error) {
      console.error("EPUB export failed:", error);
      setExportError(`EPUB export failed: ${error.message}`);
      setIsExportingEpub(false);
    }
  }, [project, chaptersToExport, onClose]);

  if (!isOpen) return null;
  
  const isExportDisabled = (isExportingPdf || isExportingEpub) || chaptersToExport.length === 0;

  return (
    <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" 
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
    >
      <div className="bg-[var(--bg-secondary)] rounded-md shadow-xl p-6 w-full max-w-lg border border-[var(--border-primary)]" onClick={(e) => e.stopPropagation()}>
        <h2 id="export-modal-title" className="text-xl font-bold text-[var(--text-primary)] mb-4">Export Project</h2>
        <p className="text-[var(--text-secondary)] text-sm mb-6">
          Exporting <strong className="text-[var(--text-primary)]">{project?.name || ''}</strong>
        </p>

        {projectChapters.length > 0 ? (
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Quick Ranges</label>
                    <div className="grid grid-cols-2 gap-2">
                         <button onClick={() => { setRangeStart('1'); setRangeEnd('100'); }} className="text-sm py-2 rounded-md transition-colors bg-[var(--bg-tertiary)] hover:brightness-125 text-[var(--text-primary)] font-semibold">
                            Chapters 1-100
                        </button>
                        <button onClick={() => { setRangeStart('101'); setRangeEnd('200'); }} className="text-sm py-2 rounded-md transition-colors bg-[var(--bg-tertiary)] hover:brightness-125 text-[var(--text-primary)] font-semibold">
                            Chapters 101-200
                        </button>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Custom Range</label>
                    <div className="flex items-center gap-3 bg-[var(--bg-primary)] p-3 rounded-md border border-[var(--border-primary)]">
                       <input
                            type="number"
                            value={rangeStart}
                            onChange={(e) => setRangeStart(e.target.value)}
                            placeholder="From"
                            min="1"
                            className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] outline-none transition"
                        />
                        <span className="text-[var(--text-secondary)]">to</span>
                        <input
                            type="number"
                            value={rangeEnd}
                            onChange={(e) => setRangeEnd(e.target.value)}
                            placeholder="To"
                            min={rangeStart || 1}
                            className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] outline-none transition"
                        />
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-2">
                        {chaptersToExport.length} chapter(s) selected for export.
                    </p>
                </div>
                {exportError && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-md text-sm">
                        {exportError}
                    </div>
                )}
            </div>
        ) : (
             <p className="text-sm text-center text-[var(--text-secondary)] py-8">No chapters in this project to export.</p>
        )}


        <div className="mt-6 flex justify-end gap-3 border-t border-[var(--border-primary)] pt-4">
          <button onClick={onClose} className="bg-[var(--bg-tertiary)] hover:brightness-125 text-[var(--text-primary)] font-semibold px-4 py-2 rounded-md transition-colors">
            Cancel
          </button>
          <button 
            onClick={handleExportEpub} 
            disabled={isExportDisabled}
            className="bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-[var(--text-on-accent)] font-semibold px-4 py-2 rounded-md transition-colors min-w-[120px] flex items-center justify-center disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            {isExportingEpub ? <LoadingSpinner /> : 'Export EPUB'}
          </button>
          <button 
            onClick={handleExportPdf} 
            disabled={isExportDisabled}
            className="bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-[var(--text-on-accent)] font-semibold px-4 py-2 rounded-md transition-colors min-w-[120px] flex items-center justify-center disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            {isExportingPdf ? <LoadingSpinner /> : 'Export PDF'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;