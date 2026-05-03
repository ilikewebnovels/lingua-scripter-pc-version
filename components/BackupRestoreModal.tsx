import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Project, Chapter, GlossaryEntry, Character } from '../types';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  chapters: Chapter[];
  glossaries: Record<string, GlossaryEntry[]>;
  characterDBs: Record<string, Character[]>;
  selectedProjectId: string | null;
  onRestoreProject: (data: ProjectBackup) => Promise<void>;
}

export interface ProjectBackup {
  version: string;
  exportedAt: number;
  project: Project;
  chapters: Chapter[];
  glossary: GlossaryEntry[];
  characters: Character[];
}

interface FullBackup {
  version: string;
  exportedAt: number;
  projects: Project[];
  chapters: Chapter[];
  glossaries: Record<string, GlossaryEntry[]>;
  characterDBs: Record<string, Character[]>;
}

const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

const UploadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
  </svg>
);

const LoadingSpinner = () => <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>;

const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  onClose,
  projects,
  chapters,
  glossaries,
  characterDBs,
  selectedProjectId,
  onRestoreProject,
}) => {
  const [activeTab, setActiveTab] = useState<'backup' | 'restore'>('backup');
  const [backupType, setBackupType] = useState<'project' | 'all'>('project');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [restorePreview, setRestorePreview] = useState<ProjectBackup | FullBackup | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [allChapters, setAllChapters] = useState<Chapter[]>([]);

  // Fetch all chapters when modal opens (for full backup)
  useEffect(() => {
    if (isOpen) {
      fetch('/api/chapters')
        .then(res => res.json())
        .then(data => setAllChapters(data))
        .catch(err => console.error('Failed to fetch all chapters:', err));
    }
  }, [isOpen]);

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  const handleClose = useCallback(() => {
    setError(null);
    setSuccess(null);
    setRestorePreview(null);
    onClose();
  }, [onClose]);

  const generateProjectBackup = useCallback((): ProjectBackup | null => {
    if (!selectedProject) return null;

    const projectChapters = chapters.filter(c => c.projectId === selectedProject.id);
    const projectGlossary = glossaries[selectedProject.id] || [];
    const projectCharacters = characterDBs[selectedProject.id] || [];

    return {
      version: '1.0',
      exportedAt: Date.now(),
      project: selectedProject,
      chapters: projectChapters,
      glossary: projectGlossary,
      characters: projectCharacters,
    };
  }, [selectedProject, chapters, glossaries, characterDBs]);

  const generateFullBackup = useCallback((): FullBackup => {
    return {
      version: '1.0',
      exportedAt: Date.now(),
      projects,
      chapters: allChapters,
      glossaries,
      characterDBs,
    };
  }, [projects, allChapters, glossaries, characterDBs]);

  const handleExportBackup = useCallback(() => {
    setError(null);
    setSuccess(null);

    let backupData: ProjectBackup | FullBackup | null;
    let fileName: string;

    if (backupType === 'project') {
      if (!selectedProject) {
        setError('Please select a project to backup.');
        return;
      }
      backupData = generateProjectBackup();
      fileName = `${selectedProject.name.replace(/[^a-zA-Z0-9-_]/g, '_')}_backup_${new Date().toISOString().split('T')[0]}.json`;
    } else {
      backupData = generateFullBackup();
      fileName = `lingua_scripter_full_backup_${new Date().toISOString().split('T')[0]}.json`;
    }

    if (!backupData) {
      setError('Failed to generate backup data.');
      return;
    }

    // Create and download the file
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setSuccess(`Backup exported successfully: ${fileName}`);
  }, [backupType, selectedProject, generateProjectBackup, generateFullBackup]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccess(null);
    setRestorePreview(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);

        // Validate backup structure
        if (!data.version || !data.exportedAt) {
          throw new Error('Invalid backup file format.');
        }

        // Check if it's a project backup or full backup
        if (data.project) {
          // Project backup
          setRestorePreview(data as ProjectBackup);
        } else if (data.projects) {
          // Full backup
          setRestorePreview(data as FullBackup);
        } else {
          throw new Error('Invalid backup file format.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse backup file.');
      }
    };
    reader.onerror = () => {
      setError('Failed to read backup file.');
    };
    reader.readAsText(file);
  }, []);

  const handleRestore = useCallback(async () => {
    if (!restorePreview) return;

    setIsProcessing(true);
    setError(null);

    try {
      if ('project' in restorePreview) {
        // Single project restore
        await onRestoreProject(restorePreview);
        setSuccess(`Project "${restorePreview.project.name}" restored successfully!`);
      } else {
        // Full backup restore - call API
        const response = await fetch('/api/restore-full-backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(restorePreview),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to restore backup.');
        }

        setSuccess('Full backup restored successfully! Please refresh the page.');
      }

      setRestorePreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore backup.');
    } finally {
      setIsProcessing(false);
    }
  }, [restorePreview, onRestoreProject]);

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  const isProjectBackup = (data: ProjectBackup | FullBackup): data is ProjectBackup => {
    return 'project' in data;
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in"
      onClick={handleClose}
    >
      <div
        className="bg-[var(--bg-secondary)] rounded-md shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto border border-[var(--border-primary)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">Backup & Restore</h2>

        {/* Tabs */}
        <div className="flex bg-[var(--bg-tertiary)] rounded-md p-1 mb-6">
          <button
            onClick={() => setActiveTab('backup')}
            className={`flex-1 px-4 py-2 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === 'backup'
              ? 'bg-[var(--accent-primary)] text-[var(--text-on-accent)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
          >
            <DownloadIcon /> Backup
          </button>
          <button
            onClick={() => setActiveTab('restore')}
            className={`flex-1 px-4 py-2 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === 'restore'
              ? 'bg-[var(--accent-primary)] text-[var(--text-on-accent)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
          >
            <UploadIcon /> Restore
          </button>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-md mb-4 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-500/10 border border-green-500/30 text-green-400 p-3 rounded-md mb-4 text-sm">
            {success}
          </div>
        )}

        {/* Backup Tab */}
        {activeTab === 'backup' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Backup Type
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 bg-[var(--bg-tertiary)] rounded-md cursor-pointer hover:brightness-110 transition">
                  <input
                    type="radio"
                    name="backupType"
                    value="project"
                    checked={backupType === 'project'}
                    onChange={(e) => setBackupType(e.target.value as 'project' | 'all')}
                    className="text-[var(--accent-primary)]"
                  />
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">Current Project</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Export selected project with its chapters, glossary, and characters
                    </p>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 bg-[var(--bg-tertiary)] rounded-md cursor-pointer hover:brightness-110 transition">
                  <input
                    type="radio"
                    name="backupType"
                    value="all"
                    checked={backupType === 'all'}
                    onChange={(e) => setBackupType(e.target.value as 'project' | 'all')}
                    className="text-[var(--accent-primary)]"
                  />
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">Full Backup</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Export all projects, chapters, glossaries, and characters
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {backupType === 'project' && !selectedProject && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 p-3 rounded-md text-sm">
                Please select a project first to create a project backup.
              </div>
            )}

            {backupType === 'project' && selectedProject && (
              <div className="p-3 bg-[var(--bg-tertiary)] rounded-md">
                <p className="text-sm text-[var(--text-secondary)]">Selected Project:</p>
                <p className="font-medium text-[var(--text-primary)]">{selectedProject.name}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  {chapters.filter(c => c.projectId === selectedProject.id).length} chapters • {' '}
                  {(glossaries[selectedProject.id] || []).length} glossary terms • {' '}
                  {(characterDBs[selectedProject.id] || []).length} characters
                </p>
              </div>
            )}

            {backupType === 'all' && (
              <div className="p-3 bg-[var(--bg-tertiary)] rounded-md">
                <p className="text-sm text-[var(--text-secondary)]">Full Backup Summary:</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  {projects.length} projects • {chapters.length} total chapters
                </p>
              </div>
            )}

            <button
              onClick={handleExportBackup}
              disabled={backupType === 'project' && !selectedProject}
              className="w-full bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-[var(--text-on-accent)] font-semibold py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <DownloadIcon /> Export Backup
            </button>
          </div>
        )}

        {/* Restore Tab */}
        {activeTab === 'restore' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Select Backup File
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-[var(--accent-primary)] file:text-[var(--text-on-accent)] cursor-pointer"
              />
            </div>

            {/* Preview */}
            {restorePreview && (
              <div className="p-4 bg-[var(--bg-tertiary)] rounded-md">
                <h4 className="font-medium text-[var(--text-primary)] mb-2">Backup Preview</h4>
                <div className="text-sm text-[var(--text-secondary)] space-y-1">
                  <p>Version: {restorePreview.version}</p>
                  <p>Exported: {formatDate(restorePreview.exportedAt)}</p>

                  {isProjectBackup(restorePreview) ? (
                    <>
                      <p className="pt-2 font-medium text-[var(--text-primary)]">
                        Project: {restorePreview.project.name}
                      </p>
                      <p>{restorePreview.chapters.length} chapters</p>
                      <p>{restorePreview.glossary.length} glossary terms</p>
                      <p>{restorePreview.characters.length} characters</p>
                    </>
                  ) : (
                    <>
                      <p className="pt-2 font-medium text-[var(--text-primary)]">Full Backup</p>
                      <p>{restorePreview.projects.length} projects</p>
                      <p>{restorePreview.chapters.length} total chapters</p>
                    </>
                  )}
                </div>

                <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded-md text-xs">
                  {isProjectBackup(restorePreview)
                    ? 'This will create a new project with the backed up data. Existing projects will not be affected.'
                    : 'Warning: Restoring a full backup will replace ALL existing data. This action cannot be undone.'}
                </div>
              </div>
            )}

            <button
              onClick={handleRestore}
              disabled={!restorePreview || isProcessing}
              className="w-full bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-[var(--text-on-accent)] font-semibold py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isProcessing ? <><LoadingSpinner /> Restoring...</> : <><UploadIcon /> Restore Backup</>}
            </button>
          </div>
        )}

        {/* Close Button */}
        <div className="mt-6 pt-4 border-t border-[var(--border-primary)]">
          <button
            onClick={handleClose}
            className="w-full bg-[var(--bg-tertiary)] hover:brightness-125 text-[var(--text-primary)] font-semibold py-2 px-4 rounded-md transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default BackupRestoreModal;
