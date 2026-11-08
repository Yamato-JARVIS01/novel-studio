use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ManifestError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("File not found: {0}")]
    NotFound(String),
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct VaultManifest {
    #[serde(default)]
    pub episode_order: Vec<String>,
}

pub struct ManifestManager;

impl ManifestManager {
    pub fn manifest_path(vault_path: &Path) -> PathBuf {
        vault_path.join(".novelstudio").join("manifest.json")
    }

    pub fn trash_dir(vault_path: &Path) -> PathBuf {
        vault_path.join(".novelstudio").join("trash")
    }

    pub fn load_manifest(vault_path: &Path) -> VaultManifest {
        let path = Self::manifest_path(vault_path);
        if let Ok(content) = fs::read_to_string(&path) {
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            VaultManifest::default()
        }
    }

    pub fn save_manifest(vault_path: &Path, manifest: &VaultManifest) -> Result<(), ManifestError> {
        let path = Self::manifest_path(vault_path);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string_pretty(manifest)?;
        fs::write(path, json)?;
        Ok(())
    }

    /// Record newly created episode at the end of the order if not already present
    pub fn append_episode(vault_path: &Path, file_name: &str) -> Result<(), ManifestError> {
        let mut manifest = Self::load_manifest(vault_path);
        if !manifest.episode_order.iter().any(|item| item == file_name) {
            manifest.episode_order.push(file_name.to_string());
            Self::save_manifest(vault_path, &manifest)?;
        }
        Ok(())
    }

    /// Update order of episodes explicitly from GUI D&D
    pub fn reorder_episodes(vault_path: &Path, ordered_names: &[String]) -> Result<(), ManifestError> {
        let mut manifest = Self::load_manifest(vault_path);
        manifest.episode_order = ordered_names.to_vec();
        Self::save_manifest(vault_path, &manifest)?;
        Ok(())
    }

    /// Safely move episode file to .novelstudio/trash/ with timestamp
    pub fn delete_episode(vault_path: &Path, file_path: &Path) -> Result<String, ManifestError> {
        if !file_path.exists() {
            return Err(ManifestError::NotFound(file_path.to_string_lossy().to_string()));
        }

        let file_name = file_path.file_name().unwrap_or_default().to_string_lossy().to_string();
        let trash_dir = Self::trash_dir(vault_path);
        fs::create_dir_all(&trash_dir)?;

        let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
        let trash_filename = format!("{}_{}", timestamp, file_name);
        let trash_target = trash_dir.join(&trash_filename);

        fs::rename(file_path, &trash_target)?;

        // Remove from manifest order
        let mut manifest = Self::load_manifest(vault_path);
        manifest.episode_order.retain(|item| item != &file_name && !file_path.ends_with(item));
        Self::save_manifest(vault_path, &manifest)?;

        Ok(trash_target.to_string_lossy().to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_manifest_reorder_and_delete() {
        let vault_dir = tempdir().unwrap();
        let p = vault_dir.path();

        let file1 = p.join("第01話.md");
        let file2 = p.join("第02話.md");
        fs::write(&file1, "第1話本文").unwrap();
        fs::write(&file2, "第2話本文").unwrap();

        ManifestManager::append_episode(p, "第01話.md").unwrap();
        ManifestManager::append_episode(p, "第02話.md").unwrap();

        let m1 = ManifestManager::load_manifest(p);
        assert_eq!(m1.episode_order, vec!["第01話.md", "第02話.md"]);

        // Reorder
        ManifestManager::reorder_episodes(p, &["第02話.md".to_string(), "第01話.md".to_string()]).unwrap();
        let m2 = ManifestManager::load_manifest(p);
        assert_eq!(m2.episode_order, vec!["第02話.md", "第01話.md"]);

        // Delete episode safely
        let trash_path = ManifestManager::delete_episode(p, &file1).unwrap();
        assert!(!file1.exists());
        assert!(Path::new(&trash_path).exists());

        let m3 = ManifestManager::load_manifest(p);
        assert_eq!(m3.episode_order, vec!["第02話.md"]);
    }
}
