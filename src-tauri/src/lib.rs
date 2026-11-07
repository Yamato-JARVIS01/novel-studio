pub mod editor_engine;
pub mod storage;
pub mod ai;

use editor_engine::frontmatter::{extract_frontmatter, update_frontmatter, update_status, Frontmatter, SceneStatus};
use editor_engine::jp_linter::{calculate_metrics, lint_japanese_text, LintConfig, LintIssue, ManuscriptMetrics};

#[tauri::command]
fn ping_command() -> String {
    "pong from NovelStudio backend".to_string()
}

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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
