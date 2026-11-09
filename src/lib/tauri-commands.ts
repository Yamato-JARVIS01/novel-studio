import { invoke } from '@tauri-apps/api/core';

export type SceneStatus = 'draft' | 'ready' | 'reviewed';

export interface Frontmatter {
  title?: string;
  status?: SceneStatus;
  pov?: string;
  timeline?: string;
  location?: string;
  characters?: string[];
  synopsis?: string;
  [key: string]: unknown;
}

export interface ManuscriptMetrics {
  total_chars: number;
  chars_without_whitespace: number;
  total_lines: number;
  genko_20x20_pages: number;
  genko_40x40_pages: number;
  estimated_reading_time_min: number;
}

export interface LintIssue {
  id: string;
  line: number;
  column: number;
  message: string;
  suggestion?: string;
  severity: 'info' | 'warning' | 'error';
  matched_text: string;
}

export interface LintConfig {
  check_indent: boolean;
  check_ellipsis: boolean;
  check_dash: boolean;
  check_closing_quote_punct: boolean;
  check_exclamation_space: boolean;
  check_duplicate_punctuation: boolean;
}

export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  extension?: string;
  children?: FileNode[];
  status?: string;
}

export interface GitStatusInfo {
  current_branch: string;
  is_clean: boolean;
  modified_files: string[];
  untracked_files: string[];
}

export interface CommitHistoryItem {
  commit_id: string;
  message: string;
  author: string;
  timestamp: number;
  date_str: string;
  content: string | null;
}

export interface DiffLine {
  line_type: 'Context' | 'Addition' | 'Deletion';
  old_lineno: number | null;
  new_lineno: number | null;
  content: string;
}

export interface DiffHunk {
  header: string;
  old_start: number;
  old_lines: number;
  new_start: number;
  new_lines: number;
  lines: DiffLine[];
}

export interface DiffFile {
  old_path: string | null;
  new_path: string | null;
  hunks: DiffHunk[];
}

export type AiProviderType = 'openai' | 'gemini' | 'claude' | 'ollama';

export interface AiConfig {
  provider: AiProviderType;
  model: string;
  api_key?: string;
  base_url?: string;
}

export interface RevisionResult {
  branch_name: string;
  original_content: string;
  revised_content: string;
  diffs: DiffFile[];
}

// Phase 13 Bookshelf & Cloud/AI Detections
export interface NovelProjectItem {
  path: string;
  title: string;
  synopsis: string;
  target_paper: string; // "400" | "1600" | "short"
  total_chars: number;
  episode_count: number;
  last_modified: string;
  is_sample: boolean;
}

export interface CloudStorageDetections {
  icloud_available: boolean;
  icloud_path?: string;
  google_drive_available: boolean;
  google_drive_path?: string;
  local_backup_path: string;
  gh_cli_available: boolean;
  gh_username?: string;
  active_mirror_type?: string;
}

export interface DetectedAiServices {
  ollama_running: boolean;
  ollama_models: string[];
  lmstudio_running: boolean;
  lmstudio_models: string[];
  has_gemini_env: boolean;
  has_openai_env: boolean;
  has_claude_env: boolean;
  gemini_env_key?: string;
  openai_env_key?: string;
  claude_env_key?: string;
}

// Commands
export async function pingBackend(): Promise<string> {
  return await invoke<string>('ping_command');
}

export async function parseDocument(content: string): Promise<[Frontmatter | null, string]> {
  return await invoke<[Frontmatter | null, string]>('parse_document', { content });
}

export async function updateFrontmatter(content: string, frontmatter: Frontmatter): Promise<string> {
  return await invoke<string>('update_frontmatter_command', { content, frontmatter });
}

export async function updateSceneStatus(content: string, status: SceneStatus): Promise<string> {
  return await invoke<string>('update_scene_status', { content, status });
}

export async function calculateMetrics(text: string): Promise<ManuscriptMetrics> {
  return await invoke<ManuscriptMetrics>('calculate_metrics_command', { text });
}

export async function lintJapaneseText(text: string, config?: LintConfig): Promise<LintIssue[]> {
  return await invoke<LintIssue[]>('lint_japanese_text_command', { text, config });
}

export async function openVault(vaultPath: string): Promise<FileNode[]> {
  return await invoke<FileNode[]>('open_vault', { vaultPath });
}

export async function readNovelFile(filePath: string): Promise<string> {
  return await invoke<string>('read_novel_file', { filePath });
}

export async function saveNovelFile(filePath: string, content: string): Promise<void> {
  return await invoke<void>('save_novel_file', { filePath, content });
}

export async function createSampleProject(): Promise<string> {
  return await invoke<string>('create_sample_project');
}

export async function createNewEpisode(vaultPath: string, fileName: string): Promise<string> {
  return await invoke<string>('create_new_episode', { vaultPath, fileName });
}

export async function getGitStatus(repoPath: string): Promise<GitStatusInfo> {
  return await invoke<GitStatusInfo>('git_status', { repoPath });
}

export async function gitAutoCommit(repoPath: string, message: string): Promise<string> {
  return await invoke<string>('git_auto_commit', { repoPath, message });
}

export async function gitCreateShadowBranch(repoPath: string, branchName: string): Promise<void> {
  return await invoke<void>('git_create_shadow_branch', { repoPath, branchName });
}

export async function gitGetDiff(repoPath: string, branchName: string): Promise<DiffFile[]> {
  return await invoke<DiffFile[]>('git_get_diff', { repoPath, branchName });
}

export async function gitApplyRevision(repoPath: string, branchName: string): Promise<void> {
  return await invoke<void>('git_apply_revision', { repoPath, branchName });
}

export async function gitDiscardRevision(repoPath: string, branchName: string): Promise<void> {
  return await invoke<void>('git_discard_revision', { repoPath, branchName });
}

export async function getFileHistory(repoPath: string, filePath: string): Promise<CommitHistoryItem[]> {
  return await invoke<CommitHistoryItem[]>('git_get_file_history', { repoPath, filePath });
}

export async function aiRunRevision(
  repoPath: string,
  filePath: string,
  userPrompt: string,
  config: AiConfig
): Promise<RevisionResult> {
  return await invoke<RevisionResult>('ai_run_revision', {
    repoPath,
    filePath,
    userPrompt,
    config,
  });
}

export async function saveApiKey(provider: string, apiKey: string): Promise<void> {
  return await invoke<void>('save_api_key_command', { provider, apiKey });
}

export async function getApiKey(provider: string): Promise<string | null> {
  return await invoke<string | null>('get_api_key_command', { provider });
}

// World Graph & GraphRAG Types & Commands
export type WorldNodeType = 'character' | 'term' | 'plot' | 'location';

export interface WorldNode {
  id: string;
  node_type: WorldNodeType | string;
  name: string;
  aliases: string[];
  summary: string;
  attributes: Record<string, string>;
  full_text?: string;
  created_at: string;
  updated_at: string;
  // Phase 11 extensions
  image_data?: string;
  long_note?: string;
  phase_id?: string;
  pos_x?: number;
  pos_y?: number;
}

export interface WorldEdge {
  id: string;
  source_id: string;
  target_id: string;
  relation_type: string;
  description: string;
  // Phase 11 extensions
  phase_id?: string;
  color?: string;
}

export interface GraphData {
  nodes: WorldNode[];
  edges: WorldEdge[];
}

export interface SceneGraphAnalysis {
  active_nodes: WorldNode[];
  active_edges: WorldEdge[];
  consistency_hints: string[];
}

export interface SyncStatus {
  state: 'synced' | 'syncing' | 'idle' | 'offline' | 'error' | string;
  message: string;
  last_synced_at?: string;
  target_destinations: string[];
}

export interface SyncConfig {
  auto_sync_enabled: boolean;
  github_remote_url?: string;
  github_pat?: string;
  mirror_folder_path?: string;
}

export async function getWorldGraph(vaultPath: string): Promise<GraphData> {
  return await invoke<GraphData>('get_world_graph', { vaultPath });
}

export async function upsertWorldNode(vaultPath: string, node: WorldNode): Promise<WorldNode> {
  return await invoke<WorldNode>('upsert_world_node', { vaultPath, node });
}

export async function deleteWorldNode(vaultPath: string, nodeId: string): Promise<void> {
  return await invoke<void>('delete_world_node', { vaultPath, nodeId });
}

export async function upsertWorldEdge(vaultPath: string, edge: WorldEdge): Promise<WorldEdge> {
  return await invoke<WorldEdge>('upsert_world_edge', { vaultPath, edge });
}

export async function deleteWorldEdge(vaultPath: string, edgeId: string): Promise<void> {
  return await invoke<void>('delete_world_edge', { vaultPath, edgeId });
}

export async function buildAiGraphContext(vaultPath: string, manuscriptText: string): Promise<string> {
  return await invoke<string>('build_ai_graph_context', { vaultPath, manuscriptText });
}

export async function analyzeSceneGraph(vaultPath: string, manuscriptText: string): Promise<SceneGraphAnalysis> {
  return await invoke<SceneGraphAnalysis>('analyze_scene_graph', { vaultPath, manuscriptText });
}

export async function listWorldNotes(vaultPath: string): Promise<string[]> {
  return await invoke<string[]>('list_world_notes', { vaultPath });
}

export async function readWorldNote(vaultPath: string, noteName: string): Promise<string> {
  return await invoke<string>('read_world_note', { vaultPath, noteName });
}

export async function saveWorldNote(vaultPath: string, noteName: string, content: string): Promise<GraphData> {
  return await invoke<GraphData>('save_world_note', { vaultPath, noteName, content });
}

export async function getOverallPlot(vaultPath: string): Promise<string> {
  return await invoke<string>('get_overall_plot', { vaultPath });
}

export async function saveOverallPlot(vaultPath: string, plot: string): Promise<GraphData> {
  return await invoke<GraphData>('save_overall_plot', { vaultPath, plot });
}

export async function syncNotesToGraph(vaultPath: string): Promise<GraphData> {
  return await invoke<GraphData>('sync_notes_to_graph', { vaultPath });
}

export async function extractGraphWithAi(vaultPath: string, text: string, config: AiConfig): Promise<GraphData> {
  return await invoke<GraphData>('extract_graph_with_ai_command', { vaultPath, text, config });
}

// GUI Episode Organizer & Sync Commands
export async function reorderEpisodes(vaultPath: string, orderedPaths: string[]): Promise<void> {
  return await invoke<void>('reorder_episodes', { vaultPath, orderedPaths });
}

export async function deleteEpisode(vaultPath: string, filePath: string): Promise<string> {
  return await invoke<string>('delete_episode', { vaultPath, filePath });
}

export async function getSyncStatus(vaultPath: string): Promise<SyncStatus> {
  return await invoke<SyncStatus>('get_sync_status', { vaultPath });
}

export async function getSyncConfig(vaultPath: string): Promise<SyncConfig> {
  return await invoke<SyncConfig>('get_sync_config', { vaultPath });
}

export async function saveSyncConfig(vaultPath: string, config: SyncConfig): Promise<void> {
  return await invoke<void>('save_sync_config', { vaultPath, config });
}

export async function triggerAutoSync(vaultPath: string, reason: string): Promise<SyncStatus> {
  return await invoke<SyncStatus>('trigger_auto_sync', { vaultPath, reason });
}

// Phase 9 & 10 Commands & Types
export interface SyncManuscriptResult {
  added_nodes_count: number;
  added_edges_count: number;
  added_nodes: WorldNode[];
  added_edges: WorldEdge[];
  message: string;
  graph: GraphData;
}

export interface ExportOptions {
  format: 'submission_txt' | 'submission_html' | 'kakuyomu' | 'narou' | 'aozora' | 'plain';
  include_cover: boolean;
  include_chapter_titles: boolean;
}

export interface ExportResult {
  title: string;
  content: string;
  format: string;
  char_count: number;
  page_count_400: number;
  page_count_20x20: number;
  page_count_40x40: number;
  episode_count: number;
  suggested_filename: string;
}

export async function syncManuscriptToWorld(
  vaultPath: string,
  manuscriptText: string,
  config?: AiConfig
): Promise<SyncManuscriptResult> {
  return await invoke<SyncManuscriptResult>('sync_manuscript_to_world_command', {
    vaultPath,
    manuscriptText,
    config: config || null,
  });
}

export async function aiGenerateSceneBeats(
  vaultPath: string,
  overallPlot: string,
  episodeSynopsis: string,
  config: AiConfig
): Promise<string> {
  return await invoke<string>('ai_generate_scene_beats_command', {
    vaultPath,
    overallPlot,
    episodeSynopsis,
    config,
  });
}

export async function aiExpandSceneDraft(
  vaultPath: string,
  filePath: string,
  overallPlot: string,
  episodeSynopsis: string,
  instruction: string,
  config: AiConfig
): Promise<RevisionResult> {
  return await invoke<RevisionResult>('ai_expand_scene_draft_command', {
    vaultPath,
    filePath,
    overallPlot,
    episodeSynopsis,
    instruction,
    config,
  });
}

export async function exportManuscript(
  vaultPath: string,
  options: ExportOptions
): Promise<ExportResult> {
  return await invoke<ExportResult>('export_manuscript_command', {
    vaultPath,
    options,
  });
}

export async function saveExportedFile(
  vaultPath: string,
  fileName: string,
  content: string
): Promise<string> {
  return await invoke<string>('save_exported_file_command', {
    vaultPath,
    fileName,
    content,
  });
}

// Phase 13 Bookshelf & Cloud/AI One-Click Connection
export async function getDefaultLibraryPath(): Promise<string> {
  return await invoke<string>('get_default_library_path');
}

export async function listNovelProjects(): Promise<NovelProjectItem[]> {
  return await invoke<NovelProjectItem[]>('list_novel_projects');
}

export async function createNovelProject(
  title: string,
  synopsis?: string,
  targetPaper?: string
): Promise<NovelProjectItem> {
  return await invoke<NovelProjectItem>('create_novel_project', {
    title,
    synopsis,
    targetPaper,
  });
}

export async function deleteNovelProject(projectPath: string): Promise<string> {
  return await invoke<string>('delete_novel_project', { projectPath });
}

export async function importNovelProject(folderPath: string): Promise<NovelProjectItem> {
  return await invoke<NovelProjectItem>('import_novel_project', { folderPath });
}

export async function getCloudStorageDetections(
  vaultPath?: string
): Promise<CloudStorageDetections> {
  return await invoke<CloudStorageDetections>('get_cloud_storage_detections', { vaultPath });
}

export async function connectCloudStorage(
  vaultPath: string,
  storageType: string
): Promise<SyncConfig> {
  return await invoke<SyncConfig>('connect_cloud_storage', {
    vaultPath,
    storageType,
  });
}

export async function connectGithubCli(vaultPath: string): Promise<SyncConfig> {
  return await invoke<SyncConfig>('connect_github_cli', { vaultPath });
}

export async function detectAiServices(): Promise<DetectedAiServices> {
  return await invoke<DetectedAiServices>('detect_ai_services_command');
}

export async function testAiConnection(config: AiConfig): Promise<string> {
  return await invoke<string>('test_ai_connection_command', { config });
}

