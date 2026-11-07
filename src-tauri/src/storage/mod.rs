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

    /// Create a new episode file with template frontmatter
    pub fn create_new_episode(vault_path: &Path, file_name: &str) -> Result<String, StorageError> {
        let clean_name = if file_name.ends_with(".md") {
            file_name.to_string()
        } else {
            format!("{}.md", file_name)
        };
        let file_path = vault_path.join(&clean_name);
        if !file_path.exists() {
            let title = clean_name.trim_end_matches(".md");
            let initial_content = format!(
                "---\ntitle: \"{}\"\nstatus: draft\npov: \"主人公\"\ntimeline: \"第一章\"\nlocation: \"\"\ncharacters: []\nsynopsis: \"\"\n---\n\n　ここに本文を書き始めます。\n",
                title
            );
            Self::save_file(&file_path, &initial_content)?;
        }
        Ok(file_path.to_string_lossy().to_string())
    }

    /// Create sample project with rich literary sample episodes
    pub fn create_sample_project() -> Result<String, StorageError> {
        let home_dir = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
        let sample_dir = Path::new(&home_dir).join("Documents").join("NovelStudio_Sample");
        let vault_path = if sample_dir.parent().map(|p| p.exists()).unwrap_or(false) {
            sample_dir
        } else {
            std::env::temp_dir().join("NovelStudio_Sample")
        };

        fs::create_dir_all(&vault_path)?;

        let episode_1 = vault_path.join("第01話_雨夜の羅生門.md");
        if !episode_1.exists() {
            let content_1 = r#"---
title: "第1話 雨夜の羅生門"
status: draft
pov: "下人"
timeline: "ある日の暮れ方"
location: "羅生門の下"
characters:
  - "下人"
synopsis: "雨やみを待つ下人が、荒廃した羅生門で己の運命と思惑に立ち向かう。"
---

　ある日の暮れ方のことである。一人の下人が、羅生門の下で雨やみを待っていた。
　広い門の下には、この男のほかに誰もいない。ただ、所々丹塗の剥げた、大きな円柱に、蟋蟀が一匹とまっている。羅生門が、朱雀大路にある以上は、この男のほかにも、雨やみをする市女笠や揉烏帽子が、もう二三人はありそうなものである。それが、この男のほかには誰もいない。
　なぜかと云うと、この二三年、京都には、地震とか辻風とか火事とか飢饉とか云う災いがつづいて起った。そこで洛中のさびれ方は一通りではない。旧記によると、仏像や仏具を打ち砕いて、その丹がついたり、金銀の箔がついたりした木を、路ばたにつみ重ねて、薪の料に売っていたと云うことである。

　下人は、七段ある石段の一番上の段に、洗いざらした紺の襖の尻を据えて、右の頬に出来た、大きな面疔を気にしながら、ぼんやり、雨の降るのを眺めていた。
　雨は、羅生門をつつんで、遠くから、ざあっと云う音をあつめて来る。夕闇は次第に空を低くして、見上げると、門の屋根が、斜につき出た甍の先に、重々しく黒い雲を支えている。
　どうにもならない事を、どうにかするためには、手段を選んでいる遑はない。選んでいるとすれば、築土の下か、道ばたの土の上で、飢え死をするばかりである。

「……生きていくためには、盗人になるよりほかに途はない」
　下人の心は、寒々とした風の吹き抜ける宵闇の中で、激しく揺れ動いていた――。
"#;
            Self::save_file(&episode_1, content_1)?;
        }

        let episode_2 = vault_path.join("第02話_楼上の灯火.md");
        if !episode_2.exists() {
            let content_2 = r#"---
title: "第2話 楼上の灯火"
status: ready
pov: "下人"
timeline: "夜半"
location: "羅生門の楼上"
characters:
  - "下人"
  - "老婆"
synopsis: "死骸の満ちる楼上に微かな光を見出した下人は、静かに梯子を登っていく。"
---

　下人は、猫のように足を忍ばせて、急な梯子を、一段一段昇って行った。
　梯子の半ばまで登ったとき、頭の上にある広い楼の上から、かすかな光が漏れてくるのが見えた。誰かが火を点して、何かを探しているに相違ない。下人は、息を殺して、まるで蛇のように身をかがめながら、上の様子を覗き込んだ。

　楼の上には、噂通り、打ち捨てられた死骸がいくつも無造作に転がっている。
　その腐乱した臭気の漂う薄闇の中に、ひとりの白髪の老婆がしゃがみこんでいた。手には松明の燃えさしを持ち、じっと死骸の顔を見つめている。
　そして老婆は、若い女の死骸の長い黒髪を、一本一本、抜き取りはじめたのだった――。
"#;
            Self::save_file(&episode_2, content_2)?;
        }

        // Initialize git
        let _ = crate::storage::git_manager::GitManager::init_or_open(&vault_path);

        Ok(vault_path.to_string_lossy().to_string())
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
