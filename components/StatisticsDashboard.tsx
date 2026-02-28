import React, { useState, useMemo, useEffect } from 'react';
import { Chapter, Project } from '../types';
import {
  getWordCount,
  getCharCount,
  computeTextMetrics,
  getTokensFromMetrics,
  TokenizerModel,
  TextMetrics
} from '../utils/tokenizer';

interface StatisticsDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  chapters: Chapter[];
  selectedProjectId: string | null;
}

interface ProjectStats {
  projectId: string;
  projectName: string;
  totalChapters: number;
  originalWords: number;
  translatedWords: number;
  originalChars: number;
  translatedChars: number;
  // Pre-computed metrics for fast tokenizer switching
  originalMetrics: TextMetrics;
  translatedMetrics: TextMetrics;
}

const ChartIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
  </svg>
);

const DocumentIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
  </svg>
);

const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toLocaleString();
};

const StatisticsDashboard: React.FC<StatisticsDashboardProps> = ({
  isOpen,
  onClose,
  projects,
  chapters,
  selectedProjectId,
}) => {
  const [selectedTokenizer, setSelectedTokenizer] = useState<TokenizerModel>('general');
  const [viewMode, setViewMode] = useState<'all' | 'project'>('all');
  const [allChapters, setAllChapters] = useState<Chapter[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch all chapters when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      fetch('http://localhost:3001/api/chapters')
        .then(res => res.json())
        .then(data => {
          setAllChapters(data);
          setIsLoading(false);
        })
        .catch(err => {
          console.error('Failed to fetch all chapters:', err);
          setIsLoading(false);
        });
    }
  }, [isOpen]);

  // Set view mode based on whether a project is selected
  useEffect(() => {
    if (selectedProjectId) {
      setViewMode('project');
    }
  }, [selectedProjectId, isOpen]);

  // Pre-compute all stats with text metrics (expensive - only when chapters change)
  const allProjectStats = useMemo((): ProjectStats[] => {
    return projects.map(project => {
      const projectChapters = allChapters.filter(c => c.projectId === project.id);

      let originalWords = 0;
      let translatedWords = 0;
      let originalChars = 0;
      let translatedChars = 0;

      // Aggregate metrics for fast tokenizer switching
      let totalOriginalMetrics: TextMetrics = { nonCjkLength: 0, cjkCount: 0 };
      let totalTranslatedMetrics: TextMetrics = { nonCjkLength: 0, cjkCount: 0 };

      projectChapters.forEach(chapter => {
        originalWords += getWordCount(chapter.originalText);
        translatedWords += getWordCount(chapter.translatedText);
        originalChars += getCharCount(chapter.originalText);
        translatedChars += getCharCount(chapter.translatedText);

        // Pre-compute metrics once
        const origMetrics = computeTextMetrics(chapter.originalText);
        const transMetrics = computeTextMetrics(chapter.translatedText);

        totalOriginalMetrics.nonCjkLength += origMetrics.nonCjkLength;
        totalOriginalMetrics.cjkCount += origMetrics.cjkCount;
        totalTranslatedMetrics.nonCjkLength += transMetrics.nonCjkLength;
        totalTranslatedMetrics.cjkCount += transMetrics.cjkCount;
      });

      return {
        projectId: project.id,
        projectName: project.name,
        totalChapters: projectChapters.length,
        originalWords,
        translatedWords,
        originalChars,
        translatedChars,
        originalMetrics: totalOriginalMetrics,
        translatedMetrics: totalTranslatedMetrics,
      };
    });
  }, [projects, allChapters]); // Note: NOT dependent on selectedTokenizer

  // Calculate token counts from pre-computed metrics (cheap - just math)
  const projectStatsWithTokens = useMemo(() => {
    return allProjectStats.map(stat => ({
      ...stat,
      estimatedTokens:
        getTokensFromMetrics(stat.originalMetrics, selectedTokenizer) +
        getTokensFromMetrics(stat.translatedMetrics, selectedTokenizer),
    }));
  }, [allProjectStats, selectedTokenizer]);

  // Calculate totals across all projects
  const totals = useMemo(() => {
    return projectStatsWithTokens.reduce(
      (acc, stat) => ({
        totalChapters: acc.totalChapters + stat.totalChapters,
        originalWords: acc.originalWords + stat.originalWords,
        translatedWords: acc.translatedWords + stat.translatedWords,
        originalChars: acc.originalChars + stat.originalChars,
        translatedChars: acc.translatedChars + stat.translatedChars,
        estimatedTokens: acc.estimatedTokens + stat.estimatedTokens,
      }),
      {
        totalChapters: 0,
        originalWords: 0,
        translatedWords: 0,
        originalChars: 0,
        translatedChars: 0,
        estimatedTokens: 0,
      }
    );
  }, [projectStatsWithTokens]);

  // Get current project stats
  const currentProjectStats = useMemo(() => {
    if (!selectedProjectId) return null;
    return projectStatsWithTokens.find(s => s.projectId === selectedProjectId) || null;
  }, [projectStatsWithTokens, selectedProjectId]);

  // Calculate estimated API cost (rough estimate)
  const estimatedCost = useMemo(() => {
    const tokens = viewMode === 'all' ? totals.estimatedTokens : (currentProjectStats?.estimatedTokens || 0);
    // Rough estimate based on typical API pricing ($0.0015 per 1K input tokens, $0.002 per 1K output tokens)
    // We'll use an average of $0.00175 per 1K tokens
    return (tokens / 1000) * 0.00175;
  }, [viewMode, totals.estimatedTokens, currentProjectStats]);

  if (!isOpen) return null;

  const displayStats = viewMode === 'all' ? totals : currentProjectStats;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-secondary)] rounded-md shadow-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-[var(--border-primary)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <ChartIcon /> Statistics Dashboard
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex bg-[var(--bg-tertiary)] rounded-md p-1">
            <button
              onClick={() => setViewMode('all')}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${viewMode === 'all'
                ? 'bg-[var(--accent-primary)] text-[var(--text-on-accent)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
            >
              All Projects
            </button>
            <button
              onClick={() => setViewMode('project')}
              disabled={!selectedProjectId}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${viewMode === 'project'
                ? 'bg-[var(--accent-primary)] text-[var(--text-on-accent)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
            >
              Current Project
            </button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <label className="text-sm text-[var(--text-secondary)]">Tokenizer:</label>
            <select
              value={selectedTokenizer}
              onChange={(e) => setSelectedTokenizer(e.target.value as TokenizerModel)}
              className="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-md px-2 py-1 text-sm text-[var(--text-primary)]"
            >
              <option value="general">General</option>
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-3.5">GPT-3.5</option>
              <option value="claude">Claude</option>
              <option value="gemini">Gemini</option>
              <option value="llama">Llama</option>
            </select>
          </div>
        </div>

        {/* Current View Title */}
        {viewMode === 'project' && currentProjectStats && (
          <div className="mb-4 text-sm text-[var(--text-secondary)]">
            Showing statistics for: <span className="font-medium text-[var(--text-primary)]">{currentProjectStats.projectName}</span>
          </div>
        )}

        {/* Stats Grid */}
        {displayStats && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-[var(--bg-tertiary)] rounded-lg p-4">
              <div className="flex items-center gap-2 text-[var(--text-secondary)] mb-2">
                <DocumentIcon />
                <span className="text-sm">Total Chapters</span>
              </div>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {displayStats.totalChapters}
              </p>
            </div>

            <div className="bg-[var(--bg-tertiary)] rounded-lg p-4">
              <div className="text-[var(--text-secondary)] text-sm mb-2">Original Words</div>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {formatNumber(displayStats.originalWords)}
              </p>
            </div>

            <div className="bg-[var(--bg-tertiary)] rounded-lg p-4">
              <div className="text-[var(--text-secondary)] text-sm mb-2">Translated Words</div>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {formatNumber(displayStats.translatedWords)}
              </p>
            </div>

            <div className="bg-[var(--bg-tertiary)] rounded-lg p-4">
              <div className="text-[var(--text-secondary)] text-sm mb-2">Original Characters</div>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {formatNumber(displayStats.originalChars)}
              </p>
            </div>

            <div className="bg-[var(--bg-tertiary)] rounded-lg p-4">
              <div className="text-[var(--text-secondary)] text-sm mb-2">Translated Characters</div>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {formatNumber(displayStats.translatedChars)}
              </p>
            </div>

            <div className="bg-[var(--bg-tertiary)] rounded-lg p-4">
              <div className="text-[var(--text-secondary)] text-sm mb-2">Est. Total Tokens</div>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {formatNumber(displayStats.estimatedTokens)}
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                ~${estimatedCost.toFixed(2)} est. cost
              </p>
            </div>
          </div>
        )}

        {/* Projects Breakdown (only show in All Projects view) */}
        {viewMode === 'all' && projectStatsWithTokens.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Projects Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-primary)]">
                    <th className="text-left py-2 px-3 text-[var(--text-secondary)] font-medium">Project</th>
                    <th className="text-right py-2 px-3 text-[var(--text-secondary)] font-medium">Chapters</th>
                    <th className="text-right py-2 px-3 text-[var(--text-secondary)] font-medium">Orig. Words</th>
                    <th className="text-right py-2 px-3 text-[var(--text-secondary)] font-medium">Trans. Words</th>
                    <th className="text-right py-2 px-3 text-[var(--text-secondary)] font-medium">Est. Tokens</th>
                  </tr>
                </thead>
                <tbody>
                  {projectStatsWithTokens.map((stat) => (
                    <tr
                      key={stat.projectId}
                      className="border-b border-[var(--border-primary)]/50 hover:bg-[var(--bg-tertiary)]/50"
                    >
                      <td className="py-2 px-3 text-[var(--text-primary)]">{stat.projectName}</td>
                      <td className="text-right py-2 px-3 text-[var(--text-primary)]">{stat.totalChapters}</td>
                      <td className="text-right py-2 px-3 text-[var(--text-primary)]">{formatNumber(stat.originalWords)}</td>
                      <td className="text-right py-2 px-3 text-[var(--text-primary)]">{formatNumber(stat.translatedWords)}</td>
                      <td className="text-right py-2 px-3 text-[var(--text-primary)]">{formatNumber(stat.estimatedTokens)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {projectStatsWithTokens.length === 0 && (
          <div className="text-center py-12 text-[var(--text-secondary)]">
            <ChartIcon />
            <p className="mt-4">No statistics available yet.</p>
            <p className="text-sm mt-2">Create a project and add some chapters to see statistics.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatisticsDashboard;
