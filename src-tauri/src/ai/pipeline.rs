use super::provider::{AiConfig, AiProvider};
use crate::storage::git_manager::{DiffFile, GitManager};
use keyring::Entry;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum PipelineError {
    #[error("AI Provider error: {0}")]
    Ai(#[from] super::provider::AiError),
    #[error("Git error: {0}")]
    Git(#[from] crate::storage::git_manager::GitError),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Keyring error: {0}")]
    Keyring(#[from] keyring::Error),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RevisionResult {
    pub branch_name: String,
    pub original_content: String,
    pub revised_content: String,
    pub diffs: Vec<DiffFile>,
}

pub struct AiPipeline;

impl AiPipeline {
    /// Save API key into OS native Keyring (Keychain on macOS)
    pub fn save_api_key(provider: &str, key: &str) -> Result<(), PipelineError> {
        let entry = Entry::new("NovelStudio", provider)?;
        entry.set_password(key)?;
        Ok(())
    }

    /// Retrieve API key from OS native Keyring
    pub fn get_api_key(provider: &str) -> Option<String> {
        let entry = Entry::new("NovelStudio", provider).ok()?;
        entry.get_password().ok()
    }

    /// Run full AI revision pipeline:
    /// 1. Query LLM
    /// 2. Create shadow git branch
    /// 3. Commit revision into shadow branch
    /// 4. Generate Diff files
    pub async fn run_revision(
        repo_path: &Path,
        file_path: &Path,
        user_prompt: &str,
        config: &AiConfig,
    ) -> Result<RevisionResult, PipelineError> {
        let repo = GitManager::init_or_open(repo_path)?;
        let original_content = fs::read_to_string(file_path)?;

        // Ensure clean or auto-commit current state
        let _ = GitManager::auto_commit(&repo, "Auto-commit before AI revision");

        // 1. Automatically extract GraphRAG context from World Graph
        let graph_engine = crate::world_graph::KuzuGraphEngine::new(repo_path);
        let graph_context = graph_engine.build_ai_graph_context(&original_content).unwrap_or_default();

        let enhanced_user_prompt = if !graph_context.is_empty() {
            format!(
                "{}\n\n【世界観グラフ自動注入コンテキスト (GraphRAG)】\n{}\n\n【追加指示】上記のキャラクター設定（一人称・口調）・関係性・プロット伏線との矛盾が生じないよう厳密に配慮して推敲してください。",
                user_prompt, graph_context
            )
        } else {
            user_prompt.to_string()
        };

        // 2. Call AI Provider with Graph-augmented prompt
        let provider = AiProvider::new();
        let revised_content = provider.request_review(config, &enhanced_user_prompt, &original_content).await?;

        // 2. Generate branch name with timestamp
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let branch_name = format!("novel-studio/revision-{}", timestamp);

        // 3. Create shadow branch
        GitManager::create_shadow_branch(&repo, &branch_name)?;

        // 4. Temporarily write revised content and commit to branch
        fs::write(file_path, &revised_content)?;
        GitManager::auto_commit(&repo, &format!("AI Revision on {}", branch_name))?;

        // 5. Compute diff
        let diffs = GitManager::get_diff_against_branch(&repo, &branch_name)?;

        // 6. Restore original file in working tree so user can inspect via diff merge UI
        fs::write(file_path, &original_content)?;

        Ok(RevisionResult {
            branch_name,
            original_content,
            revised_content,
            diffs,
        })
    }

    /// Generate 3-5 structured scene beat proposals from overall plot & episode synopsis
    pub async fn generate_scene_beats(
        repo_path: &Path,
        overall_plot: &str,
        episode_synopsis: &str,
        config: &AiConfig,
    ) -> Result<String, PipelineError> {
        let graph_engine = crate::world_graph::KuzuGraphEngine::new(repo_path);
        let graph_context = graph_engine.build_ai_graph_context(episode_synopsis).unwrap_or_default();

        let system_prompt = r#"あなたはプロの構成作家・小説シナリオライターです。
与えられた【全体構成】と【今回の話筋書き（Synopsis）】、そして【世界観・登場人物設定】を統合し、このエピソードを魅力的に描くための「3〜5個の具体的なシーン構成ビート（起承転結・動線）」を提案してください。

【出力要件】
- 起承転結の各ビートごとに：
  - 【ビート名（例: 【起】楼上への潜入と異変）】
  - 状況・登場人物の葛藤・感情の動き
  - 発生する出来事・アクション
  - シーンの到達点・次への引き
- 簡潔で実践的なMarkdown箇条書き形式で出力してください。"#;

        let user_content = format!(
            "【全体構成 (Overall Plot)】\n{}\n\n【今回の話筋書き (Episode Synopsis)】\n{}\n\n【世界観グラフ・人物相関 (GraphRAG)】\n{}",
            if overall_plot.is_empty() { "（未設定）" } else { overall_plot },
            if episode_synopsis.is_empty() { "（未設定）" } else { episode_synopsis },
            if graph_context.is_empty() { "（なし）" } else { &graph_context }
        );

        let provider = AiProvider::new();
        let beats = provider.request_review(config, system_prompt, &user_content).await?;
        Ok(beats)
    }

    /// Expand scene draft or write continuation based on synopsis and world graph,
    /// committing into shadow branch to allow direct Inline Diff adoption.
    pub async fn expand_scene_draft(
        repo_path: &Path,
        file_path: &Path,
        overall_plot: &str,
        episode_synopsis: &str,
        instruction: &str,
        config: &AiConfig,
    ) -> Result<RevisionResult, PipelineError> {
        let repo = GitManager::init_or_open(repo_path)?;
        let original_content = fs::read_to_string(file_path)?;

        let _ = GitManager::auto_commit(&repo, "Auto-commit before scene draft expansion");

        let graph_engine = crate::world_graph::KuzuGraphEngine::new(repo_path);
        let graph_context = graph_engine.build_ai_graph_context(&original_content).unwrap_or_default();

        let system_prompt = r#"あなたはプロの純文学・エンタメ小説の執筆共同制作者です。
作家の原稿、全体構成、話筋書き、および世界観設定情報をもとに、作家の指示に沿って原稿の続きの執筆、または既存シーンの描写深化・下書き展開を行ってください。

【執筆ルール】
1. 作品の文体・トーン＆マナー（語彙、文末のリズム、改行頻度、一人称・三人称の視点）を完全に継承すること。
2. 登場人物の一人称、二人称、口調、感情の動機を世界観設定と厳密に一致させること。
3. すでに書かれている原稿の前半部分はそのまま残し、指示された続きの展開や描写強化を自然に組み込んだ【完全な原稿全文（Frontmatter付き）】を出力してください。
4. 解説や前置き・後書きは一切含めず、原稿本文のみを出力してください。"#;

        let user_content = format!(
            "【作家からの加筆指示】\n{}\n\n【全体構成】\n{}\n\n【今回の話筋書き】\n{}\n\n【世界観設定 (GraphRAG)】\n{}\n\n【現在の原稿本文】\n{}",
            instruction,
            if overall_plot.is_empty() { "（なし）" } else { overall_plot },
            if episode_synopsis.is_empty() { "（なし）" } else { episode_synopsis },
            if graph_context.is_empty() { "（なし）" } else { &graph_context },
            original_content
        );

        let provider = AiProvider::new();
        let mut revised_content = provider.request_review(config, system_prompt, &user_content).await?;

        // Clean codeblock markdown markers if AI wrapped the entire text
        if revised_content.starts_with("```markdown\n") || revised_content.starts_with("```\n") {
            if let Some(start) = revised_content.find('\n') {
                revised_content = revised_content[start + 1..].to_string();
                if let Some(end) = revised_content.rfind("```") {
                    revised_content = revised_content[..end].to_string();
                }
            }
        }

        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let branch_name = format!("novel-studio/draft-expand-{}", timestamp);

        GitManager::create_shadow_branch(&repo, &branch_name)?;
        fs::write(file_path, &revised_content)?;
        GitManager::auto_commit(&repo, &format!("AI Draft Expansion on {}", branch_name))?;
        let diffs = GitManager::get_diff_against_branch(&repo, &branch_name)?;
        fs::write(file_path, &original_content)?;

        Ok(RevisionResult {
            branch_name,
            original_content,
            revised_content,
            diffs,
        })
    }
}
