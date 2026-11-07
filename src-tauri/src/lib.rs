pub mod editor_engine;
pub mod storage;
pub mod ai;

use std::path::Path;
use editor_engine::frontmatter::{extract_frontmatter, update_frontmatter, update_status, Frontmatter, SceneStatus};
use editor_engine::jp_linter::{calculate_metrics, lint_japanese_text, LintConfig, LintIssue, ManuscriptMetrics};
use storage::git_manager::{DiffFile, GitManager, GitStatusInfo};
use storage::{FileNode, StorageManager};
use ai::provider::AiConfig;
use ai::pipeline::{AiPipeline, RevisionResult};

#[tauri::command]
fn ping_command() -> String {
    "pong from NovelStudio backend".to_string()
}

// Editor Engine IPC
#[tauri::command]
fn parse_document(content: String) -> (Option<Frontmatter>, String) {
    extract_frontmatter(&content)
}

#[tauri::command]
fn update_frontmatter_command(content: String, frontmatter: Frontmatter) -> Result<String, String> {
    update_frontmatter(&content, &frontmatter).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_scene_status(content: String, status: SceneStatus) -> Result<String, String> {
    update_status(&content, status).map_err(|e| e.to_string())
}

#[tauri::command]
fn calculate_metrics_command(text: String) -> ManuscriptMetrics {
    calculate_metrics(&text)
}

#[tauri::command]
fn lint_japanese_text_command(text: String, config: Option<LintConfig>) -> Vec<LintIssue> {
    lint_japanese_text(&text, config.as_ref())
}

// Storage & Git IPC
#[tauri::command]
fn open_vault(vault_path: String) -> Result<Vec<FileNode>, String> {
    let path = Path::new(&vault_path);
    let _ = GitManager::init_or_open(path);
    StorageManager::list_vault_files(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_novel_file(file_path: String) -> Result<String, String> {
    let path = Path::new(&file_path);
    StorageManager::read_file(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_novel_file(file_path: String, content: String) -> Result<(), String> {
    let path = Path::new(&file_path);
    StorageManager::save_file(path, &content).map_err(|e| e.to_string())
}

#[tauri::command]
fn git_status(repo_path: String) -> Result<GitStatusInfo, String> {
    let path = Path::new(&repo_path);
    let repo = GitManager::init_or_open(path).map_err(|e| e.to_string())?;
    GitManager::get_status(&repo).map_err(|e| e.to_string())
}

#[tauri::command]
fn git_auto_commit(repo_path: String, message: String) -> Result<String, String> {
    let path = Path::new(&repo_path);
    let repo = GitManager::init_or_open(path).map_err(|e| e.to_string())?;
    GitManager::auto_commit(&repo, &message).map_err(|e| e.to_string())
}

#[tauri::command]
fn git_create_shadow_branch(repo_path: String, branch_name: String) -> Result<(), String> {
    let path = Path::new(&repo_path);
    let repo = GitManager::init_or_open(path).map_err(|e| e.to_string())?;
    GitManager::create_shadow_branch(&repo, &branch_name).map_err(|e| e.to_string())
}

#[tauri::command]
fn git_get_diff(repo_path: String, branch_name: String) -> Result<Vec<DiffFile>, String> {
    let path = Path::new(&repo_path);
    let repo = GitManager::init_or_open(path).map_err(|e| e.to_string())?;
    GitManager::get_diff_against_branch(&repo, &branch_name).map_err(|e| e.to_string())
}

#[tauri::command]
fn git_apply_revision(repo_path: String, branch_name: String) -> Result<(), String> {
    let path = Path::new(&repo_path);
    let repo = GitManager::init_or_open(path).map_err(|e| e.to_string())?;
    GitManager::apply_shadow_branch(&repo, &branch_name).map_err(|e| e.to_string())
}

#[tauri::command]
fn git_discard_revision(repo_path: String, branch_name: String) -> Result<(), String> {
    let path = Path::new(&repo_path);
    let repo = GitManager::init_or_open(path).map_err(|e| e.to_string())?;
    GitManager::discard_shadow_branch(&repo, &branch_name).map_err(|e| e.to_string())
}

// AI Engine IPC
#[tauri::command]
async fn ai_run_revision(
    repo_path: String,
    file_path: String,
    user_prompt: String,
    config: AiConfig,
) -> Result<RevisionResult, String> {
    let r_path = Path::new(&repo_path);
    let f_path = Path::new(&file_path);
    AiPipeline::run_revision(r_path, f_path, &user_prompt, &config)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn save_api_key_command(provider: String, api_key: String) -> Result<(), String> {
    AiPipeline::save_api_key(&provider, &api_key).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_api_key_command(provider: String) -> Result<Option<String>, String> {
    Ok(AiPipeline::get_api_key(&provider))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            ping_command,
            parse_document,
            update_frontmatter_command,
            update_scene_status,
            calculate_metrics_command,
            lint_japanese_text_command,
            open_vault,
            read_novel_file,
            save_novel_file,
            git_status,
            git_auto_commit,
            git_create_shadow_branch,
            git_get_diff,
            git_apply_revision,
            git_discard_revision,
            ai_run_revision,
            save_api_key_command,
            get_api_key_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
