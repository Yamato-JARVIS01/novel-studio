pub mod git_manager;

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum StorageError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Git error: {0}")]
    Git(#[from] git_manager::GitError),
    #[error("Octocrab error: {0}")]
    Octocrab(#[from] octocrab::Error),
    #[error("File not found: {0}")]
    NotFound(String),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum StorageType {
    LocalFolder,
    ICloudDrive,
    GoogleDrive,
    GitHub,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub extension: Option<String>,
    pub children: Option<Vec<FileNode>>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultInfo {
    pub path: String,
    pub name: String,
    pub storage_type: StorageType,
    pub has_git: bool,
}

pub struct StorageManager;

impl StorageManager {
    /// Detect storage type based on path
    pub fn detect_storage_type(path: &Path) -> StorageType {
        let path_str = path.to_string_lossy();
        if path_str.contains("com~apple~CloudDocs") || path_str.contains("Mobile Documents") {
            StorageType::ICloudDrive
        } else if path_str.contains("Google Drive") || path_str.contains("GoogleDrive") {
            StorageType::GoogleDrive
        } else {
            StorageType::LocalFolder
        }
    }

    /// Read files recursively to generate Vault Tree
    pub fn list_vault_files(root: &Path) -> Result<Vec<FileNode>, StorageError> {
        let mut nodes = Vec::new();

        if !root.exists() || !root.is_dir() {
            return Err(StorageError::NotFound(root.to_string_lossy().to_string()));
        }

        for entry in fs::read_dir(root)? {
            let entry = entry?;
            let path = entry.path();
            let file_name = entry.file_name().to_string_lossy().to_string();

            // Skip hidden directories like .git or .obsidian
            if file_name.starts_with('.') {
                continue;
            }

            if path.is_dir() {
                let children = Self::list_vault_files(&path)?;
                nodes.push(FileNode {
                    name: file_name,
                    path: path.to_string_lossy().to_string(),
                    is_dir: true,
                    extension: None,
                    children: Some(children),
                    status: None,
                });
            } else {
                let ext = path.extension().map(|e| e.to_string_lossy().to_string());
                // Only include text and markdown files
                if let Some(ref e) = ext {
                    if e == "md" || e == "txt" || e == "novel" {
                        let status = Self::quick_read_status(&path);
                        nodes.push(FileNode {
                            name: file_name,
                            path: path.to_string_lossy().to_string(),
                            is_dir: false,
                            extension: ext,
                            children: None,
                            status,
                        });
                    }
                }
            }
        }

        // Sort: directories first, then files alphabetically
        nodes.sort_by(|a, b| {
            if a.is_dir == b.is_dir {
                a.name.cmp(&b.name)
            } else if a.is_dir {
                std::cmp::Ordering::Less
            } else {
                std::cmp::Ordering::Greater
            }
        });

        Ok(nodes)
    }

    /// Try to read status from frontmatter without full parse
    fn quick_read_status(path: &Path) -> Option<String> {
        if let Ok(content) = fs::read_to_string(path) {
            let (fm, _) = crate::editor_engine::frontmatter::extract_frontmatter(&content);
            return fm.map(|f| format!("{:?}", f.status).to_lowercase());
        }
        None
    }

    /// Read novel file content
    pub fn read_file(path: &Path) -> Result<String, StorageError> {
        fs::read_to_string(path).map_err(StorageError::Io)
    }

    /// Save novel file content
    pub fn save_file(path: &Path, content: &str) -> Result<(), StorageError> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(path, content).map_err(StorageError::Io)
    }

    /// Create GitHub PR using octocrab
    pub async fn create_github_pr(
        token: &str,
        owner: &str,
        repo: &str,
        title: &str,
        head_branch: &str,
        base_branch: &str,
        body: &str,
    ) -> Result<String, StorageError> {
        let octocrab = octocrab::Octocrab::builder()
            .personal_token(token.to_string())
            .build()?;

        let pr = octocrab
            .pulls(owner, repo)
            .create(title, head_branch, base_branch)
            .body(body)
            .send()
            .await?;

        Ok(pr.html_url.map(|u| u.to_string()).unwrap_or_default())
    }
}
