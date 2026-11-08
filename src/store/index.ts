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
} from '../lib/tauri-commands';

interface VaultState {
  vaultPath: string | null;
  files: FileNode[];
  activeFilePath: string | null;
  gitStatus: GitStatusInfo | null;
  isLoading: boolean;
  isSnapshotSaved: boolean;
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
  lastError: string | null;
  runReview: (userPrompt: string) => Promise<void>;
}

export const useAiStore = create<AiState>((set) => ({
  isReviewing: false,
  lastError: null,

  runReview: async (userPrompt: string) => {
    const vaultPath = useVaultStore.getState().vaultPath;
    const activeFile = useVaultStore.getState().activeFilePath;
    if (!vaultPath || !activeFile) {
      set({ lastError: '本棚とエピソードを選択してください。' });
      return;
    }

    set({ isReviewing: true, lastError: null });

    const provider = (localStorage.getItem('novel_studio_provider') || 'gemini') as AiProviderType;
    const apiKey = localStorage.getItem('novel_studio_api_key') || undefined;
    const model = localStorage.getItem('novel_studio_model') || (provider === 'gemini' ? 'gemini-1.5-pro' : 'gpt-4o');
    const baseUrl = localStorage.getItem('novel_studio_base_url') || undefined;

    const config: AiConfig = {
      provider,
      model,
      api_key: apiKey,
      base_url: baseUrl,
    };

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
}));

// World Graph Store (Phase 7 GraphRAG & Visual World Studio)
interface WorldGraphState {
  graphData: GraphData;
  selectedNodeId: string | null;
  sceneAnalysis: SceneGraphAnalysis | null;
  isLoading: boolean;
  loadGraph: (vaultPath: string) => Promise<void>;
  upsertNode: (vaultPath: string, node: WorldNode) => Promise<WorldNode | null>;
  deleteNode: (vaultPath: string, nodeId: string) => Promise<void>;
  upsertEdge: (vaultPath: string, edge: WorldEdge) => Promise<WorldEdge | null>;
  deleteEdge: (vaultPath: string, edgeId: string) => Promise<void>;
  analyzeScene: (vaultPath: string, text: string) => Promise<void>;
  setSelectedNodeId: (id: string | null) => void;
}

export const useWorldGraphStore = create<WorldGraphState>((set, get) => ({
  graphData: { nodes: [], edges: [] },
  selectedNodeId: null,
  sceneAnalysis: null,
  isLoading: false,

  loadGraph: async (vaultPath: string) => {
    set({ isLoading: true });
    try {
      const data = await getWorldGraph(vaultPath);
      set({ graphData: data, isLoading: false });
    } catch (e) {
      console.error('Failed to load world graph:', e);
      set({ isLoading: false });
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
}));

// Auto-Sync Store (Phase 7 Zero-Touch Cloud Sync)
interface SyncState {
  status: SyncStatus | null;
  config: SyncConfig | null;
  isLoading: boolean;
  loadStatus: (vaultPath: string) => Promise<void>;
  loadConfig: (vaultPath: string) => Promise<void>;
  saveConfig: (vaultPath: string, config: SyncConfig) => Promise<void>;
  triggerSync: (vaultPath: string, reason: string) => Promise<void>;
}

export const useSyncStore = create<SyncState>((set) => ({
  status: null,
  config: null,
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

  saveConfig: async (vaultPath: string, config: SyncConfig) => {
    try {
      await saveSyncConfig(vaultPath, config);
      set({ config });
      const status = await triggerAutoSync(vaultPath, '同期設定の更新');
      set({ status });
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
