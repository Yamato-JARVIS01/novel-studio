pub mod editor_engine;
pub mod storage;
pub mod ai;

#[tauri::command]
fn ping_command() -> String {
    "pong from NovelStudio backend".to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            ping_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
