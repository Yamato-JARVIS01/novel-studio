pub mod auto_sync;
pub mod git_manager;
pub mod manifest;

use manifest::ManifestManager;
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
    #[error("Manifest error: {0}")]
    Manifest(#[from] manifest::ManifestError),
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NovelProjectItem {
    pub path: String,
    pub title: String,
    pub synopsis: String,
    pub target_paper: String, // "400" | "1600" | "short"
    pub total_chars: usize,
    pub episode_count: usize,
    pub last_modified: String,
    pub is_sample: bool,
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

        let manifest = ManifestManager::load_manifest(root);

        // Sort: directories first, then files ordered by manifest or alphabetically
        nodes.sort_by(|a, b| {
            if a.is_dir == b.is_dir {
                if !a.is_dir {
                    let pos_a = manifest.episode_order.iter().position(|name| name == &a.name || a.path.ends_with(name));
                    let pos_b = manifest.episode_order.iter().position(|name| name == &b.name || b.path.ends_with(name));

                    match (pos_a, pos_b) {
                        (Some(idx_a), Some(idx_b)) => idx_a.cmp(&idx_b),
                        (Some(_), None) => std::cmp::Ordering::Less,
                        (None, Some(_)) => std::cmp::Ordering::Greater,
                        (None, None) => a.name.cmp(&b.name),
                    }
                } else {
                    a.name.cmp(&b.name)
                }
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
        fs::write(path, content)?;
        // Auto-sync if parent has a vault
        if let Some(parent) = path.parent() {
            let file_name = path.file_name().unwrap_or_default().to_string_lossy();
            auto_sync::AutoSyncEngine::trigger_sync(parent, &format!("エピソード保存: {}", file_name));
        }
        Ok(())
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

        // Register into manifest order
        let _ = ManifestManager::append_episode(vault_path, &clean_name);

        // Auto-sync
        auto_sync::AutoSyncEngine::trigger_sync(vault_path, &format!("エピソード作成: {}", clean_name));

        Ok(file_path.to_string_lossy().to_string())
    }

    /// Reorder episodes in manifest
    pub fn reorder_episodes(vault_path: &Path, ordered_names: &[String]) -> Result<(), StorageError> {
        ManifestManager::reorder_episodes(vault_path, ordered_names)?;
        auto_sync::AutoSyncEngine::trigger_sync(vault_path, "エピソード順序の並び替え");
        Ok(())
    }

    /// Delete episode and safely move to .novelstudio/trash/
    pub fn delete_episode(vault_path: &Path, file_path: &Path) -> Result<String, StorageError> {
        let trash_path = ManifestManager::delete_episode(vault_path, file_path)?;
        let name = file_path.file_name().unwrap_or_default().to_string_lossy();
        auto_sync::AutoSyncEngine::trigger_sync(vault_path, &format!("エピソード削除: {}", name));
        Ok(trash_path)
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

        // Initialize manifest
        let _ = ManifestManager::reorder_episodes(
            &vault_path,
            &["第01話_雨夜の羅生門.md".to_string(), "第02話_楼上の灯火.md".to_string()],
        );

        // Initialize World Graph
        let graph_engine = crate::world_graph::KuzuGraphEngine::new(&vault_path);
        let _ = graph_engine.get_graph();

        // Initialize git & auto-sync
        let _ = crate::storage::git_manager::GitManager::init_or_open(&vault_path);
        auto_sync::AutoSyncEngine::trigger_sync(&vault_path, "サンプルプロジェクト初期化");

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

    /// Get default library path ~/Documents/NovelStudio/
    pub fn get_default_library_path() -> std::path::PathBuf {
        let home_dir = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
        let docs = Path::new(&home_dir).join("Documents");
        let library_dir = if docs.exists() {
            docs.join("NovelStudio")
        } else {
            Path::new(&home_dir).join("NovelStudio")
        };
        let _ = fs::create_dir_all(&library_dir);
        library_dir
    }

    /// Scan stats for a single novel project
    fn scan_project_stats(project_path: &Path) -> (usize, usize, String) {
        let mut total_chars = 0;
        let mut episode_count = 0;
        let mut latest_modified = std::time::SystemTime::UNIX_EPOCH;

        if let Ok(entries) = fs::read_dir(project_path) {
            for entry in entries.flatten() {
                let path = entry.path();
                let name = entry.file_name().to_string_lossy().to_string();
                if name.starts_with('.') || !path.is_file() {
                    continue;
                }
                if let Some(ext) = path.extension() {
                    let ext_str = ext.to_string_lossy();
                    if ext_str == "md" || ext_str == "txt" || ext_str == "novel" {
                        episode_count += 1;
                        if let Ok(content) = fs::read_to_string(&path) {
                            let (_, body) = crate::editor_engine::frontmatter::extract_frontmatter(&content);
                            total_chars += body.chars().filter(|c| !c.is_whitespace()).count();
                        }
                        if let Ok(meta) = path.metadata() {
                            if let Ok(mod_time) = meta.modified() {
                                if mod_time > latest_modified {
                                    latest_modified = mod_time;
                                }
                            }
                        }
                    }
                }
            }
        }

        let datetime: chrono::DateTime<chrono::Utc> = latest_modified.into();
        let formatted = if latest_modified == std::time::SystemTime::UNIX_EPOCH {
            chrono::Utc::now().format("%Y/%m/%d %H:%M").to_string()
        } else {
            datetime.format("%Y/%m/%d %H:%M").to_string()
        };

        (total_chars, episode_count, formatted)
    }

    /// List all novel projects in library
    pub fn list_novel_projects() -> Result<Vec<NovelProjectItem>, StorageError> {
        let library = Self::get_default_library_path();
        let mut projects = Vec::new();

        if let Ok(entries) = fs::read_dir(&library) {
            for entry in entries.flatten() {
                let path = entry.path();
                let name = entry.file_name().to_string_lossy().to_string();
                if name.starts_with('.') || !path.is_dir() {
                    continue;
                }

                let manifest = ManifestManager::load_manifest(&path);
                let (total_chars, episode_count, last_modified) = Self::scan_project_stats(&path);
                let title = manifest.title.unwrap_or_else(|| name.clone());
                let synopsis = manifest.synopsis.unwrap_or_default();
                let target_paper = manifest.target_paper.unwrap_or_else(|| "400".to_string());
                let is_sample = name.contains("サンプル") || name.contains("Sample") || title.contains("羅生門");

                projects.push(NovelProjectItem {
                    path: path.to_string_lossy().to_string(),
                    title,
                    synopsis,
                    target_paper,
                    total_chars,
                    episode_count,
                    last_modified,
                    is_sample,
                });
            }
        }

        // Also check if ~/Documents/NovelStudio_Sample exists and isn't listed
        let home_dir = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
        let sample_path = Path::new(&home_dir).join("Documents").join("NovelStudio_Sample");
        if sample_path.exists() && sample_path.is_dir() {
            let path_str = sample_path.to_string_lossy().to_string();
            if !projects.iter().any(|p| p.path == path_str) {
                let manifest = ManifestManager::load_manifest(&sample_path);
                let (total_chars, episode_count, last_modified) = Self::scan_project_stats(&sample_path);
                let title = manifest.title.unwrap_or_else(|| "羅生門（芥川龍之介・サンプル短編）".to_string());
                let synopsis = manifest.synopsis.unwrap_or_else(|| "雨やみを待つ下人が、荒廃した羅生門で己の運命に立ち向かう。".to_string());

                projects.push(NovelProjectItem {
                    path: path_str,
                    title,
                    synopsis,
                    target_paper: "400".to_string(),
                    total_chars,
                    episode_count,
                    last_modified,
                    is_sample: true,
                });
            }
        }

        // If projects is still empty, automatically create sample project inside library
        if projects.is_empty() {
            let sample_dir = library.join("羅生門（芥川龍之介・サンプル短編）");
            let _ = Self::create_sample_project_in(&sample_dir);
            let manifest = ManifestManager::load_manifest(&sample_dir);
            let (total_chars, episode_count, last_modified) = Self::scan_project_stats(&sample_dir);
            projects.push(NovelProjectItem {
                path: sample_dir.to_string_lossy().to_string(),
                title: manifest.title.unwrap_or_else(|| "羅生門（芥川龍之介・サンプル短編）".to_string()),
                synopsis: manifest.synopsis.unwrap_or_else(|| "雨やみを待つ下人が、荒廃した羅生門で己の運命に立ち向かう。".to_string()),
                target_paper: "400".to_string(),
                total_chars,
                episode_count,
                last_modified,
                is_sample: true,
            });
        }

        // Sort: newest modified first
        projects.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));
        Ok(projects)
    }

    /// Create sample project in a specific directory
    pub fn create_sample_project_in(vault_path: &Path) -> Result<String, StorageError> {
        fs::create_dir_all(vault_path)?;

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

        // Initialize manifest
        let manifest = manifest::VaultManifest {
            title: Some("羅生門（芥川龍之介・サンプル短編）".to_string()),
            synopsis: Some("雨やみを待つ下人が、荒廃した羅生門で己の運命と思惑に立ち向かう。".to_string()),
            target_paper: Some("400".to_string()),
            created_at: Some(chrono::Utc::now().to_rfc3339()),
            updated_at: Some(chrono::Utc::now().to_rfc3339()),
            episode_order: vec!["第01話_雨夜の羅生門.md".to_string(), "第02話_楼上の灯火.md".to_string()],
        };
        let _ = manifest::ManifestManager::save_manifest(vault_path, &manifest);

        // Initialize World Graph
        let graph_engine = crate::world_graph::KuzuGraphEngine::new(vault_path);
        let _ = graph_engine.get_graph();

        // Initialize git & auto-sync
        let _ = crate::storage::git_manager::GitManager::init_or_open(vault_path);
        auto_sync::AutoSyncEngine::trigger_sync(vault_path, "サンプルプロジェクト初期化");

        Ok(vault_path.to_string_lossy().to_string())
    }

    /// Create new novel project under ~/Documents/NovelStudio/
    pub fn create_novel_project(
        title: &str,
        synopsis: Option<&str>,
        target_paper: Option<&str>,
    ) -> Result<NovelProjectItem, StorageError> {
        let clean_title: String = title
            .chars()
            .map(|c| match c {
                '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' | '\0' => '_',
                _ => c,
            })
            .collect();
        let clean_title = clean_title.trim();
        let base_name = if clean_title.is_empty() { "名無しの作品" } else { clean_title };

        let library = Self::get_default_library_path();
        let mut project_path = library.join(base_name);
        let mut counter = 2;
        while project_path.exists() {
            project_path = library.join(format!("{}_{}", base_name, counter));
            counter += 1;
        }

        fs::create_dir_all(&project_path)?;

        let synopsis_str = synopsis.unwrap_or("").trim();
        let paper_str = target_paper.unwrap_or("400").trim();

        // 1. Initial episode file
        let initial_episode_name = "第01話_プロローグ.md";
        let episode_file = project_path.join(initial_episode_name);
        let episode_content = format!(
            "---\ntitle: \"第1話 プロローグ\"\nstatus: draft\npov: \"主人公\"\ntimeline: \"物語の幕開け\"\nlocation: \"\"\ncharacters: []\nsynopsis: \"{}\"\n---\n\n　静寂を破るように、新たな物語が始まる。\n",
            synopsis_str
        );
        Self::save_file(&episode_file, &episode_content)?;

        // 2. Manifest JSON
        let now_str = chrono::Utc::now().to_rfc3339();
        let manifest = manifest::VaultManifest {
            title: Some(base_name.to_string()),
            synopsis: if synopsis_str.is_empty() { None } else { Some(synopsis_str.to_string()) },
            target_paper: Some(paper_str.to_string()),
            created_at: Some(now_str.clone()),
            updated_at: Some(now_str),
            episode_order: vec![initial_episode_name.to_string()],
        };
        manifest::ManifestManager::save_manifest(&project_path, &manifest)?;

        // 3. Initialize Git repository
        let _ = crate::storage::git_manager::GitManager::init_or_open(&project_path);

        // 4. Initialize World Graph
        let graph_engine = crate::world_graph::KuzuGraphEngine::new(&project_path);
        let _ = graph_engine.get_graph();

        // 5. Trigger initial auto sync
        auto_sync::AutoSyncEngine::trigger_sync(&project_path, &format!("新規小説作成: {}", base_name));

        let (total_chars, episode_count, last_modified) = Self::scan_project_stats(&project_path);

        Ok(NovelProjectItem {
            path: project_path.to_string_lossy().to_string(),
            title: base_name.to_string(),
            synopsis: synopsis_str.to_string(),
            target_paper: paper_str.to_string(),
            total_chars,
            episode_count,
            last_modified,
            is_sample: false,
        })
    }

    /// Safely delete novel project (moves to ~/Documents/NovelStudio/.trash/)
    pub fn delete_novel_project(project_path: &Path) -> Result<String, StorageError> {
        if !project_path.exists() {
            return Err(StorageError::NotFound(project_path.to_string_lossy().to_string()));
        }

        let folder_name = project_path.file_name().unwrap_or_default().to_string_lossy().to_string();
        let trash_dir = Self::get_default_library_path().join(".trash");
        fs::create_dir_all(&trash_dir)?;

        let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
        let trash_target = trash_dir.join(format!("{}_{}", folder_name, timestamp));

        fs::rename(project_path, &trash_target)?;
        Ok(trash_target.to_string_lossy().to_string())
    }

    /// Import existing folder as a novel project
    pub fn import_novel_project(folder_path: &Path) -> Result<NovelProjectItem, StorageError> {
        if !folder_path.exists() || !folder_path.is_dir() {
            return Err(StorageError::NotFound(folder_path.to_string_lossy().to_string()));
        }

        let folder_name = folder_path.file_name().unwrap_or_default().to_string_lossy().to_string();
        let mut manifest = manifest::ManifestManager::load_manifest(folder_path);

        if manifest.title.is_none() {
            manifest.title = Some(folder_name.clone());
            let _ = manifest::ManifestManager::save_manifest(folder_path, &manifest);
        }

        // Initialize git if missing
        let _ = crate::storage::git_manager::GitManager::init_or_open(folder_path);

        let (total_chars, episode_count, last_modified) = Self::scan_project_stats(folder_path);
        let title = manifest.title.unwrap_or(folder_name);
        let synopsis = manifest.synopsis.unwrap_or_default();
        let target_paper = manifest.target_paper.unwrap_or_else(|| "400".to_string());

        Ok(NovelProjectItem {
            path: folder_path.to_string_lossy().to_string(),
            title,
            synopsis,
            target_paper,
            total_chars,
            episode_count,
            last_modified,
            is_sample: false,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_scan_project_stats_and_manifest() {
        let dir = tempdir().unwrap();
        let p = dir.path();

        let ep1 = p.join("第01話.md");
        fs::write(&ep1, "---\ntitle: 第一話\n---\n雨の日の出会い。").unwrap();

        let (total_chars, count, _) = StorageManager::scan_project_stats(p);
        assert_eq!(count, 1);
        assert_eq!(total_chars, 8); // "雨の日の出会い。"
    }

    #[test]
    fn test_delete_novel_project_safe_trash() {
        let dir = tempdir().unwrap();
        let sample_proj = dir.path().join("テスト小説");
        fs::create_dir_all(&sample_proj).unwrap();
        fs::write(sample_proj.join("第01話.md"), "本文").unwrap();

        let trash_res = StorageManager::delete_novel_project(&sample_proj).unwrap();
        assert!(!sample_proj.exists());
        assert!(Path::new(&trash_res).exists());
    }
}
