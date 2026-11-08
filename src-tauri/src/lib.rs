pub mod editor_engine;
pub mod storage;
pub mod ai;
pub mod world_graph;

use std::path::Path;
use editor_engine::frontmatter::{extract_frontmatter, update_frontmatter, update_status, Frontmatter, SceneStatus};
use editor_engine::jp_linter::{calculate_metrics, lint_japanese_text, LintConfig, LintIssue, ManuscriptMetrics};
use storage::git_manager::{DiffFile, GitManager, GitStatusInfo};
use storage::auto_sync::{AutoSyncEngine, SyncConfig, SyncStatus};
use storage::{FileNode, StorageManager};
use ai::provider::AiConfig;
use ai::pipeline::{AiPipeline, RevisionResult};
use world_graph::{GraphData, KuzuGraphEngine, SceneGraphAnalysis, WorldEdge, WorldNode};

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
fn create_sample_project() -> Result<String, String> {
    StorageManager::create_sample_project().map_err(|e| e.to_string())
}

#[tauri::command]
fn create_new_episode(vault_path: String, file_name: String) -> Result<String, String> {
    let path = Path::new(&vault_path);
    StorageManager::create_new_episode(path, &file_name).map_err(|e| e.to_string())
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

// World Graph & GraphRAG IPC
#[tauri::command]
fn get_world_graph(vault_path: String) -> Result<GraphData, String> {
    let engine = KuzuGraphEngine::new(Path::new(&vault_path));
    engine.get_graph().map_err(|e| e.to_string())
}

#[tauri::command]
fn upsert_world_node(vault_path: String, node: WorldNode) -> Result<WorldNode, String> {
    let engine = KuzuGraphEngine::new(Path::new(&vault_path));
    let result = engine.upsert_node(node).map_err(|e| e.to_string())?;
    AutoSyncEngine::trigger_sync(Path::new(&vault_path), &format!("設定ノード更新: {}", result.name));
    Ok(result)
}

#[tauri::command]
fn delete_world_node(vault_path: String, node_id: String) -> Result<(), String> {
    let engine = KuzuGraphEngine::new(Path::new(&vault_path));
    engine.delete_node(&node_id).map_err(|e| e.to_string())?;
    AutoSyncEngine::trigger_sync(Path::new(&vault_path), "設定ノード削除");
    Ok(())
}

#[tauri::command]
fn upsert_world_edge(vault_path: String, edge: WorldEdge) -> Result<WorldEdge, String> {
    let engine = KuzuGraphEngine::new(Path::new(&vault_path));
    let result = engine.upsert_edge(edge).map_err(|e| e.to_string())?;
    AutoSyncEngine::trigger_sync(Path::new(&vault_path), &format!("相関関係更新: {}", result.relation_type));
    Ok(result)
}

#[tauri::command]
fn delete_world_edge(vault_path: String, edge_id: String) -> Result<(), String> {
    let engine = KuzuGraphEngine::new(Path::new(&vault_path));
    engine.delete_edge(&edge_id).map_err(|e| e.to_string())?;
    AutoSyncEngine::trigger_sync(Path::new(&vault_path), "相関関係削除");
    Ok(())
}

#[tauri::command]
fn build_ai_graph_context(vault_path: String, manuscript_text: String) -> Result<String, String> {
    let engine = KuzuGraphEngine::new(Path::new(&vault_path));
    engine.build_ai_graph_context(&manuscript_text).map_err(|e| e.to_string())
}

#[tauri::command]
fn analyze_scene_graph(vault_path: String, manuscript_text: String) -> Result<SceneGraphAnalysis, String> {
    let engine = KuzuGraphEngine::new(Path::new(&vault_path));
    engine.analyze_scene(&manuscript_text).map_err(|e| e.to_string())
}

// GUI Episode Organizer & Sync IPC
#[tauri::command]
fn reorder_episodes(vault_path: String, ordered_paths: Vec<String>) -> Result<(), String> {
    StorageManager::reorder_episodes(Path::new(&vault_path), &ordered_paths).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_episode(vault_path: String, file_path: String) -> Result<String, String> {
    StorageManager::delete_episode(Path::new(&vault_path), Path::new(&file_path)).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_sync_status(vault_path: String) -> Result<SyncStatus, String> {
    Ok(AutoSyncEngine::get_status(Path::new(&vault_path)))
}

#[tauri::command]
fn get_sync_config(vault_path: String) -> Result<SyncConfig, String> {
    Ok(AutoSyncEngine::load_config(Path::new(&vault_path)))
}

#[tauri::command]
fn save_sync_config(vault_path: String, config: SyncConfig) -> Result<(), String> {
    AutoSyncEngine::save_config(Path::new(&vault_path), &config).map_err(|e| e.to_string())
}

#[tauri::command]
fn trigger_auto_sync(vault_path: String, reason: String) -> Result<SyncStatus, String> {
    Ok(AutoSyncEngine::trigger_sync(Path::new(&vault_path), &reason))
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
            create_sample_project,
            create_new_episode,
            reorder_episodes,
            delete_episode,
            git_status,
            git_auto_commit,
            git_create_shadow_branch,
            git_get_diff,
            git_apply_revision,
            git_discard_revision,
            ai_run_revision,
            save_api_key_command,
            get_api_key_command,
            get_world_graph,
            upsert_world_node,
            delete_world_node,
            upsert_world_edge,
            delete_world_edge,
            build_ai_graph_context,
            analyze_scene_graph,
            get_sync_status,
            get_sync_config,
            save_sync_config,
            trigger_auto_sync,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
