import { create } from 'zustand';
import {
  FileNode,
  GitStatusInfo,
  Frontmatter,
  ManuscriptMetrics,
  LintIssue,
  DiffFile,
  SceneStatus,
  AiConfig,
  AiProviderType,
  WorldNode,
  WorldEdge,
  GraphData,
  SceneGraphAnalysis,
  SyncStatus,
  SyncConfig,
  calculateMetrics,
  lintJapaneseText,
  parseDocument,
  readNovelFile,
  saveNovelFile,
  updateFrontmatter,
  openVault,
  getGitStatus,
  gitAutoCommit,
  gitGetDiff,
  gitApplyRevision,
  gitDiscardRevision,
  aiRunRevision,
  createSampleProject,
  createNewEpisode,
  reorderEpisodes,
  deleteEpisode,
  getWorldGraph,
  upsertWorldNode,
  deleteWorldNode,
  upsertWorldEdge,
  deleteWorldEdge,
  analyzeSceneGraph,
  getSyncStatus,
  getSyncConfig,
  saveSyncConfig,
  triggerAutoSync,
  getOverallPlot,
  saveOverallPlot,
  listWorldNotes,
  readWorldNote,
  saveWorldNote,
  syncNotesToGraph,
  clearWorldGraph,
  syncManuscriptToWorld,
  aiGenerateSceneBeats,
  aiExpandSceneDraft,
  exportManuscript,
  saveExportedFile,
  SyncManuscriptResult,
  ExportOptions,
  ExportResult,
  NovelProjectItem,
  CloudStorageDetections,
  DetectedAiServices,
  listNovelProjects,
  createNovelProject,
  deleteNovelProject,
  importNovelProject,
  getCloudStorageDetections,
  connectCloudStorage,
  connectGithubCli,
  detectAiServices,
  testAiConnection,
} from '../lib/tauri-commands';

interface VaultState {
  vaultPath: string | null;
  files: FileNode[];
  activeFilePath: string | null;
  gitStatus: GitStatusInfo | null;
  isLoading: boolean;
  isSnapshotSaved: boolean;
  projects: NovelProjectItem[];
  isBookshelfOpen: boolean;
  setIsBookshelfOpen: (open: boolean) => void;
  loadProjects: () => Promise<NovelProjectItem[]>;
  createProject: (title: string, synopsis?: string, targetPaper?: string) => Promise<NovelProjectItem | null>;
  deleteProject: (projectPath: string) => Promise<void>;
  importProject: (folderPath: string) => Promise<NovelProjectItem | null>;
  switchProject: (projectPath: string) => Promise<void>;
  setVaultPath: (path: string) => Promise<void>;
  loadSampleProject: () => Promise<void>;
  refreshFiles: () => Promise<void>;
  refreshGitStatus: () => Promise<void>;
  selectFile: (path: string) => Promise<void>;
  addEpisode: (title: string) => Promise<string | null>;
  reorderEpisodesList: (orderedPaths: string[]) => Promise<void>;
  removeEpisode: (filePath: string) => Promise<void>;
  snapshotCurrentState: () => Promise<void>;
}

export const useVaultStore = create<VaultState>((set, get) => ({
  vaultPath: null,
  files: [],
  activeFilePath: null,
  gitStatus: null,
  isLoading: false,
  isSnapshotSaved: false,
  projects: [],
  isBookshelfOpen: false,

  setIsBookshelfOpen: (open: boolean) => set({ isBookshelfOpen: open }),

  loadProjects: async () => {
    try {
      const projects = await listNovelProjects();
      set({ projects });
      return projects;
    } catch (e) {
      console.error('Failed to list novel projects:', e);
      return [];
    }
  },

  createProject: async (title: string, synopsis?: string, targetPaper?: string) => {
    set({ isLoading: true });
    try {
      const proj = await createNovelProject(title, synopsis, targetPaper);
      await get().loadProjects();
      await get().setVaultPath(proj.path);
      set({ isBookshelfOpen: false, isLoading: false });
      return proj;
    } catch (e) {
      console.error('Failed to create novel project:', e);
      set({ isLoading: false });
      return null;
    }
  },

  deleteProject: async (projectPath: string) => {
    try {
      await deleteNovelProject(projectPath);
      const remaining = await get().loadProjects();
      const currentVault = get().vaultPath;
      if (currentVault === projectPath) {
        if (remaining.length > 0) {
          await get().setVaultPath(remaining[0].path);
        } else {
          set({ vaultPath: null, files: [], activeFilePath: null });
        }
      }
    } catch (e) {
      console.error('Failed to delete novel project:', e);
    }
  },

  importProject: async (folderPath: string) => {
    set({ isLoading: true });
    try {
      const proj = await importNovelProject(folderPath);
      await get().loadProjects();
      await get().setVaultPath(proj.path);
      set({ isBookshelfOpen: false, isLoading: false });
      return proj;
    } catch (e) {
      console.error('Failed to import novel project:', e);
      set({ isLoading: false });
      return null;
    }
  },

  switchProject: async (projectPath: string) => {
    await get().setVaultPath(projectPath);
    set({ isBookshelfOpen: false });
  },

  setVaultPath: async (path: string) => {
    set({ vaultPath: path, isLoading: true });
    try {
      const files = await openVault(path);
      const git = await getGitStatus(path).catch(() => null);
      set({ files, gitStatus: git, isLoading: false });

      // Load World Graph & Sync Status asynchronously
      useWorldGraphStore.getState().loadGraph(path);
      useSyncStore.getState().loadStatus(path);
      useSyncStore.getState().loadConfig(path);

      // Auto-select first episode if available
      const findFirst = (nodes: FileNode[]): string | null => {
        for (const n of nodes) {
          if (!n.is_dir) return n.path;
          if (n.children) {
            const f = findFirst(n.children);
            if (f) return f;
          }
        }
        return null;
      };

      const first = findFirst(files);
      if (first) {
        await get().selectFile(first);
      }
    } catch (e) {
      console.error('Failed to open vault:', e);
      set({ isLoading: false });
    }
  },

  loadSampleProject: async () => {
    set({ isLoading: true });
    try {
      const samplePath = await createSampleProject();
      await get().setVaultPath(samplePath);
    } catch (e) {
      console.error('Failed to load sample:', e);
      set({ isLoading: false });
    }
  },

  refreshFiles: async () => {
    const { vaultPath } = get();
    if (!vaultPath) return;
    try {
      const files = await openVault(vaultPath);
      set({ files });
    } catch (e) {
      console.error(e);
    }
  },

  refreshGitStatus: async () => {
    const { vaultPath } = get();
    if (!vaultPath) return;
    try {
      const git = await getGitStatus(vaultPath);
      set({ gitStatus: git });
    } catch (e) {
      console.error(e);
    }
  },

  selectFile: async (path: string) => {
    set({ activeFilePath: path });
    await useEditorStore.getState().loadFile(path);
  },

  addEpisode: async (title: string) => {
    const { vaultPath, refreshFiles, selectFile } = get();
    if (!vaultPath) return null;
    try {
      const newPath = await createNewEpisode(vaultPath, title);
      await refreshFiles();
      await selectFile(newPath);
      useSyncStore.getState().loadStatus(vaultPath);
      return newPath;
    } catch (e) {
      console.error('Failed to add episode:', e);
      return null;
    }
  },

  reorderEpisodesList: async (orderedPaths: string[]) => {
    const { vaultPath, refreshFiles } = get();
    if (!vaultPath) return;
    try {
      await reorderEpisodes(vaultPath, orderedPaths);
      await refreshFiles();
      useSyncStore.getState().loadStatus(vaultPath);
    } catch (e) {
      console.error('Failed to reorder episodes:', e);
    }
  },

  removeEpisode: async (filePath: string) => {
    const { vaultPath, refreshFiles, activeFilePath } = get();
    if (!vaultPath) return;
    try {
      await deleteEpisode(vaultPath, filePath);
      await refreshFiles();
      useSyncStore.getState().loadStatus(vaultPath);

      // If active file was deleted, switch to first remaining file
      if (activeFilePath === filePath) {
        const remaining = get().files.filter((f) => !f.is_dir && f.path !== filePath);
        if (remaining.length > 0) {
          await get().selectFile(remaining[0].path);
        } else {
          set({ activeFilePath: null });
        }
      }
    } catch (e) {
      console.error('Failed to delete episode:', e);
    }
  },

  snapshotCurrentState: async () => {
    const { vaultPath, refreshGitStatus } = get();
    if (!vaultPath) return;
    const now = new Date();
    const timeStr = now.toLocaleDateString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    await gitAutoCommit(vaultPath, `記念保存（${timeStr}）`);
    await refreshGitStatus();
    set({ isSnapshotSaved: true });
    setTimeout(() => set({ isSnapshotSaved: false }), 3000);
  },
}));

interface EditorState {
  frontmatter: Frontmatter | null;
  body: string;
  isDirty: boolean;
  fontSize: number;
  fontFamily: 'serif' | 'sans';
  theme: 'warm-dark' | 'cream-sepia';
  showLineNumbers: boolean;
  isVerticalPreviewOpen: boolean;
  targetCharCount: number;
  metrics: ManuscriptMetrics;
  lintIssues: LintIssue[];
  isZenFocus: boolean;
  isTyping: boolean;
  isInspectorPinned: boolean;
  loadFile: (path: string) => Promise<void>;
  updateBody: (newBody: string) => void;
  updateFrontmatterField: (patch: Partial<Frontmatter>) => void;
  save: () => Promise<void>;
  changeStatus: (status: SceneStatus) => Promise<void>;
  setFontSize: (size: number) => void;
  setFontFamily: (family: 'serif' | 'sans') => void;
  toggleTheme: () => void;
  toggleLineNumbers: () => void;
  toggleVerticalPreview: () => void;
  setTargetCharCount: (target: number) => void;
  setIsZenFocus: (val: boolean) => void;
  setIsTyping: (val: boolean) => void;
  toggleInspectorPin: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  frontmatter: null,
  body: '',
  isDirty: false,
  fontSize: 17,
  fontFamily: 'serif',
  theme: 'warm-dark',
  showLineNumbers: false,
  isVerticalPreviewOpen: false,
  targetCharCount: 10000,
  metrics: {
    total_chars: 0,
    chars_without_whitespace: 0,
    total_lines: 0,
    genko_20x20_pages: 0,
    genko_40x40_pages: 0,
    estimated_reading_time_min: 0,
  },
  lintIssues: [],
  isZenFocus: false,
  isTyping: false,
  isInspectorPinned: false,

  loadFile: async (path: string) => {
    try {
      const raw = await readNovelFile(path);
      const [fm, body] = await parseDocument(raw);
      const metrics = await calculateMetrics(body);
      const issues = await lintJapaneseText(body);
      set({
        frontmatter: fm,
        body,
        isDirty: false,
        metrics,
        lintIssues: issues,
      });

      // Trigger scene graph analysis
      const vaultPath = useVaultStore.getState().vaultPath;
      if (vaultPath) {
        useWorldGraphStore.getState().analyzeScene(vaultPath, body);
      }
    } catch (e) {
      console.error('Failed to load file:', e);
    }
  },

  updateBody: (newBody: string) => {
    set({ body: newBody, isDirty: true });
    calculateMetrics(newBody).then((metrics) => set({ metrics }));
    lintJapaneseText(newBody).then((issues) => set({ lintIssues: issues }));
  },

  updateFrontmatterField: (patch: Partial<Frontmatter>) => {
    const { frontmatter } = get();
    const updated = {
      ...(frontmatter || { title: '', status: 'draft' as SceneStatus }),
      ...patch,
    };
    set({ frontmatter: updated, isDirty: true });
  },

  save: async () => {
    const { body, frontmatter } = get();
    const activePath = useVaultStore.getState().activeFilePath;
    if (!activePath) return;

    try {
      // Re-combine frontmatter and body seamlessly
      const fmToSave = frontmatter || { status: 'draft' as SceneStatus };
      const fullDocument = await updateFrontmatter(body, fmToSave);
      await saveNovelFile(activePath, fullDocument);
      set({ isDirty: false });
      useVaultStore.getState().refreshGitStatus();

      const vaultPath = useVaultStore.getState().vaultPath;
      if (vaultPath) {
        useWorldGraphStore.getState().analyzeScene(vaultPath, body);
        useSyncStore.getState().loadStatus(vaultPath);
      }
      useVaultStore.getState().refreshFiles();
    } catch (e) {
      console.error('Save failed:', e);
    }
  },

  changeStatus: async (status: SceneStatus) => {
    get().updateFrontmatterField({ status });
    await get().save();
  },

  setFontSize: (fontSize: number) => set({ fontSize }),
  setFontFamily: (fontFamily: 'serif' | 'sans') => set({ fontFamily }),
  toggleTheme: () => set((state) => ({ theme: state.theme === 'warm-dark' ? 'cream-sepia' : 'warm-dark' })),
  toggleLineNumbers: () => set((state) => ({ showLineNumbers: !state.showLineNumbers })),
  toggleVerticalPreview: () => set((state) => ({ isVerticalPreviewOpen: !state.isVerticalPreviewOpen })),
  setTargetCharCount: (targetCharCount: number) => set({ targetCharCount }),
  setIsZenFocus: (isZenFocus: boolean) => set({ isZenFocus }),
  setIsTyping: (isTyping: boolean) => set({ isTyping }),
  toggleInspectorPin: () => set((state) => ({ isInspectorPinned: !state.isInspectorPinned })),
}));

interface DiffState {
  activeShadowBranch: string | null;
  diffFiles: DiffFile[];
  isDiffOpen: boolean;
  loadDiff: (branchName: string) => Promise<void>;
  acceptRevision: () => Promise<void>;
  rejectRevision: () => Promise<void>;
  closeDiff: () => void;
}

export const useDiffStore = create<DiffState>((set, get) => ({
  activeShadowBranch: null,
  diffFiles: [],
  isDiffOpen: false,

  loadDiff: async (branchName: string) => {
    const vaultPath = useVaultStore.getState().vaultPath;
    if (!vaultPath) return;
    try {
      const diffs = await gitGetDiff(vaultPath, branchName);
      set({ activeShadowBranch: branchName, diffFiles: diffs, isDiffOpen: true });
    } catch (e) {
      console.error('Diff error:', e);
    }
  },

  acceptRevision: async () => {
    const { activeShadowBranch } = get();
    const vaultPath = useVaultStore.getState().vaultPath;
    if (!vaultPath || !activeShadowBranch) return;

    await gitApplyRevision(vaultPath, activeShadowBranch);
    set({ activeShadowBranch: null, diffFiles: [], isDiffOpen: false });
    const activeFile = useVaultStore.getState().activeFilePath;
    if (activeFile) {
      await useEditorStore.getState().loadFile(activeFile);
    }
    await useVaultStore.getState().refreshFiles();
    await useVaultStore.getState().refreshGitStatus();
  },

  rejectRevision: async () => {
    const { activeShadowBranch } = get();
    const vaultPath = useVaultStore.getState().vaultPath;
    if (!vaultPath || !activeShadowBranch) return;

    await gitDiscardRevision(vaultPath, activeShadowBranch);
    set({ activeShadowBranch: null, diffFiles: [], isDiffOpen: false });
  },

  closeDiff: () => set({ isDiffOpen: false }),
}));

interface AiState {
  isReviewing: boolean;
  isGeneratingBeats: boolean;
  isExpandingDraft: boolean;
  lastError: string | null;
  runReview: (userPrompt: string) => Promise<void>;
  generateBeats: (vaultPath: string, overallPlot: string, episodeSynopsis: string) => Promise<string | null>;
  expandDraft: (
    vaultPath: string,
    filePath: string,
    overallPlot: string,
    episodeSynopsis: string,
    instruction: string
  ) => Promise<void>;
}

function getStoredAiConfig(): AiConfig {
  const provider = (localStorage.getItem('novel_studio_provider') || 'gemini') as AiProviderType;
  const apiKey = localStorage.getItem('novel_studio_api_key') || undefined;
  const model = localStorage.getItem('novel_studio_model') || (provider === 'gemini' ? 'gemini-1.5-pro' : 'gpt-4o');
  const baseUrl = localStorage.getItem('novel_studio_base_url') || undefined;

  return {
    provider,
    model,
    api_key: apiKey,
    base_url: baseUrl,
  };
}

export const useAiStore = create<AiState>((set) => ({
  isReviewing: false,
  isGeneratingBeats: false,
  isExpandingDraft: false,
  lastError: null,

  runReview: async (userPrompt: string) => {
    const vaultPath = useVaultStore.getState().vaultPath;
    const activeFile = useVaultStore.getState().activeFilePath;
    if (!vaultPath || !activeFile) {
      set({ lastError: '本棚とエピソードを選択してください。' });
      return;
    }

    set({ isReviewing: true, lastError: null });
    const config = getStoredAiConfig();

    try {
      const result = await aiRunRevision(vaultPath, activeFile, userPrompt, config);
      useDiffStore.setState({
        activeShadowBranch: result.branch_name,
        diffFiles: result.diffs,
        isDiffOpen: true,
      });
      set({ isReviewing: false });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ isReviewing: false, lastError: msg });
      console.error('AI Review Error:', e);
    }
  },

  generateBeats: async (vaultPath: string, overallPlot: string, episodeSynopsis: string) => {
    set({ isGeneratingBeats: true, lastError: null });
    const config = getStoredAiConfig();
    try {
      const beats = await aiGenerateSceneBeats(vaultPath, overallPlot, episodeSynopsis, config);
      set({ isGeneratingBeats: false });
      return beats;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ isGeneratingBeats: false, lastError: msg });
      console.error('AI Generate Beats Error:', e);
      return null;
    }
  },

  expandDraft: async (vaultPath, filePath, overallPlot, episodeSynopsis, instruction) => {
    set({ isExpandingDraft: true, lastError: null });
    const config = getStoredAiConfig();
    try {
      const result = await aiExpandSceneDraft(
        vaultPath,
        filePath,
        overallPlot,
        episodeSynopsis,
        instruction,
        config
      );
      useDiffStore.setState({
        activeShadowBranch: result.branch_name,
        diffFiles: result.diffs,
        isDiffOpen: true,
      });
      set({ isExpandingDraft: false });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ isExpandingDraft: false, lastError: msg });
      console.error('AI Expand Draft Error:', e);
    }
  },
}));

// World Graph Store (Phase 7 GraphRAG & Visual World Studio)
interface WorldGraphState {
  graphData: GraphData;
  selectedNodeId: string | null;
  sceneAnalysis: SceneGraphAnalysis | null;
  overallPlot: string;
  notes: string[];
  isLoading: boolean;
  isSyncingManuscript: boolean;
  syncResultNotice: string | null;
  loadGraph: (vaultPath: string) => Promise<void>;
  upsertNode: (vaultPath: string, node: WorldNode) => Promise<WorldNode | null>;
  deleteNode: (vaultPath: string, nodeId: string) => Promise<void>;
  upsertEdge: (vaultPath: string, edge: WorldEdge) => Promise<WorldEdge | null>;
  deleteEdge: (vaultPath: string, edgeId: string) => Promise<void>;
  analyzeScene: (vaultPath: string, text: string) => Promise<void>;
  setSelectedNodeId: (id: string | null) => void;
  loadOverallPlot: (vaultPath: string) => Promise<void>;
  saveOverallPlotText: (vaultPath: string, plot: string) => Promise<void>;
  loadNotesList: (vaultPath: string) => Promise<void>;
  readNoteContent: (vaultPath: string, noteName: string) => Promise<string>;
  saveNoteContent: (vaultPath: string, noteName: string, content: string) => Promise<void>;
  syncAllNotes: (vaultPath: string) => Promise<void>;
  syncManuscriptToWorldAction: (vaultPath: string, text: string) => Promise<SyncManuscriptResult | null>;
  clearGraph: (vaultPath: string) => Promise<void>;
}

export const useWorldGraphStore = create<WorldGraphState>((set, get) => ({
  graphData: { nodes: [], edges: [] },
  selectedNodeId: null,
  sceneAnalysis: null,
  overallPlot: '',
  notes: [],
  isLoading: false,
  isSyncingManuscript: false,
  syncResultNotice: null,

  loadGraph: async (vaultPath: string) => {
    set({ isLoading: true });
    try {
      const data = await getWorldGraph(vaultPath);
      set({ graphData: data, isLoading: false });
      // Also load plot and notes in background
      get().loadOverallPlot(vaultPath);
      get().loadNotesList(vaultPath);
    } catch (e) {
      console.error('Failed to load world graph:', e);
      set({ isLoading: false });
    }
  },

  loadOverallPlot: async (vaultPath: string) => {
    try {
      const plot = await getOverallPlot(vaultPath);
      set({ overallPlot: plot });
    } catch (e) {
      console.error('Failed to load overall plot:', e);
    }
  },

  saveOverallPlotText: async (vaultPath: string, plot: string) => {
    try {
      const updatedGraph = await saveOverallPlot(vaultPath, plot);
      set({ overallPlot: plot, graphData: updatedGraph });
      useSyncStore.getState().loadStatus(vaultPath);
    } catch (e) {
      console.error('Failed to save overall plot:', e);
    }
  },

  loadNotesList: async (vaultPath: string) => {
    try {
      const notes = await listWorldNotes(vaultPath);
      set({ notes });
    } catch (e) {
      console.error('Failed to list notes:', e);
    }
  },

  readNoteContent: async (vaultPath: string, noteName: string) => {
    try {
      return await readWorldNote(vaultPath, noteName);
    } catch (e) {
      console.error('Failed to read note:', e);
      return '';
    }
  },

  saveNoteContent: async (vaultPath: string, noteName: string, content: string) => {
    try {
      const updatedGraph = await saveWorldNote(vaultPath, noteName, content);
      set({ graphData: updatedGraph });
      await get().loadNotesList(vaultPath);
      useSyncStore.getState().loadStatus(vaultPath);
    } catch (e) {
      console.error('Failed to save note:', e);
    }
  },

  syncAllNotes: async (vaultPath: string) => {
    try {
      const updatedGraph = await syncNotesToGraph(vaultPath);
      set({ graphData: updatedGraph });
      useSyncStore.getState().loadStatus(vaultPath);
    } catch (e) {
      console.error('Failed to sync notes:', e);
    }
  },

  upsertNode: async (vaultPath: string, node: WorldNode) => {
    try {
      const saved = await upsertWorldNode(vaultPath, node);
      await get().loadGraph(vaultPath);
      useSyncStore.getState().loadStatus(vaultPath);
      return saved;
    } catch (e) {
      console.error('Failed to upsert node:', e);
      return null;
    }
  },

  deleteNode: async (vaultPath: string, nodeId: string) => {
    try {
      await deleteWorldNode(vaultPath, nodeId);
      if (get().selectedNodeId === nodeId) {
        set({ selectedNodeId: null });
      }
      await get().loadGraph(vaultPath);
      useSyncStore.getState().loadStatus(vaultPath);
    } catch (e) {
      console.error('Failed to delete node:', e);
    }
  },

  upsertEdge: async (vaultPath: string, edge: WorldEdge) => {
    try {
      const saved = await upsertWorldEdge(vaultPath, edge);
      await get().loadGraph(vaultPath);
      useSyncStore.getState().loadStatus(vaultPath);
      return saved;
    } catch (e) {
      console.error('Failed to upsert edge:', e);
      return null;
    }
  },

  deleteEdge: async (vaultPath: string, edgeId: string) => {
    try {
      await deleteWorldEdge(vaultPath, edgeId);
      await get().loadGraph(vaultPath);
      useSyncStore.getState().loadStatus(vaultPath);
    } catch (e) {
      console.error('Failed to delete edge:', e);
    }
  },

  analyzeScene: async (vaultPath: string, text: string) => {
    try {
      const analysis = await analyzeSceneGraph(vaultPath, text);
      set({ sceneAnalysis: analysis });
    } catch (e) {
      console.error('Failed to analyze scene graph:', e);
    }
  },

  setSelectedNodeId: (id: string | null) => set({ selectedNodeId: id }),

  syncManuscriptToWorldAction: async (vaultPath: string, text: string) => {
    set({ isSyncingManuscript: true, syncResultNotice: null });
    const config = getStoredAiConfig();
    try {
      const result = await syncManuscriptToWorld(
        vaultPath,
        text,
        config.api_key ? config : undefined
      );
      set({
        graphData: result.graph,
        syncResultNotice: result.message,
        isSyncingManuscript: false,
      });
      // Refresh notes list and sync status
      get().loadNotesList(vaultPath);
      useSyncStore.getState().loadStatus(vaultPath);
      setTimeout(() => {
        set({ syncResultNotice: null });
      }, 4000);
      return result;
    } catch (e: unknown) {
      console.error('Failed to sync manuscript to world:', e);
      set({ isSyncingManuscript: false });
      return null;
    }
  },

  clearGraph: async (vaultPath: string) => {
    set({ isLoading: true });
    try {
      const emptyGraph = await clearWorldGraph(vaultPath);
      set({
        graphData: emptyGraph,
        selectedNodeId: null,
        sceneAnalysis: null,
        overallPlot: '',
        isLoading: false,
      });
      await get().loadNotesList(vaultPath);
      useSyncStore.getState().loadStatus(vaultPath);
    } catch (e) {
      console.error('Failed to clear world graph:', e);
      set({ isLoading: false });
    }
  },
}));

// Export Store (Phase 10 Publication & Web Novel Export Studio)
interface ExportState {
  isOpen: boolean;
  options: ExportOptions;
  result: ExportResult | null;
  isLoading: boolean;
  savedPath: string | null;
  openExportModal: () => void;
  closeExportModal: () => void;
  setFormat: (format: ExportOptions['format']) => void;
  setIncludeCover: (include_cover: boolean) => void;
  setIncludeChapterTitles: (include_chapter_titles: boolean) => void;
  runExport: (vaultPath: string) => Promise<void>;
  saveToFile: (vaultPath: string, fileName: string, content: string) => Promise<string | null>;
}

export const useExportStore = create<ExportState>((set, get) => ({
  isOpen: false,
  options: {
    format: 'submission_txt',
    include_cover: true,
    include_chapter_titles: true,
  },
  result: null,
  isLoading: false,
  savedPath: null,

  openExportModal: () => {
    set({ isOpen: true, savedPath: null });
    const vaultPath = useVaultStore.getState().vaultPath;
    if (vaultPath) {
      get().runExport(vaultPath);
    }
  },

  closeExportModal: () => set({ isOpen: false }),

  setFormat: (format) => {
    set((state) => ({ options: { ...state.options, format } }));
    const vaultPath = useVaultStore.getState().vaultPath;
    if (vaultPath) {
      get().runExport(vaultPath);
    }
  },

  setIncludeCover: (include_cover) => {
    set((state) => ({ options: { ...state.options, include_cover } }));
    const vaultPath = useVaultStore.getState().vaultPath;
    if (vaultPath) {
      get().runExport(vaultPath);
    }
  },

  setIncludeChapterTitles: (include_chapter_titles) => {
    set((state) => ({ options: { ...state.options, include_chapter_titles } }));
    const vaultPath = useVaultStore.getState().vaultPath;
    if (vaultPath) {
      get().runExport(vaultPath);
    }
  },

  runExport: async (vaultPath: string) => {
    set({ isLoading: true, savedPath: null });
    try {
      const res = await exportManuscript(vaultPath, get().options);
      set({ result: res, isLoading: false });
    } catch (e) {
      console.error('Failed to export manuscript:', e);
      set({ isLoading: false });
    }
  },

  saveToFile: async (vaultPath: string, fileName: string, content: string) => {
    try {
      const path = await saveExportedFile(vaultPath, fileName, content);
      set({ savedPath: path });
      return path;
    } catch (e) {
      console.error('Failed to save export file:', e);
      return null;
    }
  },
}));

// Auto-Sync Store (Phase 7 Zero-Touch Cloud Sync & Phase 13 Cloud Direct Connect)
interface SyncState {
  status: SyncStatus | null;
  config: SyncConfig | null;
  cloudDetections: CloudStorageDetections | null;
  isLoading: boolean;
  loadStatus: (vaultPath: string) => Promise<void>;
  loadConfig: (vaultPath: string) => Promise<void>;
  loadCloudDetections: (vaultPath?: string) => Promise<CloudStorageDetections | null>;
  connectCloud: (vaultPath: string, storageType: string) => Promise<void>;
  connectGh: (vaultPath: string) => Promise<void>;
  saveConfig: (vaultPath: string, config: SyncConfig) => Promise<void>;
  triggerSync: (vaultPath: string, reason: string) => Promise<void>;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  status: null,
  config: null,
  cloudDetections: null,
  isLoading: false,

  loadStatus: async (vaultPath: string) => {
    try {
      const status = await getSyncStatus(vaultPath);
      set({ status });
    } catch (e) {
      console.error('Failed to get sync status:', e);
    }
  },

  loadConfig: async (vaultPath: string) => {
    try {
      const config = await getSyncConfig(vaultPath);
      set({ config });
    } catch (e) {
      console.error('Failed to get sync config:', e);
    }
  },

  loadCloudDetections: async (vaultPath?: string) => {
    try {
      const detections = await getCloudStorageDetections(vaultPath);
      set({ cloudDetections: detections });
      return detections;
    } catch (e) {
      console.error('Failed to get cloud storage detections:', e);
      return null;
    }
  },

  connectCloud: async (vaultPath: string, storageType: string) => {
    set({ isLoading: true });
    try {
      const config = await connectCloudStorage(vaultPath, storageType);
      set({ config });
      await get().loadStatus(vaultPath);
      await get().loadCloudDetections(vaultPath);
      set({ isLoading: false });
    } catch (e) {
      console.error('Failed to connect cloud storage:', e);
      set({ isLoading: false });
    }
  },

  connectGh: async (vaultPath: string) => {
    set({ isLoading: true });
    try {
      const config = await connectGithubCli(vaultPath);
      set({ config });
      await get().loadStatus(vaultPath);
      await get().loadCloudDetections(vaultPath);
      set({ isLoading: false });
    } catch (e) {
      console.error('Failed to connect GitHub CLI:', e);
      set({ isLoading: false });
    }
  },

  saveConfig: async (vaultPath: string, config: SyncConfig) => {
    try {
      await saveSyncConfig(vaultPath, config);
      set({ config });
      const status = await triggerAutoSync(vaultPath, '同期設定の更新');
      set({ status });
      await get().loadCloudDetections(vaultPath);
    } catch (e) {
      console.error('Failed to save sync config:', e);
    }
  },

  triggerSync: async (vaultPath: string, reason: string) => {
    set({ isLoading: true });
    try {
      const status = await triggerAutoSync(vaultPath, reason);
      set({ status, isLoading: false });
    } catch (e) {
      console.error('Failed to trigger sync:', e);
      set({ isLoading: false });
    }
  },
}));

// Phase 13 AI Service Detection & Fast Testing Store
interface AiServiceState {
  services: DetectedAiServices | null;
  isLoading: boolean;
  isTesting: boolean;
  testResult: string | null;
  detectServices: () => Promise<DetectedAiServices | null>;
  testConnection: (config: AiConfig) => Promise<string>;
}

export const useAiServiceStore = create<AiServiceState>((set) => ({
  services: null,
  isLoading: false,
  isTesting: false,
  testResult: null,

  detectServices: async () => {
    set({ isLoading: true });
    try {
      const services = await detectAiServices();
      set({ services, isLoading: false });
      return services;
    } catch (e) {
      console.error('Failed to detect AI services:', e);
      set({ isLoading: false });
      return null;
    }
  },

  testConnection: async (config: AiConfig) => {
    set({ isTesting: true, testResult: null });
    try {
      const result = await testAiConnection(config);
      set({ testResult: result, isTesting: false });
      return result;
    } catch (e: any) {
      const errMsg = `❌ 接続失敗: ${e?.message || e || 'タイムアウトまたは設定エラー'}`;
      set({ testResult: errMsg, isTesting: false });
      return errMsg;
    }
  },
}));
