pub mod editor_engine;
pub mod storage;
pub mod ai;
pub mod world_graph;
pub mod export;

use std::path::Path;
use editor_engine::frontmatter::{extract_frontmatter, update_frontmatter, update_status, Frontmatter, SceneStatus};
use editor_engine::jp_linter::{calculate_metrics, lint_japanese_text, LintConfig, LintIssue, ManuscriptMetrics};
use storage::git_manager::{CommitHistoryItem, DiffFile, GitManager, GitStatusInfo};
use storage::auto_sync::{AutoSyncEngine, SyncConfig, SyncStatus};
use storage::{FileNode, StorageManager};
use ai::provider::AiConfig;
use ai::pipeline::{AiPipeline, RevisionResult};
use world_graph::{GraphData, KuzuGraphEngine, SceneGraphAnalysis, SyncManuscriptResult, WorldEdge, WorldNode};
use export::{ExportEngine, ExportOptions, ExportResult};

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

#[tauri::command]
fn git_get_file_history(repo_path: String, file_path: String) -> Result<Vec<CommitHistoryItem>, String> {
    let r_path = Path::new(&repo_path);
    let f_path = Path::new(&file_path);
    let rel_path = f_path.strip_prefix(r_path).unwrap_or(f_path);
    let rel_str = rel_path.to_string_lossy().to_string();

    let repo = GitManager::init_or_open(r_path).map_err(|e| e.to_string())?;
    GitManager::get_file_history(&repo, &rel_str).map_err(|e| e.to_string())
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

#[tauri::command]
fn list_world_notes(vault_path: String) -> Result<Vec<String>, String> {
    let engine = KuzuGraphEngine::new(Path::new(&vault_path));
    engine.list_notes().map_err(|e| e.to_string())
}

#[tauri::command]
fn read_world_note(vault_path: String, note_name: String) -> Result<String, String> {
    let engine = KuzuGraphEngine::new(Path::new(&vault_path));
    engine.read_note(&note_name).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_world_note(vault_path: String, note_name: String, content: String) -> Result<GraphData, String> {
    let engine = KuzuGraphEngine::new(Path::new(&vault_path));
    let graph = engine.save_note(&note_name, &content).map_err(|e| e.to_string())?;
    AutoSyncEngine::trigger_sync(Path::new(&vault_path), &format!("設定ノート更新: {}", note_name));
    Ok(graph)
}

#[tauri::command]
fn get_overall_plot(vault_path: String) -> Result<String, String> {
    let engine = KuzuGraphEngine::new(Path::new(&vault_path));
    engine.get_overall_plot().map_err(|e| e.to_string())
}

#[tauri::command]
fn save_overall_plot(vault_path: String, plot: String) -> Result<GraphData, String> {
    let engine = KuzuGraphEngine::new(Path::new(&vault_path));
    let graph = engine.save_overall_plot(&plot).map_err(|e| e.to_string())?;
    AutoSyncEngine::trigger_sync(Path::new(&vault_path), "全体筋書きプロット更新");
    Ok(graph)
}

#[tauri::command]
fn sync_notes_to_graph(vault_path: String) -> Result<GraphData, String> {
    let engine = KuzuGraphEngine::new(Path::new(&vault_path));
    let graph = engine.sync_notes_to_graph().map_err(|e| e.to_string())?;
    AutoSyncEngine::trigger_sync(Path::new(&vault_path), "ノート相関同期");
    Ok(graph)
}

#[tauri::command]
async fn extract_graph_with_ai_command(
    vault_path: String,
    text: String,
    config: AiConfig,
) -> Result<GraphData, String> {
    let engine = KuzuGraphEngine::new(Path::new(&vault_path));
    let graph = engine.extract_graph_with_ai(&text, &config).await.map_err(|e| e.to_string())?;
    AutoSyncEngine::trigger_sync(Path::new(&vault_path), "AI世界観構造抽出");
    Ok(graph)
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

// Phase 9 Bi-directional Manuscript to World Graph Sync
#[tauri::command]
async fn sync_manuscript_to_world_command(
    vault_path: String,
    manuscript_text: String,
    config: Option<AiConfig>,
) -> Result<SyncManuscriptResult, String> {
    let engine = KuzuGraphEngine::new(Path::new(&vault_path));
    let result = engine
        .sync_manuscript_to_world(&manuscript_text, config.as_ref())
        .await
        .map_err(|e| e.to_string())?;
    AutoSyncEngine::trigger_sync(Path::new(&vault_path), "原稿から世界観設定を自動還元");
    Ok(result)
}

// Phase 9 Plot HUD Scene Beats & Draft Expansion
#[tauri::command]
async fn ai_generate_scene_beats_command(
    vault_path: String,
    overall_plot: String,
    episode_synopsis: String,
    config: AiConfig,
) -> Result<String, String> {
    AiPipeline::generate_scene_beats(
        Path::new(&vault_path),
        &overall_plot,
        &episode_synopsis,
        &config,
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ai_expand_scene_draft_command(
    vault_path: String,
    file_path: String,
    overall_plot: String,
    episode_synopsis: String,
    instruction: String,
    config: AiConfig,
) -> Result<RevisionResult, String> {
    AiPipeline::expand_scene_draft(
        Path::new(&vault_path),
        Path::new(&file_path),
        &overall_plot,
        &episode_synopsis,
        &instruction,
        &config,
    )
    .await
    .map_err(|e| e.to_string())
}

// Phase 10 Manuscript Export Studio IPC
#[tauri::command]
fn export_manuscript_command(
    vault_path: String,
    options: ExportOptions,
) -> Result<ExportResult, String> {
    ExportEngine::export_vault(Path::new(&vault_path), &options).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_exported_file_command(
    vault_path: String,
    file_name: String,
    content: String,
) -> Result<String, String> {
    ExportEngine::save_export_file(Path::new(&vault_path), &file_name, &content)
        .map_err(|e| e.to_string())
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
            git_get_file_history,
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
            list_world_notes,
            read_world_note,
            save_world_note,
            get_overall_plot,
            save_overall_plot,
            sync_notes_to_graph,
            extract_graph_with_ai_command,
            sync_manuscript_to_world_command,
            ai_generate_scene_beats_command,
            ai_expand_scene_draft_command,
            export_manuscript_command,
            save_exported_file_command,
            get_sync_status,
            get_sync_config,
            save_sync_config,
            trigger_auto_sync,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
