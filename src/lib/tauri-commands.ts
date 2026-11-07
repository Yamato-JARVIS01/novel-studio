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
