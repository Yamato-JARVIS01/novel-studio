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
}
