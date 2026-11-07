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
  calculateMetrics,
  lintJapaneseText,
  parseDocument,
  readNovelFile,
  saveNovelFile,
  updateSceneStatus,
  openVault,
  getGitStatus,
  gitAutoCommit,
  gitGetDiff,
  gitApplyRevision,
  gitDiscardRevision,
  aiRunRevision,
} from '../lib/tauri-commands';

interface VaultState {
  vaultPath: string | null;
  files: FileNode[];
  activeFilePath: string | null;
  gitStatus: GitStatusInfo | null;
  isLoading: boolean;
  setVaultPath: (path: string) => Promise<void>;
  refreshFiles: () => Promise<void>;
  refreshGitStatus: () => Promise<void>;
  selectFile: (path: string) => Promise<void>;
  commitCurrentVault: (message: string) => Promise<void>;
}

export const useVaultStore = create<VaultState>((set, get) => ({
  vaultPath: null,
  files: [],
  activeFilePath: null,
  gitStatus: null,
  isLoading: false,

  setVaultPath: async (path: string) => {
    set({ vaultPath: path, isLoading: true });
    try {
      const files = await openVault(path);
      const git = await getGitStatus(path).catch(() => null);
      set({ files, gitStatus: git, isLoading: false });

      // Auto-select first markdown file if available
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
    useEditorStore.getState().loadFile(path);
  },

  commitCurrentVault: async (message: string) => {
    const { vaultPath, refreshGitStatus } = get();
    if (!vaultPath) return;
    await gitAutoCommit(vaultPath, message);
    await refreshGitStatus();
  },
}));

interface EditorState {
  rawContent: string;
  frontmatter: Frontmatter | null;
  body: string;
  isDirty: boolean;
  fontSize: number;
  fontFamily: 'serif' | 'sans';
  metrics: ManuscriptMetrics;
  lintIssues: LintIssue[];
  loadFile: (path: string) => Promise<void>;
  updateContent: (newContent: string) => void;
  save: () => Promise<void>;
  changeStatus: (status: SceneStatus) => Promise<void>;
  setFontSize: (size: number) => void;
  setFontFamily: (family: 'serif' | 'sans') => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  rawContent: '',
  frontmatter: null,
  body: '',
  isDirty: false,
  fontSize: 16,
  fontFamily: 'serif',
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
        rawContent: raw,
        frontmatter: fm,
        body,
        isDirty: false,
        metrics,
        lintIssues: issues,
      });
    } catch (e) {
      console.error('Failed to load file:', e);
    }
  },

  updateContent: (newContent: string) => {
    set({ rawContent: newContent, isDirty: true });
    parseDocument(newContent).then(([fm, body]) => {
      set({ frontmatter: fm, body });
      calculateMetrics(body).then((metrics) => set({ metrics }));
      lintJapaneseText(body).then((issues) => set({ lintIssues: issues }));
    });
  },

  save: async () => {
    const { rawContent } = get();
    const activePath = useVaultStore.getState().activeFilePath;
    if (!activePath) return;

    try {
      await saveNovelFile(activePath, rawContent);
      set({ isDirty: false });
      useVaultStore.getState().refreshGitStatus();
      useVaultStore.getState().refreshFiles();
    } catch (e) {
      console.error('Save failed:', e);
    }
  },

  changeStatus: async (status: SceneStatus) => {
    const { rawContent, save } = get();
    const updated = await updateSceneStatus(rawContent, status);
    get().updateContent(updated);
    await save();
  },

  setFontSize: (fontSize: number) => set({ fontSize }),
  setFontFamily: (fontFamily: 'serif' | 'sans') => set({ fontFamily }),
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
      set({ lastError: 'プロジェクトとファイルを選択してください。' });
      return;
    }

    set({ isReviewing: true, lastError: null });

    // Retrieve settings from localStorage
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
      // Auto open diff view
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
