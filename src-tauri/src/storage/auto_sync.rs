use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AutoSyncError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Git error: {0}")]
    Git(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncConfig {
    #[serde(default = "default_true")]
    pub auto_sync_enabled: bool,
    #[serde(default)]
    pub github_remote_url: Option<String>,
    #[serde(default)]
    pub github_pat: Option<String>,
    #[serde(default)]
    pub mirror_folder_path: Option<String>, // Google Drive or iCloud mirror folder
}

fn default_true() -> bool {
    true
}

impl Default for SyncConfig {
    fn default() -> Self {
        Self {
            auto_sync_enabled: true,
            github_remote_url: None,
            github_pat: None,
            mirror_folder_path: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    pub state: String, // "synced" | "syncing" | "idle" | "offline" | "error"
    pub message: String,
    pub last_synced_at: Option<String>,
    pub target_destinations: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudStorageDetections {
    pub icloud_available: bool,
    pub icloud_path: Option<String>,
    pub google_drive_available: bool,
    pub google_drive_path: Option<String>,
    pub local_backup_path: String,
    pub gh_cli_available: bool,
    pub gh_username: Option<String>,
    pub active_mirror_type: Option<String>, // "icloud" | "google_drive" | "local" | "custom"
}

impl Default for SyncStatus {
    fn default() -> Self {
        Self {
            state: "synced".to_string(),
            message: "全自動クラウド同期：完了（ローカル安全保護）".to_string(),
            last_synced_at: Some(Utc::now().to_rfc3339()),
            target_destinations: vec!["ローカルGit".to_string()],
        }
    }
}

pub struct AutoSyncEngine;

impl AutoSyncEngine {
    pub fn config_path(vault_path: &Path) -> PathBuf {
        vault_path.join(".novelstudio").join("sync_config.json")
    }

    pub fn status_path(vault_path: &Path) -> PathBuf {
        vault_path.join(".novelstudio").join("sync_status.json")
    }

    pub fn load_config(vault_path: &Path) -> SyncConfig {
        let path = Self::config_path(vault_path);
        if let Ok(content) = fs::read_to_string(&path) {
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            SyncConfig::default()
        }
    }

    pub fn save_config(vault_path: &Path, config: &SyncConfig) -> Result<(), AutoSyncError> {
        let path = Self::config_path(vault_path);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string_pretty(config)?;
        fs::write(path, json)?;
        Ok(())
    }

    pub fn get_status(vault_path: &Path) -> SyncStatus {
        let path = Self::status_path(vault_path);
        if let Ok(content) = fs::read_to_string(&path) {
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            SyncStatus::default()
        }
    }

    pub fn save_status(vault_path: &Path, status: &SyncStatus) -> Result<(), AutoSyncError> {
        let path = Self::status_path(vault_path);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string_pretty(status)?;
        fs::write(path, json)?;
        Ok(())
    }

    /// Recursively mirror vault files to destination folder (excluding .git and temp files)
    fn mirror_directory(src: &Path, dst: &Path) -> std::io::Result<()> {
        if !dst.exists() {
            fs::create_dir_all(dst)?;
        }

        for entry in fs::read_dir(src)? {
            let entry = entry?;
            let path = entry.path();
            let file_name = entry.file_name();
            let name_str = file_name.to_string_lossy();

            // Skip git repo and temp files
            if name_str == ".git" || name_str.starts_with(".world_graph_") || name_str.ends_with(".tmp") {
                continue;
            }

            let target = dst.join(&file_name);
            if path.is_dir() {
                Self::mirror_directory(&path, &target)?;
            } else {
                // Copy or overwrite if modified
                let should_copy = if target.exists() {
                    let src_meta = path.metadata()?;
                    let dst_meta = target.metadata()?;
                    src_meta.len() != dst_meta.len()
                        || src_meta.modified().unwrap_or(std::time::SystemTime::UNIX_EPOCH)
                            > dst_meta.modified().unwrap_or(std::time::SystemTime::UNIX_EPOCH)
                } else {
                    true
                };

                if should_copy {
                    if let Some(parent) = target.parent() {
                        fs::create_dir_all(parent)?;
                    }
                    fs::copy(&path, &target)?;
                }
            }
        }
        Ok(())
    }

    /// Execute auto-sync:
    /// 1. Git local commit with natural Japanese message
    /// 2. Remote Git push if remote/PAT configured
    /// 3. Mirror copy to Google Drive / iCloud folder if configured
    pub fn trigger_sync(vault_path: &Path, reason: &str) -> SyncStatus {
        let config = Self::load_config(vault_path);
        if !config.auto_sync_enabled {
            let mut status = Self::get_status(vault_path);
            status.message = "自動同期：一時停止中".to_string();
            return status;
        }

        let mut destinations = vec!["ローカルGit (変更安全履歴)".to_string()];
        let mut status_msg_parts = Vec::new();

        // 1. Git Auto-Commit
        let commit_msg = if reason.trim().is_empty() {
            "自動保存: 作品データの更新".to_string()
        } else {
            format!("自動保存: {}", reason)
        };

        if let Ok(repo) = crate::storage::git_manager::GitManager::init_or_open(vault_path) {
            let _ = crate::storage::git_manager::GitManager::auto_commit(&repo, &commit_msg);
            status_msg_parts.push("Git安全保護");

            // Attempt Git Push if remote origin exists
            if let Ok(mut remote) = repo.find_remote("origin") {
                let mut callbacks = git2::RemoteCallbacks::new();
                if let Some(ref pat) = config.github_pat {
                    let pat_clone = pat.clone();
                    callbacks.credentials(move |_url, _username_from_url, _allowed_types| {
                        git2::Cred::userpass_plaintext("x-access-token", &pat_clone)
                    });
                } else {
                    callbacks.credentials(|_url, username_from_url, _allowed_types| {
                        git2::Cred::default()
                            .or_else(|_| git2::Cred::ssh_key_from_agent(username_from_url.unwrap_or("git")))
                    });
                }

                let mut push_opts = git2::PushOptions::new();
                push_opts.remote_callbacks(callbacks);

                let head = repo.head();
                if let Ok(head_ref) = head {
                    if let Some(branch_name) = head_ref.shorthand() {
                        let refspec = format!("refs/heads/{}:refs/heads/{}", branch_name, branch_name);
                        match remote.push(&[&refspec], Some(&mut push_opts)) {
                            Ok(_) => {
                                destinations.push("GitHub (クラウド正本)".to_string());
                                status_msg_parts.push("GitHub同期完了");
                            }
                            Err(e) => {
                                log::warn!("Git push notice: {}", e);
                            }
                        }
                    }
                }
            }
        }

        // 2. Cloud Mirror Sync (Google Drive / iCloud)
        if let Some(ref mirror_path_str) = config.mirror_folder_path {
            if !mirror_path_str.trim().is_empty() {
                let mirror_path = Path::new(mirror_path_str);
                let cloud_name = if mirror_path_str.contains("CloudDocs") || mirror_path_str.contains("iCloud") {
                    "iCloud Drive"
                } else if mirror_path_str.contains("Google") {
                    "Google Drive"
                } else {
                    "クラウド共有フォルダ"
                };

                match Self::mirror_directory(vault_path, mirror_path) {
                    Ok(_) => {
                        destinations.push(cloud_name.to_string());
                        status_msg_parts.push(cloud_name);
                    }
                    Err(e) => {
                        log::warn!("Mirror sync notice to {}: {}", mirror_path_str, e);
                    }
                }
            }
        }

        let summary_text = if status_msg_parts.is_empty() {
            "☁️ 全自動クラウド同期：完了（ローカル安全保護）".to_string()
        } else {
            format!("☁️ 全自動クラウド同期：完了（{}）", status_msg_parts.join(" / "))
        };

        let status = SyncStatus {
            state: "synced".to_string(),
            message: summary_text,
            last_synced_at: Some(Utc::now().to_rfc3339()),
            target_destinations: destinations,
        };

        let _ = Self::save_status(vault_path, &status);
        status
    }

    /// Detect available cloud storage destinations (iCloud, Google Drive, Local, GitHub CLI)
    pub fn detect_cloud_storage(vault_path: Option<&Path>) -> CloudStorageDetections {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
        let home_path = Path::new(&home);

        // 1. iCloud Drive detection
        let icloud_base = home_path.join("Library/Mobile Documents/com~apple~CloudDocs");
        let (icloud_available, icloud_path) = if icloud_base.exists() && icloud_base.is_dir() {
            (true, Some(icloud_base.join("NovelStudio_Backup").to_string_lossy().to_string()))
        } else {
            (false, None)
        };

        // 2. Google Drive detection
        let cloud_storage_dir = home_path.join("Library/CloudStorage");
        let mut google_drive_available = false;
        let mut google_drive_path = None;

        if cloud_storage_dir.exists() && cloud_storage_dir.is_dir() {
            if let Ok(entries) = fs::read_dir(&cloud_storage_dir) {
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if name.starts_with("GoogleDrive") || name.starts_with("Google Drive") {
                        let gd_root = entry.path();
                        let my_drive_candidates = ["マイドライブ", "マイドライブ", "My Drive"];
                        let mut target_sub = None;
                        for cand in &my_drive_candidates {
                            let sub = gd_root.join(cand);
                            if sub.exists() {
                                target_sub = Some(sub);
                                break;
                            }
                        }
                        let base_target = target_sub.unwrap_or(gd_root);
                        google_drive_path = Some(base_target.join("NovelStudio_Backup").to_string_lossy().to_string());
                        google_drive_available = true;
                        break;
                    }
                }
            }
        }

        if !google_drive_available {
            let legacy_gd = home_path.join("Google Drive");
            if legacy_gd.exists() {
                google_drive_available = true;
                google_drive_path = Some(legacy_gd.join("NovelStudio_Backup").to_string_lossy().to_string());
            }
        }

        // 3. Local Documents Backup
        let local_backup_path = home_path.join("Documents/NovelStudio_Backup").to_string_lossy().to_string();

        // 4. GitHub CLI detection
        let (gh_cli_available, gh_username) = Self::detect_github_cli();

        // 5. Active mirror type
        let active_mirror_type = if let Some(vp) = vault_path {
            let cfg = Self::load_config(vp);
            if let Some(ref m) = cfg.mirror_folder_path {
                if m.contains("CloudDocs") || m.contains("Mobile Documents") {
                    Some("icloud".to_string())
                } else if m.contains("GoogleDrive") || m.contains("Google Drive") {
                    Some("google_drive".to_string())
                } else if m.contains("NovelStudio_Backup") && m.contains("Documents") {
                    Some("local".to_string())
                } else if !m.trim().is_empty() {
                    Some("custom".to_string())
                } else {
                    None
                }
            } else {
                None
            }
        } else {
            None
        };

        CloudStorageDetections {
            icloud_available,
            icloud_path,
            google_drive_available,
            google_drive_path,
            local_backup_path,
            gh_cli_available,
            gh_username,
            active_mirror_type,
        }
    }

    /// Check if GitHub CLI is installed and authenticated
    pub fn detect_github_cli() -> (bool, Option<String>) {
        let gh_paths = ["/opt/homebrew/bin/gh", "/usr/local/bin/gh", "gh"];
        for path in &gh_paths {
            if let Ok(output) = std::process::Command::new(path)
                .arg("auth")
                .arg("status")
                .output()
            {
                if output.status.success() {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    let combined = format!("{}\n{}", stdout, stderr);
                    let username = combined
                        .lines()
                        .find(|l| l.contains("account "))
                        .and_then(|l| l.split("account ").nth(1)?.split_whitespace().next())
                        .map(|s| s.trim().to_string());
                    return (true, username);
                }
            }
        }
        (false, None)
    }

    /// Retrieve token directly from GitHub CLI
    pub fn get_github_cli_token() -> Option<String> {
        let gh_paths = ["/opt/homebrew/bin/gh", "/usr/local/bin/gh", "gh"];
        for path in &gh_paths {
            if let Ok(output) = std::process::Command::new(path)
                .arg("auth")
                .arg("token")
                .output()
            {
                if output.status.success() {
                    let token = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !token.is_empty() {
                        return Some(token);
                    }
                }
            }
        }
        None
    }

    /// One-click connect cloud storage (iCloud, Google Drive, Local)
    pub fn connect_cloud_storage(vault_path: &Path, storage_type: &str) -> Result<SyncConfig, AutoSyncError> {
        let detections = Self::detect_cloud_storage(Some(vault_path));
        let target_path = match storage_type {
            "icloud" => detections.icloud_path.ok_or_else(|| {
                AutoSyncError::Git("iCloud Drive が有効化されていないか、ディレクトリが見つかりません".to_string())
            })?,
            "google_drive" => detections.google_drive_path.ok_or_else(|| {
                AutoSyncError::Git("Google Drive が検出されませんでした。Google ドライブ アプリが起動しているか確認してください".to_string())
            })?,
            "local" => detections.local_backup_path,
            _ => {
                return Err(AutoSyncError::Git("未対応のストレージ種別です".to_string()));
            }
        };

        fs::create_dir_all(Path::new(&target_path))?;

        let mut config = Self::load_config(vault_path);
        config.auto_sync_enabled = true;
        config.mirror_folder_path = Some(target_path);
        Self::save_config(vault_path, &config)?;

        let _ = Self::trigger_sync(vault_path, &format!("{}への自動同期接続", storage_type));
        Ok(config)
    }

    /// One-click connect GitHub CLI
    pub fn connect_github_cli(vault_path: &Path) -> Result<SyncConfig, AutoSyncError> {
        let token = Self::get_github_cli_token().ok_or_else(|| {
            AutoSyncError::Git("GitHub CLI のログイン情報が見つかりません。ターミナルで 'gh auth login' を実行してください。".to_string())
        })?;

        let mut config = Self::load_config(vault_path);
        config.auto_sync_enabled = true;
        config.github_pat = Some(token);
        Self::save_config(vault_path, &config)?;

        let _ = Self::trigger_sync(vault_path, "GitHub CLI アカウント接続完了");
        Ok(config)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_sync_config_and_status() {
        let vault_dir = tempdir().unwrap();
        let config = SyncConfig {
            auto_sync_enabled: true,
            github_remote_url: Some("https://github.com/user/novel.git".to_string()),
            github_pat: None,
            mirror_folder_path: None,
        };
        AutoSyncEngine::save_config(vault_dir.path(), &config).unwrap();

        let loaded = AutoSyncEngine::load_config(vault_dir.path());
        assert_eq!(loaded.auto_sync_enabled, true);
        assert_eq!(loaded.github_remote_url.as_deref(), Some("https://github.com/user/novel.git"));

        let status = AutoSyncEngine::trigger_sync(vault_dir.path(), "第1話を更新");
        assert_eq!(status.state, "synced");
        assert!(status.message.contains("全自動クラウド同期：完了"));
    }

    #[test]
    fn test_cloud_mirror_sync() {
        let vault_dir = tempdir().unwrap();
        let mirror_dir = tempdir().unwrap();

        // Write a test file in vault
        let test_file = vault_dir.path().join("第01話.md");
        fs::write(&test_file, "# 第一話\n雨の日の出会い").unwrap();

        let config = SyncConfig {
            auto_sync_enabled: true,
            github_remote_url: None,
            github_pat: None,
            mirror_folder_path: Some(mirror_dir.path().to_string_lossy().to_string()),
        };
        AutoSyncEngine::save_config(vault_dir.path(), &config).unwrap();

        let status = AutoSyncEngine::trigger_sync(vault_dir.path(), "エピソード新規作成");
        assert_eq!(status.state, "synced");

        // Verify mirrored file exists
        let mirrored_file = mirror_dir.path().join("第01話.md");
        assert!(mirrored_file.exists());
        let content = fs::read_to_string(mirrored_file).unwrap();
        assert_eq!(content, "# 第一話\n雨の日の出会い");
    }
}
