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
