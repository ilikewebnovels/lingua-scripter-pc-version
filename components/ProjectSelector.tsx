import React, { useState, useMemo, useRef } from 'react';
import { Project } from '../types';

// Icons
const SearchIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[var(--text-secondary)]" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>;
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
const ImageIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>;
const FolderIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 text-[var(--accent-primary)] opacity-50" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>;
const ImportIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>;
const ChartIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg>;
const BackupIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M5.5 13a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 13H11V9.413l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13H5.5z" /><path d="M9 13h2v5a1 1 0 11-2 0v-5z" /></svg>;
const PencilIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const VerticalViewIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>;
const HorizontalViewIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M4 3a1 1 0 00-1 1v12a1 1 0 001 1h4a1 1 0 001-1V4a1 1 0 00-1-1H4zm8 0a1 1 0 00-1 1v12a1 1 0 001 1h4a1 1 0 001-1V4a1 1 0 00-1-1h-4z" /></svg>;
const GridViewIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>;
const ChevronLeftIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>;
const ChevronRightIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>;
const CollapseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" /></svg>;
const ExpandIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>;

interface ProjectSelectorProps {
  projects: Project[];
  onSelectProject: (id: string) => void;
  onAddProject: (name: string, profilePic: string | null) => Promise<Project>;
  onUpdateProject: (projectId: string, updates: { name?: string; profilePic?: string }) => Promise<void>;
  onOpenStatistics: () => void;
  onOpenBackupRestore: () => void;
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  projects,
  onSelectProject,
  onAddProject,
  onUpdateProject,
  onOpenStatistics,
  onOpenBackupRestore,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectPic, setNewProjectPic] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [isScrollable, setIsScrollable] = useState(false);

  // Edit state
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPic, setEditPic] = useState<string | null>(null);

  // View mode state
  const [viewMode, setViewMode] = useState<'vertical' | 'horizontal' | 'grid'>('vertical');

  // Carousel state (for horizontal mode)
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Header collapse state
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

  // Selected index for keyboard navigation (vertical mode)
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    return projects.filter(p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [projects, searchQuery]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'image/png') {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        setNewProjectPic(loadEvent.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newProjectName.trim()) {
      const newProject = await onAddProject(newProjectName, newProjectPic);
      onSelectProject(newProject.id);
      setNewProjectName('');
      setNewProjectPic(null);
      setIsCreating(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleStartEdit = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setEditingProjectId(project.id);
    setEditName(project.name);
    setEditPic(null);
  };

  const handleEditFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'image/png') {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        setEditPic(loadEvent.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProjectId || !editName.trim()) return;

    const updates: { name?: string; profilePic?: string } = {};
    const currentProject = projects.find(p => p.id === editingProjectId);

    if (editName.trim() !== currentProject?.name) {
      updates.name = editName.trim();
    }
    if (editPic) {
      updates.profilePic = editPic;
    }

    if (Object.keys(updates).length > 0) {
      await onUpdateProject(editingProjectId, updates);
    }

    setEditingProjectId(null);
    setEditName('');
    setEditPic(null);
    if (editFileInputRef.current) editFileInputRef.current.value = '';
  };

  const handleCancelEdit = () => {
    setEditingProjectId(null);
    setEditName('');
    setEditPic(null);
    if (editFileInputRef.current) editFileInputRef.current.value = '';
  };

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const { scrollTop, scrollHeight, clientHeight } = container;
      const scrollableHeight = scrollHeight - clientHeight;
      setIsScrollable(scrollableHeight > 0);
      if (scrollableHeight > 0) {
        setScrollPosition(scrollTop / scrollableHeight);
      } else {
        setScrollPosition(0);
      }
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const newPosition = parseFloat(e.target.value);
      container.scrollTop = newPosition * (container.scrollHeight - container.clientHeight);
    }
  };

  // Carousel navigation
  const goToPrevProject = () => {
    setCarouselIndex(prev => (prev > 0 ? prev - 1 : filteredProjects.length - 1));
  };

  const goToNextProject = () => {
    setCarouselIndex(prev => (prev < filteredProjects.length - 1 ? prev + 1 : 0));
  };

  // Reset carousel index when filtered projects change
  React.useEffect(() => {
    if (carouselIndex >= filteredProjects.length) {
      setCarouselIndex(Math.max(0, filteredProjects.length - 1));
    }
  }, [filteredProjects.length, carouselIndex]);

  // Reset selected index when filtered projects change
  React.useEffect(() => {
    if (selectedIndex >= filteredProjects.length) {
      setSelectedIndex(Math.max(0, filteredProjects.length - 1));
    }
  }, [filteredProjects.length, selectedIndex]);

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't navigate if editing or in an input field
      if (editingProjectId || isCreating) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (filteredProjects.length === 0) return;

      if (viewMode === 'horizontal') {
        // Carousel mode: Left/Right arrows
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          goToPrevProject();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          goToNextProject();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const project = filteredProjects[carouselIndex];
          if (project) onSelectProject(project.id);
        }
      } else {
        // Vertical mode: Up/Down arrows
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex(prev => (prev > 0 ? prev - 1 : filteredProjects.length - 1));
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex(prev => (prev < filteredProjects.length - 1 ? prev + 1 : 0));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const project = filteredProjects[selectedIndex];
          if (project) onSelectProject(project.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, carouselIndex, selectedIndex, filteredProjects, editingProjectId, isCreating, onSelectProject]);

  // Scroll selected item into view in vertical mode
  React.useEffect(() => {
    if (viewMode !== 'vertical') return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const selectedElement = container.children[selectedIndex] as HTMLElement;
    if (selectedElement) {
      selectedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedIndex, viewMode]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--bg-primary)] animate-fade-in">
      {/* Header - Collapsible */}
      <div className={`border-b border-[var(--border-primary)] bg-[var(--bg-secondary)] transition-all duration-300 ${isHeaderCollapsed ? 'py-3 px-6' : 'p-6 pb-4'}`}>
        {/* Always visible: Title row with collapse button and view toggle */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
              title={isHeaderCollapsed ? 'Expand' : 'Collapse'}
            >
              {isHeaderCollapsed ? <ExpandIcon /> : <CollapseIcon />}
            </button>
            <h1 className={`font-bold text-[var(--text-primary)] ${isHeaderCollapsed ? 'text-xl' : 'text-3xl'}`}>
              {isHeaderCollapsed ? `Projects (${filteredProjects.length})` : 'Select a Project'}
            </h1>
          </div>

          {/* View Mode Toggle - Always visible */}
          <div className="flex items-center gap-1 bg-[var(--bg-tertiary)] rounded-lg p-1">
            <button
              onClick={() => setViewMode('vertical')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'vertical'
                ? 'bg-[var(--accent-primary)] text-[var(--text-on-accent)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              title="List View"
            >
              <VerticalViewIcon />
            </button>
            <button
              onClick={() => setViewMode('horizontal')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'horizontal'
                ? 'bg-[var(--accent-primary)] text-[var(--text-on-accent)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              title="Carousel View"
            >
              <HorizontalViewIcon />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'grid'
                ? 'bg-[var(--accent-primary)] text-[var(--text-on-accent)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              title="Grid View"
            >
              <GridViewIcon />
            </button>
          </div>
        </div>

        {/* Collapsible content */}
        {!isHeaderCollapsed && (
          <>
            <p className="text-[var(--text-secondary)] mb-4 mt-2 ml-10">Choose a project to continue working on, or create a new one.</p>

            {/* Search Bar */}
            <div className="relative max-w-md ml-10">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <SearchIcon />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects..."
                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg py-2.5 pl-10 pr-4 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] outline-none transition"
              />
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-3 mt-4 ml-10">
              <button
                onClick={() => setIsCreating(true)}
                className="flex items-center gap-2 text-sm py-2 px-4 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-[var(--text-on-accent)] font-semibold transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Create Project
              </button>
              <button
                onClick={onOpenStatistics}
                className="flex items-center gap-2 text-sm py-2 px-4 rounded-lg bg-[var(--bg-tertiary)] hover:brightness-125 text-[var(--text-secondary)] transition-colors"
              >
                <ChartIcon /> Statistics
              </button>
              <button
                onClick={onOpenBackupRestore}
                className="flex items-center gap-2 text-sm py-2 px-4 rounded-lg bg-[var(--bg-tertiary)] hover:brightness-125 text-[var(--text-secondary)] transition-colors"
              >
                <BackupIcon /> Backup & Restore
              </button>
            </div>

            {/* Inline Create Form (shows when isCreating is true) */}
            {isCreating && (
              <form
                onSubmit={handleAddProject}
                className="mt-4 ml-10 flex items-center gap-4 p-4 bg-[var(--bg-tertiary)] border-2 border-[var(--accent-primary)] rounded-xl shadow-lg shadow-[var(--accent-primary)]/10"
              >
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/png" className="hidden" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-shrink-0 w-16 h-16 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center border border-[var(--border-primary)] hover:border-[var(--accent-primary)] transition-colors cursor-pointer overflow-hidden"
                  title="Select Project Icon (PNG)"
                >
                  {newProjectPic ? (
                    <img src={newProjectPic} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon />
                  )}
                </button>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={e => setNewProjectName(e.target.value)}
                  placeholder="Project Name"
                  autoFocus
                  className="flex-1 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] outline-none transition"
                />
                <button
                  type="submit"
                  disabled={!newProjectName.trim()}
                  className="bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-[var(--text-on-accent)] font-bold py-2.5 px-6 rounded-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setNewProjectName('');
                    setNewProjectPic(null);
                  }}
                  className="py-2.5 px-4 bg-[var(--bg-secondary)] hover:brightness-125 text-[var(--text-secondary)] font-semibold rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </form>
            )}
          </>
        )}
      </div>

      {/* Content Area - Conditional based on view mode */}
      {viewMode === 'vertical' ? (
        /* Vertical List View */
        <div className="flex-1 flex min-h-0 p-6">
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto pr-4 space-y-4 scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {filteredProjects.map((project, index) => (
              editingProjectId === project.id ? (
                /* Edit Form */
                <form
                  key={project.id}
                  onSubmit={handleSaveEdit}
                  className="w-full flex items-center gap-4 p-4 bg-[var(--bg-secondary)] border-2 border-[var(--accent-primary)] rounded-xl shadow-lg shadow-[var(--accent-primary)]/10"
                >
                  <input type="file" ref={editFileInputRef} onChange={handleEditFileSelect} accept="image/png" className="hidden" />
                  <button
                    type="button"
                    onClick={() => editFileInputRef.current?.click()}
                    className="flex-shrink-0 w-24 h-24 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center border border-[var(--border-primary)] hover:border-[var(--accent-primary)] transition-colors cursor-pointer overflow-hidden"
                    title="Change Project Icon (PNG)"
                  >
                    {editPic ? (
                      <img src={editPic} alt="New Preview" className="w-full h-full object-cover" />
                    ) : project.profilePic ? (
                      <img src={`http://localhost:3001${project.profilePic}?t=${project.updatedAt}`} alt={project.name} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon />
                    )}
                  </button>
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      placeholder="Project Name"
                      autoFocus
                      className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg px-4 py-2.5 text-lg text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] outline-none transition"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={!editName.trim()}
                        className="bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-[var(--text-on-accent)] font-bold py-2 px-4 rounded-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="py-2 px-4 bg-[var(--bg-tertiary)] hover:brightness-125 text-[var(--text-secondary)] font-semibold rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                /* Vertical Project Card */
                <div
                  key={project.id}
                  className={`w-full group flex items-center gap-6 p-4 bg-[var(--bg-secondary)] border rounded-xl hover:border-[var(--accent-primary)] hover:shadow-lg hover:shadow-[var(--accent-primary)]/10 transition-all duration-300 ${index === selectedIndex
                    ? 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)] shadow-lg shadow-[var(--accent-primary)]/20'
                    : 'border-[var(--border-primary)]'
                    }`}
                  onClick={() => setSelectedIndex(index)}
                >
                  <button
                    onClick={() => onSelectProject(project.id)}
                    className="flex items-center gap-6 flex-1 text-left"
                  >
                    <div className="flex-shrink-0 w-32 h-32 rounded-lg bg-[var(--bg-tertiary)] overflow-hidden flex items-center justify-center border border-[var(--border-primary)] group-hover:border-[var(--accent-primary)] transition-colors">
                      {project.profilePic ? (
                        <img
                          src={`http://localhost:3001${project.profilePic}?t=${project.updatedAt}`}
                          alt={project.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FolderIcon />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors">
                        {project.name}
                      </h3>
                      <p className="text-sm text-[var(--text-secondary)] mt-1">
                        Created {new Date(project.createdAt).toLocaleDateString()}
                      </p>
                      {project.lastChapterTitle && (
                        <p className="text-xs text-[var(--accent-primary)] mt-1 truncate max-w-xs">
                          📖 Last read: {project.lastChapterTitle}
                        </p>
                      )}
                      <p className="text-xs text-[var(--text-secondary)] mt-1">
                        Last updated {new Date(project.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={(e) => handleStartEdit(e, project)}
                    className="flex-shrink-0 p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-tertiary)] opacity-0 group-hover:opacity-100 transition-all"
                    title="Edit project"
                  >
                    <PencilIcon />
                  </button>
                  <div className="flex-shrink-0 text-[var(--text-secondary)] group-hover:text-[var(--accent-primary)] transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              )
            ))}

            {filteredProjects.length === 0 && searchQuery && (
              <div className="text-center py-12">
                <p className="text-[var(--text-secondary)]">No projects match your search.</p>
              </div>
            )}
            {filteredProjects.length === 0 && !searchQuery && (
              <div className="text-center py-12">
                <p className="text-[var(--text-secondary)] mb-2">No projects yet.</p>
                <p className="text-sm text-[var(--text-secondary)]">Click "Create Project" above to get started.</p>
              </div>
            )}
          </div>

          {/* Vertical Slider */}
          <div className="flex-shrink-0 flex items-center pl-4">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={scrollPosition}
              onChange={handleSliderChange}
              className="h-full w-3 appearance-none cursor-pointer bg-transparent focus:outline-none disabled:opacity-30
                [&::-webkit-slider-runnable-track]:w-3 [&::-webkit-slider-runnable-track]:h-full [&::-webkit-slider-runnable-track]:bg-[var(--bg-tertiary)] [&::-webkit-slider-runnable-track]:rounded-full
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-8 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:bg-[var(--accent-primary)] [&::-webkit-slider-thumb]:rounded-md [&::-webkit-slider-thumb]:shadow-lg
                [&::-moz-range-track]:w-3 [&::-moz-range-track]:h-full [&::-moz-range-track]:bg-[var(--bg-tertiary)] [&::-moz-range-track]:rounded-full
                [&::-moz-range-thumb]:h-8 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:bg-[var(--accent-primary)] [&::-moz-range-thumb]:rounded-md [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:shadow-lg
              "
              style={{ writingMode: 'vertical-lr' }}
              disabled={!isScrollable}
              aria-label="Scroll projects"
            />
          </div>
        </div>
      ) : viewMode === 'horizontal' ? (
        /* Carousel View */
        <div className="flex-1 flex flex-col min-h-0 p-6 overflow-auto">
          <div className="flex-1 flex items-center justify-center">
            {filteredProjects.length > 0 ? (
              <div className="flex items-center gap-8 w-full max-w-4xl">
                {/* Left Arrow */}
                <button
                  onClick={goToPrevProject}
                  className="flex-shrink-0 p-4 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)] hover:shadow-lg transition-all"
                  disabled={filteredProjects.length <= 1}
                >
                  <ChevronLeftIcon />
                </button>

                {/* Carousel Card */}
                {(() => {
                  const project = filteredProjects[carouselIndex];
                  if (!project) return null;

                  if (editingProjectId === project.id) {
                    return (
                      <form
                        onSubmit={handleSaveEdit}
                        className="flex-1 flex flex-col items-center gap-6 p-8 bg-[var(--bg-secondary)] border-2 border-[var(--accent-primary)] rounded-2xl shadow-xl max-w-md mx-auto"
                      >
                        <input type="file" ref={editFileInputRef} onChange={handleEditFileSelect} accept="image/png" className="hidden" />
                        <button
                          type="button"
                          onClick={() => editFileInputRef.current?.click()}
                          className={`${isHeaderCollapsed ? 'w-40 h-40' : 'w-32 h-32'} rounded-xl bg-[var(--bg-tertiary)] flex items-center justify-center border border-[var(--border-primary)] hover:border-[var(--accent-primary)] transition-all cursor-pointer overflow-hidden`}
                          title="Change Project Icon (PNG)"
                        >
                          {editPic ? (
                            <img src={editPic} alt="New Preview" className="w-full h-full object-cover" />
                          ) : project.profilePic ? (
                            <img src={`http://localhost:3001${project.profilePic}?t=${project.updatedAt}`} alt={project.name} className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon />
                          )}
                        </button>
                        <input
                          type="text"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          placeholder="Project Name"
                          autoFocus
                          className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg px-4 py-2.5 text-lg text-center text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] outline-none transition"
                        />
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={!editName.trim()}
                            className="bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-[var(--text-on-accent)] font-bold py-2 px-6 rounded-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="py-2 px-4 bg-[var(--bg-tertiary)] hover:brightness-125 text-[var(--text-secondary)] font-semibold rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    );
                  }

                  return (
                    <div
                      className={`group flex-1 flex flex-col items-center gap-6 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-2xl hover:border-[var(--accent-primary)] hover:shadow-xl hover:shadow-[var(--accent-primary)]/10 transition-all duration-300 cursor-pointer max-w-md mx-auto relative ${isHeaderCollapsed ? 'p-6' : 'p-8'}`}
                      onClick={() => onSelectProject(project.id)}
                    >
                      <div className={`${isHeaderCollapsed ? 'w-48 h-48' : 'w-40 h-40'} rounded-xl overflow-hidden bg-[var(--bg-tertiary)] flex items-center justify-center border border-[var(--border-primary)] transition-all`}>
                        {project.profilePic ? (
                          <img
                            src={`http://localhost:3001${project.profilePic}?t=${project.updatedAt}`}
                            alt={project.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <FolderIcon />
                        )}
                      </div>

                      <div className="text-center">
                        <h3 className={`font-bold text-[var(--text-primary)] ${isHeaderCollapsed ? 'text-2xl' : 'text-xl'}`}>{project.name}</h3>
                        <p className={`text-[var(--text-secondary)] mt-1 ${isHeaderCollapsed ? 'text-base' : 'text-sm'}`}>
                          Created {new Date(project.createdAt).toLocaleDateString()}
                        </p>
                        {project.lastChapterTitle && (
                          <p className={`text-[var(--accent-primary)] mt-1 ${isHeaderCollapsed ? 'text-sm' : 'text-xs'}`}>
                            📖 Last read: {project.lastChapterTitle}
                          </p>
                        )}
                      </div>

                      {/* Edit button */}
                      <button
                        onClick={(e) => handleStartEdit(e, project)}
                        className="absolute top-4 right-4 p-2 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] opacity-0 group-hover:opacity-100 transition-all"
                        title="Edit project"
                      >
                        <PencilIcon />
                      </button>
                    </div>
                  );
                })()}

                {/* Right Arrow */}
                <button
                  onClick={goToNextProject}
                  className="flex-shrink-0 p-4 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)] hover:shadow-lg transition-all"
                  disabled={filteredProjects.length <= 1}
                >
                  <ChevronRightIcon />
                </button>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-[var(--text-secondary)] mb-2">
                  {searchQuery ? 'No projects match your search.' : 'No projects yet.'}
                </p>
                {!searchQuery && (
                  <p className="text-sm text-[var(--text-secondary)]">Click "Create Project" above to get started.</p>
                )}
              </div>
            )}
          </div>

          {/* Carousel Dots/Position Indicator */}
          {filteredProjects.length > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              {filteredProjects.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCarouselIndex(index)}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${index === carouselIndex
                    ? 'bg-[var(--accent-primary)] w-6'
                    : 'bg-[var(--border-primary)] hover:bg-[var(--text-secondary)]'
                    }`}
                  aria-label={`Go to project ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Grid View */
        <div className="flex-1 min-h-0 p-6 overflow-auto">
          {filteredProjects.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredProjects.map((project) => (
                editingProjectId === project.id ? (
                  /* Grid Edit Form */
                  <form
                    key={project.id}
                    onSubmit={handleSaveEdit}
                    className="flex flex-col items-center gap-3 p-4 bg-[var(--bg-secondary)] border-2 border-[var(--accent-primary)] rounded-xl shadow-lg"
                  >
                    <input type="file" ref={editFileInputRef} onChange={handleEditFileSelect} accept="image/png" className="hidden" />
                    <button
                      type="button"
                      onClick={() => editFileInputRef.current?.click()}
                      className="w-24 h-24 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center border border-[var(--border-primary)] hover:border-[var(--accent-primary)] transition-colors cursor-pointer overflow-hidden"
                      title="Change Project Icon (PNG)"
                    >
                      {editPic ? (
                        <img src={editPic} alt="New Preview" className="w-full h-full object-cover" />
                      ) : project.profilePic ? (
                        <img src={`http://localhost:3001${project.profilePic}?t=${project.updatedAt}`} alt={project.name} className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon />
                      )}
                    </button>
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      placeholder="Project Name"
                      autoFocus
                      className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-sm text-center text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] outline-none"
                    />
                    <div className="flex gap-2 w-full">
                      <button
                        type="submit"
                        disabled={!editName.trim()}
                        className="flex-1 bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-[var(--text-on-accent)] font-bold py-1.5 px-3 rounded-lg text-sm transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="flex-1 py-1.5 px-3 bg-[var(--bg-tertiary)] hover:brightness-125 text-[var(--text-secondary)] font-semibold rounded-lg text-sm transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  /* Grid Project Card */
                  <div
                    key={project.id}
                    className="group flex flex-col items-center gap-3 p-4 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl hover:border-[var(--accent-primary)] hover:shadow-lg hover:shadow-[var(--accent-primary)]/10 transition-all duration-300 cursor-pointer relative"
                    onClick={() => onSelectProject(project.id)}
                  >
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-[var(--bg-tertiary)] flex items-center justify-center border border-[var(--border-primary)]">
                      {project.profilePic ? (
                        <img
                          src={`http://localhost:3001${project.profilePic}?t=${project.updatedAt}`}
                          alt={project.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-[var(--accent-primary)] opacity-50" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>
                      )}
                    </div>

                    <div className="text-center w-full">
                      <h3 className="font-semibold text-sm text-[var(--text-primary)] truncate">{project.name}</h3>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        {new Date(project.createdAt).toLocaleDateString()}
                      </p>
                      {project.lastChapterTitle && (
                        <p className="text-xs text-[var(--accent-primary)] mt-0.5 truncate" title={project.lastChapterTitle}>
                          📖 {project.lastChapterTitle}
                        </p>
                      )}
                    </div>

                    {/* Edit button */}
                    <button
                      onClick={(e) => handleStartEdit(e, project)}
                      className="absolute top-2 right-2 p-1.5 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] opacity-0 group-hover:opacity-100 transition-all"
                      title="Edit project"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                    </button>
                  </div>
                )
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-[var(--text-secondary)] mb-2">
                {searchQuery ? 'No projects match your search.' : 'No projects yet.'}
              </p>
              {!searchQuery && (
                <p className="text-sm text-[var(--text-secondary)]">Click "Create Project" above to get started.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectSelector;
