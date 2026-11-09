use chrono::Utc;
use petgraph::graph::NodeIndex;
use petgraph::visit::EdgeRef;
use petgraph::Graph;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;
use uuid::Uuid;

#[derive(Error, Debug)]
pub enum WorldGraphError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON serialization error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Node not found: {0}")]
    NodeNotFound(String),
    #[error("Edge not found: {0}")]
    EdgeNotFound(String),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct WorldNode {
    pub id: String,
    pub node_type: String, // "character" | "term" | "plot" | "location"
    pub name: String,
    #[serde(default)]
    pub aliases: Vec<String>,
    #[serde(default)]
    pub summary: String,
    #[serde(default)]
    pub attributes: HashMap<String, String>,
    #[serde(default)]
    pub full_text: String,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
    // Phase 11 extensions
    #[serde(default)]
    pub image_data: Option<String>,
    #[serde(default)]
    pub long_note: String,
    #[serde(default)]
    pub phase_id: Option<String>,
    #[serde(default)]
    pub pos_x: Option<f64>,
    #[serde(default)]
    pub pos_y: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct WorldEdge {
    pub id: String,
    pub source_id: String,
    pub target_id: String,
    pub relation_type: String, // "師弟", "敵対", "秘密を握る", "伏線回収", "登場" etc.
    #[serde(default)]
    pub description: String,
    // Phase 11 extensions
    #[serde(default)]
    pub phase_id: Option<String>,
    #[serde(default)]
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GraphData {
    pub nodes: Vec<WorldNode>,
    pub edges: Vec<WorldEdge>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SceneGraphAnalysis {
    pub active_nodes: Vec<WorldNode>,
    pub active_edges: Vec<WorldEdge>,
    pub consistency_hints: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncManuscriptResult {
    pub added_nodes_count: usize,
    pub added_edges_count: usize,
    pub added_nodes: Vec<WorldNode>,
    pub added_edges: Vec<WorldEdge>,
    pub message: String,
    pub graph: GraphData,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CardTemplateField {
    pub key: String,
    pub label: String,
    #[serde(default)]
    pub placeholder: String,
    #[serde(default)]
    pub default_value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CardTemplate {
    pub id: String,
    pub name: String,
    pub node_type: String, // "character" | "term" | "location" | "plot"
    pub description: String,
    pub fields: Vec<CardTemplateField>,
    #[serde(default)]
    pub is_builtin: bool,
}

pub struct KuzuGraphEngine {
    pub vault_path: PathBuf,
    graph_file_path: PathBuf,
}

impl KuzuGraphEngine {
    pub fn new(vault_path: &Path) -> Self {
        let dot_dir = vault_path.join(".novelstudio");
        let graph_file_path = dot_dir.join("world_graph.json");
        Self {
            vault_path: vault_path.to_path_buf(),
            graph_file_path,
        }
    }

    pub fn notes_dir(&self) -> PathBuf {
        self.vault_path.join(".novelstudio").join("notes")
    }

    pub fn templates_file_path(&self) -> PathBuf {
        self.vault_path.join(".novelstudio").join("card_templates.json")
    }

    /// Check if this project is strictly designated as a sample project
    pub fn is_sample_vault(&self) -> bool {
        let folder_name = self.vault_path
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();
        folder_name == "NovelStudio_Sample"
            || folder_name.contains("NovelStudio_Sample")
            || folder_name.contains("サンプル")
            || folder_name.contains("Sample")
            || folder_name.contains("羅生門")
    }

    pub fn sample_characters_note() -> &'static str {
        r#"# 登場人物ノート

## 下人
- 種別: character
- 別名: 男, 若者
- 一人称: おれ
- 二人称: おのれ、お前
- 口調: 荒削りで焦燥感がある
- 状況: 数日前に主人から暇を出された
- 関係: 老婆 (対峙・追剥ぎ)

行き場を失い飢え死にか盗人になるかの選択に苦悩する元使用人。羅生門で雨宿りをしていたが、死人の髪を抜く老婆と出会い、生きるための悪に目覚める。

## 老婆
- 種別: character
- 別名: 白髪の老婆, 女
- 一人称: わし
- 二人称: お前さん
- 口調: 嗄れ声で弁明がましい
- 動機: 死人の髪を抜いて鬘にして生き延びる
- 関係: 下人 (対峙・追剥ぎ)

羅生門の楼上で死骸の髪を抜き、生きるための悪行を正当化する老婆。
"#
    }

    pub fn sample_locations_note() -> &'static str {
        r#"# 世界観・舞台設定ノート

## 羅生門
- 種別: location
- 別名: 門, 楼上
- 状態: 荒廃、死体捨て場と化している
- 天気: 降りしきる夕方の雨

平安京の正門。荒廃し、狐狸や盗人が住みつき死骸が打ち捨てられている場所。
"#
    }

    pub fn sample_plot_note() -> &'static str {
        r#"# 全体筋書き・プロット構成

## 悪への転向
- 種別: plot
- テーマ: 生存のための悪の肯定
- 結末: 下人が老婆の着物を剥ぎ取り闇へと消える
- 関連: [[下人]] (契機), [[老婆]] (契機)

老婆の弁明（生きるための悪）を聞き、下人が善悪の迷いを捨てて追剥ぎになる転換点。
"#
    }

    /// Ensure directory and file exists.
    /// Strictly only generate Rashomon sample data if vault is designated as sample project.
    /// Normal projects will receive clean empty graph and clean note templates.
    pub fn ensure_initialized(&self) -> Result<(), WorldGraphError> {
        let parent = self.graph_file_path.parent().unwrap();
        if !parent.exists() {
            fs::create_dir_all(parent)?;
        }

        let notes_dir = self.notes_dir();
        if !notes_dir.exists() {
            fs::create_dir_all(&notes_dir)?;
        }

        let is_sample = self.is_sample_vault();

        // Initialize notes if empty
        let char_note = notes_dir.join("characters.md");
        if !char_note.exists() {
            let content = if is_sample {
                Self::sample_characters_note()
            } else {
                "# 登場人物ノート\n\n"
            };
            let _ = fs::write(char_note, content);
        }

        let loc_note = notes_dir.join("locations.md");
        if !loc_note.exists() {
            let content = if is_sample {
                Self::sample_locations_note()
            } else {
                "# 世界観・舞台設定ノート\n\n"
            };
            let _ = fs::write(loc_note, content);
        }

        let plot_note = notes_dir.join("plot.md");
        if !plot_note.exists() {
            let content = if is_sample {
                Self::sample_plot_note()
            } else {
                "# 全体筋書き・プロット構成\n\n"
            };
            let _ = fs::write(plot_note, content);
        }

        if !self.graph_file_path.exists() {
            let data = if is_sample {
                Self::build_sample_graph()
            } else {
                GraphData {
                    nodes: Vec::new(),
                    edges: Vec::new(),
                }
            };
            self.save_graph_atomic(&data)?;
        }
        Ok(())
    }

    /// Explicitly initialize sample graph and notes (for Sample Project creation)
    pub fn init_sample_graph(&self) -> Result<GraphData, WorldGraphError> {
        let parent = self.graph_file_path.parent().unwrap();
        if !parent.exists() {
            fs::create_dir_all(parent)?;
        }

        let notes_dir = self.notes_dir();
        if !notes_dir.exists() {
            fs::create_dir_all(&notes_dir)?;
        }

        fs::write(notes_dir.join("characters.md"), Self::sample_characters_note())?;
        fs::write(notes_dir.join("locations.md"), Self::sample_locations_note())?;
        fs::write(notes_dir.join("plot.md"), Self::sample_plot_note())?;

        let sample_data = Self::build_sample_graph();
        self.save_graph_atomic(&sample_data)?;
        Ok(sample_data)
    }

    /// Clear world graph and reset notes to clean empty state
    pub fn clear_graph(&self) -> Result<GraphData, WorldGraphError> {
        let empty_data = GraphData {
            nodes: Vec::new(),
            edges: Vec::new(),
        };
        self.save_graph_atomic(&empty_data)?;

        let notes_dir = self.notes_dir();
        if !notes_dir.exists() {
            fs::create_dir_all(&notes_dir)?;
        }
        fs::write(notes_dir.join("characters.md"), "# 登場人物ノート\n\n")?;
        fs::write(notes_dir.join("locations.md"), "# 世界観・舞台設定ノート\n\n")?;
        fs::write(notes_dir.join("plot.md"), "# 全体筋書き・プロット構成\n\n")?;

        Ok(empty_data)
    }

    /// Built-in card templates for rich worldbuilding
    pub fn builtin_card_templates() -> Vec<CardTemplate> {
        vec![
            CardTemplate {
                id: "tmpl-skill-magic".to_string(),
                name: "⚔️ 異能・魔法スキル設定".to_string(),
                node_type: "term".to_string(),
                description: "能力・魔法の系統や発動条件、代償、物語上の切り札を整理".to_string(),
                is_builtin: true,
                fields: vec![
                    CardTemplateField { key: "系統・属性".to_string(), label: "系統・属性".to_string(), placeholder: "例: 火炎系、精神干渉、空間転移".to_string(), default_value: "".to_string() },
                    CardTemplateField { key: "発動条件・コスト".to_string(), label: "発動条件・コスト".to_string(), placeholder: "例: 魔力消費、特定の詠唱、血液の対価".to_string(), default_value: "".to_string() },
                    CardTemplateField { key: "射程・持続時間".to_string(), label: "射程・持続時間".to_string(), placeholder: "例: 視界内・3分間、接触即時".to_string(), default_value: "".to_string() },
                    CardTemplateField { key: "反動・代償・弱点".to_string(), label: "反動・代償・弱点".to_string(), placeholder: "例: 使用後の激痛、特定鉱物に無力".to_string(), default_value: "".to_string() },
                    CardTemplateField { key: "物語上の切り札".to_string(), label: "物語上の切り札".to_string(), placeholder: "例: クライマックスで禁忌を解く奥義".to_string(), default_value: "".to_string() },
                ],
            },
            CardTemplate {
                id: "tmpl-mystery-alibi".to_string(),
                name: "🕵️ ミステリー事件・アリバイ表".to_string(),
                node_type: "plot".to_string(),
                description: "事件の発生時刻、凶器、容疑者のアリバイ、偽装工作を整理".to_string(),
                is_builtin: true,
                fields: vec![
                    CardTemplateField { key: "発生日時・場所".to_string(), label: "発生日時・場所".to_string(), placeholder: "例: 10月14日 22:30 別荘2階図書室".to_string(), default_value: "".to_string() },
                    CardTemplateField { key: "被害者・凶器".to_string(), label: "被害者・凶器".to_string(), placeholder: "例: 資産家当主・銀のペーパーナイフ".to_string(), default_value: "".to_string() },
                    CardTemplateField { key: "容疑者・アリバイ主張".to_string(), label: "容疑者・アリバイ主張".to_string(), placeholder: "例: 秘書（1階ロビーで電話応対中と証言）".to_string(), default_value: "".to_string() },
                    CardTemplateField { key: "偽装工作・盲点".to_string(), label: "偽装工作・盲点".to_string(), placeholder: "例: タイマー付きオーディオによる犯行時刻偽装".to_string(), default_value: "".to_string() },
                    CardTemplateField { key: "暴かれる動機".to_string(), label: "暴かれる動機".to_string(), placeholder: "例: 遺産相続ではなく過去の復讐".to_string(), default_value: "".to_string() },
                ],
            },
            CardTemplate {
                id: "tmpl-faction-nation".to_string(),
                name: "👑 組織・派閥・国家設定".to_string(),
                node_type: "term".to_string(),
                description: "政治体制、理念、軍事力、対立・同盟関係、内部抗争を整理".to_string(),
                is_builtin: true,
                fields: vec![
                    CardTemplateField { key: "統治形態・元首".to_string(), label: "統治形態・元首".to_string(), placeholder: "例: 立憲君主制・若き摂政王".to_string(), default_value: "".to_string() },
                    CardTemplateField { key: "理念・国是".to_string(), label: "理念・国是".to_string(), placeholder: "例: 信仰による救済、魔導技術至上主義".to_string(), default_value: "".to_string() },
                    CardTemplateField { key: "主力戦力・軍事力".to_string(), label: "主力戦力・軍事力".to_string(), placeholder: "例: 鉄騎兵団、ドラゴン部隊、情報暗殺網".to_string(), default_value: "".to_string() },
                    CardTemplateField { key: "敵対勢力・同盟関係".to_string(), label: "敵対勢力・同盟関係".to_string(), placeholder: "例: 北方帝国と冷戦状態、商業同盟と不可侵条約".to_string(), default_value: "".to_string() },
                    CardTemplateField { key: "内部対立・腐敗".to_string(), label: "内部対立・腐敗".to_string(), placeholder: "例: 貴族院と元老院の主導権争い".to_string(), default_value: "".to_string() },
                ],
            },
        ]
    }

    pub fn load_card_templates(&self) -> Vec<CardTemplate> {
        let path = self.templates_file_path();
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(templates) = serde_json::from_str::<Vec<CardTemplate>>(&content) {
                if !templates.is_empty() {
                    return templates;
                }
            }
        }
        Self::builtin_card_templates()
    }

    pub fn save_card_templates(&self, templates: &[CardTemplate]) -> Result<(), WorldGraphError> {
        let path = self.templates_file_path();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string_pretty(templates)?;
        use std::io::Write;
        let mut file = std::fs::OpenOptions::new()
            .write(true)
            .truncate(true)
            .create(true)
            .open(&path)?;
        file.write_all(json.as_bytes())?;
        file.flush()?;
        Ok(())
    }

    /// Built-in sample world graph for Rashomon
    pub fn build_sample_graph() -> GraphData {
        let now = Utc::now().to_rfc3339();

        let mut genin_attrs = HashMap::new();
        genin_attrs.insert("一人称".to_string(), "おれ".to_string());
        genin_attrs.insert("二人称".to_string(), "おのれ、お前".to_string());
        genin_attrs.insert("口調".to_string(), "荒削りで焦燥感がある".to_string());
        genin_attrs.insert("状況".to_string(), "数日前に主人から暇を出された".to_string());

        let genin = WorldNode {
            id: "node-genin-01".to_string(),
            node_type: "character".to_string(),
            name: "下人".to_string(),
            aliases: vec!["男".to_string(), "若者".to_string()],
            summary: "行き場を失い飢え死にか盗人になるかの選択に苦悩する元使用人。".to_string(),
            attributes: genin_attrs,
            full_text: "## 下人\n- 一人称: おれ\n- 二人称: おのれ、お前\n- 口調: 荒削りで焦燥感がある\n- 状況: 数日前に主人から暇を出された\n- 関係: 老婆 (対峙・追剥ぎ)\n\n行き場を失い飢え死にか盗人になるかの選択に苦悩する元使用人。羅生門で雨宿りをしていたが、死人の髪を抜く老婆と出会い、生きるための悪に目覚める。".to_string(),
            created_at: now.clone(),
            updated_at: now.clone(),
            long_note: "行き場を失い飢え死にか盗人になるかの選択に苦悩する元使用人。\n羅生門で雨宿りをしていたが、死人の髪を抜く老婆と出逢い、生きるための悪に目覚める。".to_string(),
            pos_x: Some(250.0),
            pos_y: Some(180.0),
            ..Default::default()
        };

        let mut rousen_attrs = HashMap::new();
        rousen_attrs.insert("一人称".to_string(), "わし".to_string());
        rousen_attrs.insert("二人称".to_string(), "お前さん".to_string());
        rousen_attrs.insert("口調".to_string(), "嗄れ声で弁明がましい".to_string());
        rousen_attrs.insert("動機".to_string(), "死人の髪を抜いて鬘にして生き延びる".to_string());

        let roba = WorldNode {
            id: "node-roba-02".to_string(),
            node_type: "character".to_string(),
            name: "老婆".to_string(),
            aliases: vec!["白髪の老婆".to_string(), "女".to_string()],
            summary: "羅生門の楼上で死骸の髪を抜き、生きるための悪行を正当化する老婆。".to_string(),
            attributes: rousen_attrs,
            full_text: "## 老婆\n- 一人称: わし\n- 二人称: お前さん\n- 口調: 嗄れ声で弁明がましい\n- 動機: 死人の髪を抜いて鬘にして生き延びる\n\n羅生門の楼上で死骸の髪を抜き、生きるための悪行を正当化する老婆。".to_string(),
            created_at: now.clone(),
            updated_at: now.clone(),
            long_note: "羅生門の楼上で死骸の髪を抜き、鬘にして生き延びる老婆。\n生きるための悪行を滔々と弁明し、下人の葛藤を一変させる。".to_string(),
            pos_x: Some(550.0),
            pos_y: Some(180.0),
            ..Default::default()
        };

        let mut gate_attrs = HashMap::new();
        gate_attrs.insert("状態".to_string(), "荒廃、死体捨て場と化している".to_string());
        gate_attrs.insert("天気".to_string(), "降りしきる夕方の雨".to_string());

        let gate = WorldNode {
            id: "node-gate-03".to_string(),
            node_type: "location".to_string(),
            name: "羅生門".to_string(),
            aliases: vec!["門".to_string(), "楼上".to_string()],
            summary: "平安京の正門。荒廃し、狐狸や盗人が住みつき死骸が打ち捨てられている場所。".to_string(),
            attributes: gate_attrs,
            full_text: "## 羅生門\n- 状態: 荒廃、死体捨て場と化している\n- 天気: 降りしきる夕方の雨\n\n平安京の正門。荒廃し、狐狸や盗人が住みつき死骸が打ち捨てられている場所。".to_string(),
            created_at: now.clone(),
            updated_at: now.clone(),
            long_note: "平安京の正門。荒廃し、狐狸や盗人が住みつき死骸が打ち捨てられている場所。\n夕方の驟雨が降りしきる。".to_string(),
            pos_x: Some(400.0),
            pos_y: Some(380.0),
            ..Default::default()
        };

        let mut plot_attrs = HashMap::new();
        plot_attrs.insert("テーマ".to_string(), "生存のための悪の肯定".to_string());
        plot_attrs.insert("結末".to_string(), "下人が老婆の着物を剥ぎ取り闇へと消える".to_string());

        let plot = WorldNode {
            id: "node-plot-04".to_string(),
            node_type: "plot".to_string(),
            name: "悪への転向".to_string(),
            aliases: vec!["追剥ぎの決断".to_string()],
            summary: "老婆の弁明（生きるための悪）を聞き、下人が善悪の迷いを捨てて追剥ぎになる転換点。".to_string(),
            attributes: plot_attrs,
            full_text: "## 悪への転向\n- テーマ: 生存のための悪の肯定\n- 結末: 下人が老婆の着物を剥ぎ取り闇へと消える\n\n老婆の弁明（生きるための悪）を聞き、下人が善悪の迷いを捨てて追剥ぎになる転換点。".to_string(),
            created_at: now.clone(),
            updated_at: now.clone(),
            long_note: "老婆の弁明を聞いた下人が、自らの生存のために老婆の着物を強奪して夜の闇へ消えるクライマックス。".to_string(),
            pos_x: Some(400.0),
            pos_y: Some(100.0),
            ..Default::default()
        };

        let edge1 = WorldEdge {
            id: "edge-01".to_string(),
            source_id: genin.id.clone(),
            target_id: roba.id.clone(),
            relation_type: "対峙・追剥ぎ".to_string(),
            description: "楼上で出遭い、老婆の論理を利用して着物を奪う関係。".to_string(),
            ..Default::default()
        };

        let edge2 = WorldEdge {
            id: "edge-02".to_string(),
            source_id: genin.id.clone(),
            target_id: gate.id.clone(),
            relation_type: "滞在".to_string(),
            description: "雨宿りをしていたが、楼上の光に誘われて登る。".to_string(),
            ..Default::default()
        };

        let edge3 = WorldEdge {
            id: "edge-03".to_string(),
            source_id: roba.id.clone(),
            target_id: plot.id.clone(),
            relation_type: "契機".to_string(),
            description: "老婆の言葉が下人のモラル崩壊を引き起こす。".to_string(),
            color: Some("#f43f5e".to_string()),
            ..Default::default()
        };

        GraphData {
            nodes: vec![genin, roba, gate, plot],
            edges: vec![edge1, edge2, edge3],
        }
    }

    /// Read graph data
    pub fn get_graph(&self) -> Result<GraphData, WorldGraphError> {
        self.ensure_initialized()?;
        let content = fs::read_to_string(&self.graph_file_path)?;
        let data: GraphData = serde_json::from_str(&content)?;
        Ok(data)
    }

    /// List all note files in .novelstudio/notes/
    pub fn list_notes(&self) -> Result<Vec<String>, WorldGraphError> {
        self.ensure_initialized()?;
        let notes_dir = self.notes_dir();
        let mut results = Vec::new();
        if notes_dir.exists() {
            for entry in fs::read_dir(notes_dir)? {
                let entry = entry?;
                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) == Some("md") {
                    if let Some(file_name) = path.file_name().and_then(|s| s.to_str()) {
                        results.push(file_name.to_string());
                    }
                }
            }
        }
        results.sort();
        Ok(results)
    }

    /// Read single note file
    pub fn read_note(&self, note_name: &str) -> Result<String, WorldGraphError> {
        self.ensure_initialized()?;
        let path = self.notes_dir().join(note_name);
        if !path.exists() {
            return Ok(String::new());
        }
        let content = fs::read_to_string(path)?;
        Ok(content)
    }

    /// Save note file and immediately trigger autonomous graph sync
    pub fn save_note(&self, note_name: &str, content: &str) -> Result<GraphData, WorldGraphError> {
        self.ensure_initialized()?;
        let path = self.notes_dir().join(note_name);
        fs::write(path, content)?;
        self.sync_notes_to_graph()
    }

    /// Get overall plot markdown
    pub fn get_overall_plot(&self) -> Result<String, WorldGraphError> {
        self.ensure_initialized()?;
        let path = self.notes_dir().join("plot.md");
        if path.exists() {
            fs::read_to_string(path).map_err(WorldGraphError::Io)
        } else {
            Ok(String::new())
        }
    }

    /// Save overall plot markdown and trigger graph sync
    pub fn save_overall_plot(&self, plot: &str) -> Result<GraphData, WorldGraphError> {
        self.ensure_initialized()?;
        let path = self.notes_dir().join("plot.md");
        fs::write(path, plot)?;
        self.sync_notes_to_graph()
    }

    /// Parse long-form notes and autonomously synchronize World Graph nodes & edges
    pub fn sync_notes_to_graph(&self) -> Result<GraphData, WorldGraphError> {
        self.ensure_initialized()?;
        let mut current_graph = self.get_graph().unwrap_or_default();
        let notes = self.list_notes()?;

        struct ParsedRelation {
            source_name: String,
            target_name: String,
            relation_type: String,
            description: String,
        }

        let mut extracted_nodes = Vec::new();
        let mut extracted_relations = Vec::new();

        for note_file in &notes {
            let note_path = self.notes_dir().join(note_file);
            let content = match fs::read_to_string(&note_path) {
                Ok(c) => c,
                Err(_) => continue,
            };

            let default_type = if note_file.contains("character") || note_file.contains("人物") {
                "character"
            } else if note_file.contains("location") || note_file.contains("舞台") || note_file.contains("場所") {
                "location"
            } else if note_file.contains("plot") || note_file.contains("筋書き") || note_file.contains("構成") {
                "plot"
            } else {
                "term"
            };

            let lines: Vec<&str> = content.lines().collect();
            let mut current_section_name: Option<String> = None;
            let mut current_section_type = default_type.to_string();
            let mut current_section_lines: Vec<&str> = Vec::new();

            let flush_section = |
                sec_name: Option<String>,
                sec_type: &str,
                sec_lines: &[&str],
                extracted_nodes: &mut Vec<WorldNode>,
                extracted_relations: &mut Vec<ParsedRelation>,
            | {
                if let Some(raw_name) = sec_name {
                    let name = raw_name.trim();
                    if name.is_empty() || name == "登場人物ノート" || name == "世界観・舞台設定ノート" || name == "全体筋書き・プロット構成" {
                        return;
                    }

                    let mut node_type = sec_type.to_string();
                    let mut aliases = Vec::new();
                    let mut attributes = HashMap::new();
                    let mut summary_lines = Vec::new();

                    for line in sec_lines {
                        let trimmed = line.trim();
                        if trimmed.starts_with('-') || trimmed.starts_with('*') {
                            let item = trimmed.trim_start_matches(|c| c == '-' || c == '*' || c == ' ');
                            if let Some((k, v)) = item.split_once(':').or_else(|| item.split_once('：')) {
                                let key = k.trim();
                                let val = v.trim();
                                match key {
                                    "種別" | "タイプ" | "type" => {
                                        node_type = val.to_string();
                                    }
                                    "別名" | "エイリアス" | "aliases" => {
                                        for a in val.split(|c| c == ',' || c == '、') {
                                            let at = a.trim();
                                            if !at.is_empty() {
                                                aliases.push(at.to_string());
                                            }
                                        }
                                    }
                                    "関係" | "相関" | "関連" | "relation" => {
                                        let clean_val = val.replace("[[", "").replace("]]", "");
                                        if let Some((target, rel)) = clean_val.split_once('(').or_else(|| clean_val.split_once('（')) {
                                            let rel_clean = rel.trim_end_matches(|c| c == ')' || c == '）').trim();
                                            extracted_relations.push(ParsedRelation {
                                                source_name: name.to_string(),
                                                target_name: target.trim().to_string(),
                                                relation_type: if rel_clean.is_empty() { "関連".to_string() } else { rel_clean.to_string() },
                                                description: format!("ノート「{}」より抽出", note_file),
                                            });
                                        } else {
                                            extracted_relations.push(ParsedRelation {
                                                source_name: name.to_string(),
                                                target_name: clean_val.trim().to_string(),
                                                relation_type: "関連".to_string(),
                                                description: format!("ノート「{}」より抽出", note_file),
                                            });
                                        }
                                    }
                                    _ => {
                                        attributes.insert(key.to_string(), val.to_string());
                                    }
                                }
                            }
                        } else if !trimmed.is_empty() {
                            summary_lines.push(trimmed);
                            let mut start_idx = 0;
                            while let Some(open) = trimmed[start_idx..].find("[[") {
                                let abs_open = start_idx + open + 2;
                                if let Some(close) = trimmed[abs_open..].find("]]") {
                                    let linked_name = &trimmed[abs_open..abs_open + close];
                                    if !linked_name.is_empty() && linked_name != name {
                                        extracted_relations.push(ParsedRelation {
                                            source_name: name.to_string(),
                                            target_name: linked_name.trim().to_string(),
                                            relation_type: "言及".to_string(),
                                            description: "本文中リンク".to_string(),
                                        });
                                    }
                                    start_idx = abs_open + close + 2;
                                } else {
                                    break;
                                }
                            }
                        }
                    }

                    let summary = summary_lines.first().cloned().unwrap_or("").to_string();
                    let full_text = sec_lines.join("\n");

                    extracted_nodes.push(WorldNode {
                        id: String::new(),
                        node_type,
                        name: name.to_string(),
                        aliases,
                        summary,
                        attributes,
                        full_text,
                        created_at: String::new(),
                        updated_at: String::new(),
                        ..Default::default()
                    });
                }
            };

            for line in lines {
                let trimmed = line.trim();
                if trimmed.starts_with("## ") {
                    flush_section(
                        current_section_name.take(),
                        &current_section_type,
                        &current_section_lines,
                        &mut extracted_nodes,
                        &mut extracted_relations,
                    );
                    current_section_lines.clear();
                    let raw_heading = trimmed[3..].trim();
                    if raw_heading.starts_with('[') {
                        if let Some(close_bracket) = raw_heading.find(']') {
                            let tag = &raw_heading[1..close_bracket];
                            current_section_type = match tag {
                                "人物" | "character" => "character".to_string(),
                                "舞台" | "場所" | "location" => "location".to_string(),
                                "プロット" | "筋書き" | "plot" => "plot".to_string(),
                                _ => "term".to_string(),
                            };
                            current_section_name = Some(raw_heading[close_bracket + 1..].trim().to_string());
                        } else {
                            current_section_name = Some(raw_heading.to_string());
                        }
                    } else {
                        current_section_name = Some(raw_heading.to_string());
                    }
                } else if trimmed.starts_with("# ") && current_section_name.is_none() {
                    let raw_heading = trimmed[2..].trim();
                    if raw_heading != "登場人物ノート" && raw_heading != "世界観・舞台設定ノート" && raw_heading != "全体筋書き・プロット構成" {
                        current_section_name = Some(raw_heading.to_string());
                    }
                } else {
                    current_section_lines.push(line);
                }
            }

            flush_section(
                current_section_name.take(),
                &current_section_type,
                &current_section_lines,
                &mut extracted_nodes,
                &mut extracted_relations,
            );
        }

        let now = Utc::now().to_rfc3339();

        for mut extracted in extracted_nodes {
            if let Some(existing) = current_graph.nodes.iter_mut().find(|n| n.name == extracted.name) {
                existing.node_type = extracted.node_type;
                if !extracted.aliases.is_empty() {
                    existing.aliases = extracted.aliases;
                }
                if !extracted.summary.is_empty() {
                    existing.summary = extracted.summary;
                }
                for (k, v) in extracted.attributes {
                    existing.attributes.insert(k, v);
                }
                if !extracted.full_text.is_empty() {
                    existing.full_text = extracted.full_text;
                }
                existing.updated_at = now.clone();
            } else {
                extracted.id = format!("node-{}", Uuid::new_v4());
                extracted.created_at = now.clone();
                extracted.updated_at = now.clone();
                current_graph.nodes.push(extracted);
            }
        }

        for rel in extracted_relations {
            let source_id = current_graph.nodes.iter().find(|n| n.name == rel.source_name || n.aliases.contains(&rel.source_name)).map(|n| n.id.clone());
            let target_id = current_graph.nodes.iter().find(|n| n.name == rel.target_name || n.aliases.contains(&rel.target_name)).map(|n| n.id.clone());

            if let (Some(s_id), Some(t_id)) = (source_id, target_id) {
                if s_id != t_id {
                    let exists = current_graph.edges.iter().any(|e| {
                        (e.source_id == s_id && e.target_id == t_id && e.relation_type == rel.relation_type)
                            || (e.source_id == t_id && e.target_id == s_id && e.relation_type == rel.relation_type)
                    });
                    if !exists {
                        current_graph.edges.push(WorldEdge {
                            id: format!("edge-{}", Uuid::new_v4()),
                            source_id: s_id,
                            target_id: t_id,
                            relation_type: rel.relation_type,
                            description: rel.description,
                            ..Default::default()
                        });
                    }
                }
            }
        }

        self.save_graph_atomic(&current_graph)?;
        Ok(current_graph)
    }

    /// Autonomous Graph Extraction using AI LLM
    pub async fn extract_graph_with_ai(
        &self,
        text: &str,
        config: &crate::ai::provider::AiConfig,
    ) -> Result<GraphData, WorldGraphError> {
        let system_prompt = r#"あなたは小説の構造解析エンジンです。与えられた設定資料または原稿テキストから、登場人物、世界観ルール・用語、舞台・場所、プロット（筋書き・伏線）とそれらの相関関係を抽出し、以下のJSONスキーマ厳守で出力してください。Markdownのコードブロック ```json ... ``` のみを出力してください。

スキーマ:
{
  "nodes": [
    {
      "node_type": "character" | "term" | "location" | "plot",
      "name": "エンティティ名",
      "aliases": ["別名1", "別名2"],
      "summary": "1行の簡潔な要約",
      "attributes": { "キー": "値" },
      "full_text": "詳細な記述"
    }
  ],
  "edges": [
    {
      "source_name": "起点エンティティ名",
      "target_name": "終点エンティティ名",
      "relation_type": "師弟 | 敵対 | 滞在 | 契機 | 秘密 etc.",
      "description": "関係性の補足"
    }
  ]
}"#;

        let provider = crate::ai::provider::AiProvider::new();
        let ai_response = provider
            .request_review(config, system_prompt, text)
            .await
            .map_err(|e| WorldGraphError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

        let json_str = if let Some(start) = ai_response.find("```json") {
            let after = &ai_response[start + 7..];
            if let Some(end) = after.find("```") {
                &after[..end]
            } else {
                after
            }
        } else if let Some(start) = ai_response.find("```") {
            let after = &ai_response[start + 3..];
            if let Some(end) = after.find("```") {
                &after[..end]
            } else {
                after
            }
        } else {
            &ai_response
        };

        #[derive(Deserialize)]
        struct ExtractedAiNode {
            pub node_type: String,
            pub name: String,
            #[serde(default)]
            pub aliases: Vec<String>,
            #[serde(default)]
            pub summary: String,
            #[serde(default)]
            pub attributes: HashMap<String, String>,
            #[serde(default)]
            pub full_text: String,
        }

        #[derive(Deserialize)]
        struct ExtractedAiEdge {
            pub source_name: String,
            pub target_name: String,
            pub relation_type: String,
            #[serde(default)]
            pub description: String,
        }

        #[derive(Deserialize)]
        struct ExtractedAiGraph {
            #[serde(default)]
            pub nodes: Vec<ExtractedAiNode>,
            #[serde(default)]
            pub edges: Vec<ExtractedAiEdge>,
        }

        let parsed: ExtractedAiGraph = serde_json::from_str(json_str.trim())
            .map_err(WorldGraphError::Json)?;

        let mut current_graph = self.get_graph().unwrap_or_default();
        let now = Utc::now().to_rfc3339();

        for n in parsed.nodes {
            if let Some(existing) = current_graph.nodes.iter_mut().find(|ex| ex.name == n.name) {
                existing.node_type = n.node_type;
                if !n.aliases.is_empty() {
                    existing.aliases = n.aliases;
                }
                if !n.summary.is_empty() {
                    existing.summary = n.summary;
                }
                for (k, v) in n.attributes {
                    existing.attributes.insert(k, v);
                }
                if !n.full_text.is_empty() {
                    existing.full_text = n.full_text;
                }
                existing.updated_at = now.clone();
            } else {
                current_graph.nodes.push(WorldNode {
                    id: format!("node-{}", Uuid::new_v4()),
                    node_type: n.node_type,
                    name: n.name,
                    aliases: n.aliases,
                    summary: n.summary,
                    attributes: n.attributes,
                    full_text: n.full_text,
                    created_at: now.clone(),
                    updated_at: now.clone(),
                    ..Default::default()
                });
            }
        }

        for e in parsed.edges {
            let s_id = current_graph.nodes.iter().find(|n| n.name == e.source_name).map(|n| n.id.clone());
            let t_id = current_graph.nodes.iter().find(|n| n.name == e.target_name).map(|n| n.id.clone());
            if let (Some(source_id), Some(target_id)) = (s_id, t_id) {
                if source_id != target_id {
                    let exists = current_graph.edges.iter().any(|edge| {
                        edge.source_id == source_id && edge.target_id == target_id && edge.relation_type == e.relation_type
                    });
                    if !exists {
                        current_graph.edges.push(WorldEdge {
                            id: format!("edge-{}", Uuid::new_v4()),
                            source_id,
                            target_id,
                            relation_type: e.relation_type,
                            description: e.description,
                            ..Default::default()
                        });
                    }
                }
            }
        }

        self.save_graph_atomic(&current_graph)?;
        Ok(current_graph)
    }

    /// In-place safe atomic save to avoid Google Drive file trashing / inode recreation
    pub fn save_graph_atomic(&self, data: &GraphData) -> Result<(), WorldGraphError> {
        let parent = self.graph_file_path.parent().unwrap();
        if !parent.exists() {
            fs::create_dir_all(parent)?;
        }

        let json = serde_json::to_string_pretty(data)?;
        use std::io::Write;
        let mut file = std::fs::OpenOptions::new()
            .write(true)
            .truncate(true)
            .create(true)
            .open(&self.graph_file_path)?;
        file.write_all(json.as_bytes())?;
        file.flush()?;
        Ok(())
    }

    /// Upsert node
    pub fn upsert_node(&self, mut node: WorldNode) -> Result<WorldNode, WorldGraphError> {
        let mut data = self.get_graph()?;
        let now = Utc::now().to_rfc3339();

        if node.id.trim().is_empty() {
            node.id = format!("node-{}", Uuid::new_v4());
        }

        node.updated_at = now.clone();

        if let Some(existing) = data.nodes.iter_mut().find(|n| n.id == node.id) {
            if node.created_at.is_empty() {
                node.created_at = existing.created_at.clone();
            }
            *existing = node.clone();
        } else {
            if node.created_at.is_empty() {
                node.created_at = now;
            }
            data.nodes.push(node.clone());
        }

        self.save_graph_atomic(&data)?;
        Ok(node)
    }

    /// Delete node and all cascade edges connected to it
    pub fn delete_node(&self, node_id: &str) -> Result<(), WorldGraphError> {
        let mut data = self.get_graph()?;
        let initial_node_count = data.nodes.len();
        data.nodes.retain(|n| n.id != node_id);

        if data.nodes.len() == initial_node_count {
            return Err(WorldGraphError::NodeNotFound(node_id.to_string()));
        }

        // Cascade delete connected edges
        data.edges.retain(|e| e.source_id != node_id && e.target_id != node_id);

        self.save_graph_atomic(&data)?;
        Ok(())
    }

    /// Upsert edge
    pub fn upsert_edge(&self, mut edge: WorldEdge) -> Result<WorldEdge, WorldGraphError> {
        let mut data = self.get_graph()?;

        // Verify source and target nodes exist
        if !data.nodes.iter().any(|n| n.id == edge.source_id) {
            return Err(WorldGraphError::NodeNotFound(edge.source_id));
        }
        if !data.nodes.iter().any(|n| n.id == edge.target_id) {
            return Err(WorldGraphError::NodeNotFound(edge.target_id));
        }

        if edge.id.trim().is_empty() {
            edge.id = format!("edge-{}", Uuid::new_v4());
        }

        if let Some(existing) = data.edges.iter_mut().find(|e| e.id == edge.id) {
            *existing = edge.clone();
        } else {
            data.edges.push(edge.clone());
        }

        self.save_graph_atomic(&data)?;
        Ok(edge)
    }

    /// Delete edge
    pub fn delete_edge(&self, edge_id: &str) -> Result<(), WorldGraphError> {
        let mut data = self.get_graph()?;
        let initial_count = data.edges.len();
        data.edges.retain(|e| e.id != edge_id);

        if data.edges.len() == initial_count {
            return Err(WorldGraphError::EdgeNotFound(edge_id.to_string()));
        }

        self.save_graph_atomic(&data)?;
        Ok(())
    }

    /// AI Graph Context Generator (GraphRAG Core)
    /// Scans manuscript text, matches Nodes (by name or aliases),
    /// traverses 1-2 hops via petgraph, and compiles structured context XML/Markdown.
    pub fn build_ai_graph_context(&self, manuscript_text: &str) -> Result<String, WorldGraphError> {
        let data = self.get_graph()?;
        if data.nodes.is_empty() {
            return Ok(String::new());
        }

        // 1. Build petgraph DiGraph with indices
        let mut graph = Graph::<&WorldNode, &WorldEdge>::new();
        let mut node_to_idx: HashMap<&str, NodeIndex> = HashMap::new();
        let mut idx_to_node_id: HashMap<NodeIndex, &str> = HashMap::new();

        for node in &data.nodes {
            let idx = graph.add_node(node);
            node_to_idx.insert(&node.id, idx);
            idx_to_node_id.insert(idx, &node.id);
        }

        for edge in &data.edges {
            if let (Some(&src_idx), Some(&tgt_idx)) = (
                node_to_idx.get(edge.source_id.as_str()),
                node_to_idx.get(edge.target_id.as_str()),
            ) {
                graph.add_edge(src_idx, tgt_idx, edge);
            }
        }

        // 2. Identify mentioned nodes in manuscript text
        let mut direct_node_ids: HashSet<String> = HashSet::new();

        for node in &data.nodes {
            let mut matches = false;
            if !node.name.is_empty() && manuscript_text.contains(&node.name) {
                matches = true;
            } else {
                for alias in &node.aliases {
                    if !alias.is_empty() && manuscript_text.contains(alias) {
                        matches = true;
                        break;
                    }
                }
            }

            if matches {
                direct_node_ids.insert(node.id.clone());
            }
        }

        // If no node explicitly matched, fallback to all nodes or top nodes (if small dataset)
        let matched_ids = if direct_node_ids.is_empty() {
            // If text is short or no match, include characters and key plots as general context
            data.nodes.iter().map(|n| n.id.clone()).collect::<HashSet<_>>()
        } else {
            // Expand 1-hop / 2-hops
            let mut expanded_ids = direct_node_ids.clone();
            for direct_id in &direct_node_ids {
                if let Some(&node_idx) = node_to_idx.get(direct_id.as_str()) {
                    // Outgoing edges
                    for edge_ref in graph.edges(node_idx) {
                        let target_idx = edge_ref.target();
                        if let Some(&target_id) = idx_to_node_id.get(&target_idx) {
                            expanded_ids.insert(target_id.to_string());
                        }
                    }
                    // Incoming edges
                    for edge_ref in graph.edges_directed(node_idx, petgraph::Direction::Incoming) {
                        let source_idx = edge_ref.source();
                        if let Some(&source_id) = idx_to_node_id.get(&source_idx) {
                            expanded_ids.insert(source_id.to_string());
                        }
                    }
                }
            }
            expanded_ids
        };

        // Filter nodes & edges in subgraph
        let relevant_nodes: Vec<&WorldNode> = data
            .nodes
            .iter()
            .filter(|n| matched_ids.contains(&n.id))
            .collect();

        let relevant_edges: Vec<&WorldEdge> = data
            .edges
            .iter()
            .filter(|e| matched_ids.contains(&e.source_id) && matched_ids.contains(&e.target_id))
            .collect();

        // 3. Render into Structured <WorldGraphContext>
        let mut out = String::new();
        out.push_str("<WorldGraphContext>\n");
        out.push_str("【世界観・設定グラフ情報 (GraphRAG抽出)】\n");
        out.push_str("以下の設定資料・人物相関・プロット制約を前提として、文章の推敲および設定矛盾の検知を行ってください。\n\n");

        out.push_str("### 1. 登場・関連ノード（キャラクター / 用語 / プロット / 場所）\n");
        for node in &relevant_nodes {
            let type_label = match node.node_type.as_str() {
                "character" => "👤 人物",
                "term" => "🏛️ 世界観・用語",
                "plot" => "📌 プロット・伏線",
                "location" => "🗺️ 場所",
                _ => "📄 設定",
            };
            let aliases_display = if node.aliases.is_empty() {
                "なし".to_string()
            } else {
                node.aliases.join(", ")
            };
            out.push_str(&format!(
                "- **{}「{}」** (別名: {})\n  - 概要: {}\n",
                type_label,
                node.name,
                aliases_display,
                node.summary
            ));
            if !node.attributes.is_empty() {
                out.push_str("  - 属性・制約:\n");
                for (k, v) in &node.attributes {
                    out.push_str(&format!("    - {}: {}\n", k, v));
                }
            }
            if !node.long_note.trim().is_empty() {
                out.push_str("  - 詳細長文設定ノート:\n");
                for line in node.long_note.lines().take(8) {
                    let trim = line.trim();
                    if !trim.is_empty() {
                        out.push_str(&format!("    {}\n", trim));
                    }
                }
            }
        }

        if !relevant_edges.is_empty() {
            out.push_str("\n### 2. 人物相関・プロット関係性\n");
            for edge in &relevant_edges {
                let src_name = data
                    .nodes
                    .iter()
                    .find(|n| n.id == edge.source_id)
                    .map(|n| n.name.as_str())
                    .unwrap_or("不明");
                let tgt_name = data
                    .nodes
                    .iter()
                    .find(|n| n.id == edge.target_id)
                    .map(|n| n.name.as_str())
                    .unwrap_or("不明");

                out.push_str(&format!(
                    "- [{} ➔ {}] 関係: **{}**",
                    src_name, tgt_name, edge.relation_type
                ));
                if !edge.description.is_empty() {
                    out.push_str(&format!(" ({})", edge.description));
                }
                out.push('\n');
            }
        }

        out.push_str("\n### 3. AI推敲・矛盾チェック指令\n");
        out.push_str("- キャラクターの一人称、二人称、口調、感情表現が上記設定と一致しているか検証してください。\n");
        out.push_str("- キャラクター間の相関関係や設定された関係性に反する不自然なやり取りがないか精査してください。\n");
        out.push_str("- 未知・未到達のプロット知識を登場人物が不自然に口にしていないか（フライング知識の混入）を確認してください。\n");
        out.push_str("</WorldGraphContext>\n");

        Ok(out)
    }

    /// Fast local analysis of the scene against the World Graph:
    /// Returns currently active entities, their direct relations, and heuristic consistency hints.
    pub fn analyze_scene(&self, manuscript_text: &str) -> Result<SceneGraphAnalysis, WorldGraphError> {
        let data = self.get_graph()?;
        let mut active_nodes = Vec::new();
        let mut consistency_hints = Vec::new();

        for node in &data.nodes {
            let matches_name = !node.name.is_empty() && manuscript_text.contains(&node.name);
            let matches_alias = node.aliases.iter().any(|a| !a.is_empty() && manuscript_text.contains(a));

            if matches_name || matches_alias {
                active_nodes.push(node.clone());

                // Heuristic consistency checks
                if let Some(first_person) = node.attributes.get("一人称") {
                    // Check if other common first-person pronouns exist in text that might collide
                    let alt_pronouns = ["私", "僕", "俺", "おれ", "わし", "拙者", "我", "あたし"];
                    for &p in &alt_pronouns {
                        if p != first_person && manuscript_text.contains(p) {
                            consistency_hints.push(format!(
                                "【一人称確認】『{}』の設定一人称は「{}」ですが、本文中に「{}」が検出されました。口調ブレがないかご確認ください。",
                                node.name, first_person, p
                            ));
                            break;
                        }
                    }
                }
            }
        }

        let active_ids: HashSet<String> = active_nodes.iter().map(|n| n.id.clone()).collect();
        let active_edges: Vec<WorldEdge> = data
            .edges
            .into_iter()
            .filter(|e| active_ids.contains(&e.source_id) && active_ids.contains(&e.target_id))
            .collect();

        // Edge relationship hints
        for edge in &active_edges {
            consistency_hints.push(format!(
                "【相関提示】関連する関係性「{}」がこのシーンに影響しています{}",
                edge.relation_type,
                if edge.description.is_empty() { String::new() } else { format!("（{}）", edge.description) }
            ));
        }

        Ok(SceneGraphAnalysis {
            active_nodes,
            active_edges,
            consistency_hints,
        })
    }

    /// Autonomous bi-directional extraction from manuscript back to notes & graph DB
    pub async fn sync_manuscript_to_world(
        &self,
        manuscript_text: &str,
        config: Option<&crate::ai::provider::AiConfig>,
    ) -> Result<SyncManuscriptResult, WorldGraphError> {
        self.ensure_initialized()?;
        let current_graph = self.get_graph()?;

        // Known names and aliases for fast lookup
        let mut known_names: HashSet<String> = HashSet::new();
        for node in &current_graph.nodes {
            known_names.insert(node.name.clone());
            for alias in &node.aliases {
                known_names.insert(alias.clone());
            }
        }

        let mut candidate_nodes: Vec<WorldNode> = Vec::new();
        let mut candidate_edges: Vec<WorldEdge> = Vec::new();
        let now = Utc::now().to_rfc3339();

        // 1. Local Heuristic Extraction
        // (a) Ruby extractor: ｜親文字《ルビ》 or 漢字《ルビ》
        let ruby_regex = regex::Regex::new(r"(?:｜([^\n《》]{1,20})|([一-龠々〆ヵヶ]{1,20}))《([^\n《》]{1,30})》").unwrap();
        for cap in ruby_regex.captures_iter(manuscript_text) {
            let parent = cap.get(1).or_else(|| cap.get(2)).map(|m| m.as_str().trim()).unwrap_or("");
            let reading = cap.get(3).map(|m| m.as_str().trim()).unwrap_or("");
            if !parent.is_empty() && !known_names.contains(parent) && !candidate_nodes.iter().any(|n| n.name == parent) {
                let mut attrs = HashMap::new();
                if !reading.is_empty() {
                    attrs.insert("読み".to_string(), reading.to_string());
                }
                candidate_nodes.push(WorldNode {
                    id: format!("node-{}", Uuid::new_v4()),
                    node_type: "term".to_string(),
                    name: parent.to_string(),
                    aliases: if reading.is_empty() { Vec::new() } else { vec![reading.to_string()] },
                    summary: format!("原稿内でルビ表記「{}（{}）」として初出。", parent, reading),
                    attributes: attrs,
                    full_text: format!("## {}\n- 種別: term\n- 別名: {}\n\n原稿より自動抽出された世界観用語。", parent, reading),
                    created_at: now.clone(),
                    updated_at: now.clone(),
                    ..Default::default()
                });
            }
        }

        // (b) Speaker / Dialogue heuristic:
        // Match expressions like: 〇〇[はが]...「...」 or 〇〇が叫んだ。「
        let dialogue_regex = regex::Regex::new(r#"(?:^|[\n。！？、\s])([^\n\r。！？、\s「」]{2,8})[はが][^「」\n\r]{0,15}「"#).unwrap();
        let common_stop_words: HashSet<&str> = [
            "彼", "彼女", "自分", "おれ", "私", "僕", "誰か", "男", "女", "声", "誰", "相手",
            "その者", "何者", "二人", "人々", "全員", "やつ", "奴", "者", "誰しも"
        ].into_iter().collect();

        for cap in dialogue_regex.captures_iter(manuscript_text) {
            if let Some(m) = cap.get(1) {
                let speaker = m.as_str().trim();
                if speaker.chars().count() >= 2
                    && !common_stop_words.contains(speaker)
                    && !known_names.contains(speaker)
                    && !candidate_nodes.iter().any(|n| n.name == speaker)
                    && !speaker.contains("こと")
                    && !speaker.contains("もの")
                {
                    candidate_nodes.push(WorldNode {
                        id: format!("node-{}", Uuid::new_v4()),
                        node_type: "character".to_string(),
                        name: speaker.to_string(),
                        aliases: Vec::new(),
                        summary: format!("原稿の発言箇所「{}は……「」」より新登場人物として自動検出。", speaker),
                        attributes: HashMap::new(),
                        full_text: format!("## {}\n- 種別: character\n\n原稿より自動検出された登場人物。", speaker),
                        created_at: now.clone(),
                        updated_at: now.clone(),
                        ..Default::default()
                    });
                }
            }
        }

        // 2. AI Extraction if config is provided
        if let Some(ai_cfg) = config {
            let existing_names_str = current_graph.nodes.iter().map(|n| n.name.as_str()).collect::<Vec<_>>().join(", ");
            let system_prompt = format!(
                r#"あなたは小説の自律設定解析エンジンです。原稿から新しく登場した人物、世界観用語、舞台、プロット伏線、および人物同士の相関関係を抽出し、以下のJSON形式厳守で出力してください。Markdownコードブロック ```json ... ``` のみを出力してください。
すでに登録済みの設定要素（以下）は重複登録せず、未知の新規要素または新しい関係性のみを抽出してください。
【既登録要素】: {}

スキーマ:
{{
  "nodes": [
    {{
      "node_type": "character" | "term" | "location" | "plot",
      "name": "エンティティ名",
      "aliases": ["別名1"],
      "summary": "1行の簡潔な要約",
      "attributes": {{ "キー": "値" }},
      "full_text": "詳細情報"
    }}
  ],
  "edges": [
    {{
      "source_name": "起点エンティティ名",
      "target_name": "終点エンティティ名",
      "relation_type": "関係種別",
      "description": "補足"
    }}
  ]
}}"#,
                existing_names_str
            );

            let provider = crate::ai::provider::AiProvider::new();
            if let Ok(ai_res) = provider.request_review(ai_cfg, &system_prompt, manuscript_text).await {
                let json_str = if let Some(start) = ai_res.find("```json") {
                    let after = &ai_res[start + 7..];
                    if let Some(end) = after.find("```") {
                        &after[..end]
                    } else {
                        after
                    }
                } else if let Some(start) = ai_res.find("```") {
                    let after = &ai_res[start + 3..];
                    if let Some(end) = after.find("```") {
                        &after[..end]
                    } else {
                        after
                    }
                } else {
                    &ai_res
                };

                #[derive(Deserialize)]
                struct ExtractedAiItem {
                    pub node_type: String,
                    pub name: String,
                    #[serde(default)]
                    pub aliases: Vec<String>,
                    #[serde(default)]
                    pub summary: String,
                    #[serde(default)]
                    pub attributes: HashMap<String, String>,
                    #[serde(default)]
                    pub full_text: String,
                }

                #[derive(Deserialize)]
                struct ExtractedAiRelation {
                    pub source_name: String,
                    pub target_name: String,
                    pub relation_type: String,
                    #[serde(default)]
                    pub description: String,
                }

                #[derive(Deserialize)]
                struct AiExtracted {
                    #[serde(default)]
                    nodes: Vec<ExtractedAiItem>,
                    #[serde(default)]
                    edges: Vec<ExtractedAiRelation>,
                }

                if let Ok(parsed) = serde_json::from_str::<AiExtracted>(json_str.trim()) {
                    for n in parsed.nodes {
                        if !known_names.contains(&n.name) && !candidate_nodes.iter().any(|ex| ex.name == n.name) {
                            candidate_nodes.push(WorldNode {
                                id: format!("node-{}", Uuid::new_v4()),
                                node_type: n.node_type,
                                name: n.name,
                                aliases: n.aliases,
                                summary: n.summary,
                                attributes: n.attributes,
                                full_text: n.full_text,
                                created_at: now.clone(),
                                updated_at: now.clone(),
                                ..Default::default()
                            });
                        }
                    }
                    for e in parsed.edges {
                        candidate_edges.push(WorldEdge {
                            id: format!("edge-{}", Uuid::new_v4()),
                            source_id: e.source_name,
                            target_id: e.target_name,
                            relation_type: e.relation_type,
                            description: e.description,
                            ..Default::default()
                        });
                    }
                }
            }
        }

        // 3. Write back to note markdown files in .novelstudio/notes/
        let notes_dir = self.notes_dir();
        for node in &candidate_nodes {
            let note_filename = match node.node_type.as_str() {
                "character" => "characters.md",
                "location" => "locations.md",
                "plot" => "plot.md",
                _ => "world_terms.md",
            };
            let note_path = notes_dir.join(note_filename);

            let mut append_content = String::new();
            append_content.push_str(&format!("\n\n## {}\n- 種別: {}\n", node.name, node.node_type));
            if !node.aliases.is_empty() {
                append_content.push_str(&format!("- 別名: {}\n", node.aliases.join(", ")));
            }
            for (k, v) in &node.attributes {
                append_content.push_str(&format!("- {}: {}\n", k, v));
            }
            append_content.push('\n');
            if !node.summary.is_empty() {
                append_content.push_str(&node.summary);
                append_content.push('\n');
            }

            // Append or create
            if note_path.exists() {
                let existing = fs::read_to_string(&note_path).unwrap_or_default();
                if !existing.contains(&format!("## {}", node.name)) {
                    let mut file = fs::OpenOptions::new().append(true).open(&note_path)?;
                    use std::io::Write;
                    file.write_all(append_content.as_bytes())?;
                }
            } else {
                let header = match node.node_type.as_str() {
                    "character" => "# 登場人物ノート\n",
                    "location" => "# 世界観・舞台設定ノート\n",
                    "plot" => "# 全体筋書き・プロット構成\n",
                    _ => "# 世界観・用語ノート\n",
                };
                let full = format!("{}{}", header, append_content);
                fs::write(&note_path, full)?;
            }
        }

        // 4. Synchronize notes to graph
        let mut updated_graph = self.sync_notes_to_graph()?;

        // 5. Connect candidate edges if any
        let mut actual_added_edges = Vec::new();
        for edge in candidate_edges {
            let src_id = updated_graph.nodes.iter().find(|n| n.name == edge.source_id || n.id == edge.source_id).map(|n| n.id.clone());
            let tgt_id = updated_graph.nodes.iter().find(|n| n.name == edge.target_id || n.id == edge.target_id).map(|n| n.id.clone());
            if let (Some(s), Some(t)) = (src_id, tgt_id) {
                if s != t {
                    let exists = updated_graph.edges.iter().any(|e| (e.source_id == s && e.target_id == t) || (e.source_id == t && e.target_id == s));
                    if !exists {
                        let new_edge = WorldEdge {
                            id: format!("edge-{}", Uuid::new_v4()),
                            source_id: s,
                            target_id: t,
                            relation_type: edge.relation_type,
                            description: edge.description,
                            ..Default::default()
                        };
                        updated_graph.edges.push(new_edge.clone());
                        actual_added_edges.push(new_edge);
                    }
                }
            }
        }

        if !actual_added_edges.is_empty() {
            self.save_graph_atomic(&updated_graph)?;
        }

        let added_nodes_count = candidate_nodes.len();
        let added_edges_count = actual_added_edges.len();
        let total_count = added_nodes_count + added_edges_count;
        let message = if total_count > 0 {
            format!("新規設定{}件（人物・用語{}件、相関{}件）をノートとグラフに自動反映しました", total_count, added_nodes_count, added_edges_count)
        } else {
            "新規設定は検出されませんでした（すべての固有名詞・設定は登録済みです）".to_string()
        };

        Ok(SyncManuscriptResult {
            added_nodes_count,
            added_edges_count,
            added_nodes: candidate_nodes,
            added_edges: actual_added_edges,
            message,
            graph: updated_graph,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_world_graph_crud_and_atomic_save() {
        let dir = tempdir().unwrap();
        let sample_dir = dir.path().join("NovelStudio_Sample");
        let engine = KuzuGraphEngine::new(&sample_dir);
        let _ = engine.init_sample_graph().unwrap();

        // 1. Initial graph loading creates sample data
        let initial_graph = engine.get_graph().unwrap();
        assert_eq!(initial_graph.nodes.len(), 4);
        assert_eq!(initial_graph.edges.len(), 3);

        // 2. Upsert new node
        let new_node = WorldNode {
            id: "".to_string(),
            node_type: "character".to_string(),
            name: "市女笠の女".to_string(),
            aliases: vec!["謎の女".to_string()],
            summary: "雨宿りに駆け込んできた高貴な女性".to_string(),
            attributes: HashMap::new(),
            full_text: "雨宿りに駆け込んできた高貴な女性。".to_string(),
            created_at: "".to_string(),
            updated_at: "".to_string(),
            ..Default::default()
        };
        let created_node = engine.upsert_node(new_node.clone()).unwrap();
        assert!(!created_node.id.is_empty());
        assert_eq!(created_node.name, "市女笠の女");

        let graph_after_add = engine.get_graph().unwrap();
        assert_eq!(graph_after_add.nodes.len(), 5);

        // 3. Upsert edge
        let new_edge = WorldEdge {
            id: "".to_string(),
            source_id: created_node.id.clone(),
            target_id: "node-gate-03".to_string(),
            relation_type: "遭遇".to_string(),
            description: "門の下で下人とすれ違う".to_string(),
            ..Default::default()
        };
        let created_edge = engine.upsert_edge(new_edge).unwrap();
        assert!(!created_edge.id.is_empty());

        let graph_after_edge = engine.get_graph().unwrap();
        assert_eq!(graph_after_edge.edges.len(), 4);

        // 4. Delete node and ensure cascade edge removal
        engine.delete_node(&created_node.id).unwrap();
        let graph_after_delete = engine.get_graph().unwrap();
        assert_eq!(graph_after_delete.nodes.len(), 4);
        // Cascade delete should remove the newly created edge
        assert_eq!(graph_after_delete.edges.len(), 3);
        assert!(!graph_after_delete.edges.iter().any(|e| e.id == created_edge.id));
    }

    #[test]
    fn test_clean_init_without_sample_pollution() {
        let dir = tempdir().unwrap();
        let novel_dir = dir.path().join("MyNewEpicNovel");
        let engine = KuzuGraphEngine::new(&novel_dir);

        // Initial graph for a normal novel project must be completely empty!
        let initial_graph = engine.get_graph().unwrap();
        assert_eq!(initial_graph.nodes.len(), 0, "新規小説プロジェクトにサンプルノードが混入してはならない");
        assert_eq!(initial_graph.edges.len(), 0, "新規小説プロジェクトにサンプルエッジが混入してはならない");

        // Initial notes must be clean without Rashomon data
        let char_content = engine.read_note("characters.md").unwrap();
        assert!(!char_content.contains("下人"), "クリーンノートに下人が混入してはならない");
        assert!(!char_content.contains("老婆"), "クリーンノートに老婆が混入してはならない");
    }

    #[test]
    fn test_clear_graph_resets_everything() {
        let dir = tempdir().unwrap();
        let sample_dir = dir.path().join("NovelStudio_Sample");
        let engine = KuzuGraphEngine::new(&sample_dir);
        let _ = engine.init_sample_graph().unwrap();
        assert_eq!(engine.get_graph().unwrap().nodes.len(), 4);

        // Clear graph
        let cleared = engine.clear_graph().unwrap();
        assert_eq!(cleared.nodes.len(), 0);
        assert_eq!(cleared.edges.len(), 0);

        let reloaded = engine.get_graph().unwrap();
        assert_eq!(reloaded.nodes.len(), 0);
        assert_eq!(reloaded.edges.len(), 0);
    }

    #[test]
    fn test_card_templates_load_and_save() {
        let dir = tempdir().unwrap();
        let engine = KuzuGraphEngine::new(dir.path());

        // Default builtin templates
        let templates = engine.load_card_templates();
        assert!(templates.iter().any(|t| t.name.contains("異能・魔法スキル")));
        assert!(templates.iter().any(|t| t.name.contains("ミステリー事件")));
        assert!(templates.iter().any(|t| t.name.contains("組織・派閥")));

        // Save custom template
        let mut custom = templates.clone();
        custom.push(CardTemplate {
            id: "tmpl-custom-sf".to_string(),
            name: "🚀 SF宇宙戦艦設定".to_string(),
            node_type: "term".to_string(),
            description: "宇宙船の諸元".to_string(),
            fields: vec![CardTemplateField {
                key: "推進機関".to_string(),
                label: "推進機関".to_string(),
                placeholder: "ワープドライブ".to_string(),
                default_value: "".to_string(),
            }],
            is_builtin: false,
        });

        engine.save_card_templates(&custom).unwrap();
        let reloaded = engine.load_card_templates();
        assert_eq!(reloaded.len(), custom.len());
        assert!(reloaded.iter().any(|t| t.name.contains("SF宇宙戦艦")));
    }

    #[test]
    fn test_build_ai_graph_context_matching() {
        let dir = tempdir().unwrap();
        let sample_dir = dir.path().join("NovelStudio_Sample");
        let engine = KuzuGraphEngine::new(&sample_dir);
        let _ = engine.init_sample_graph().unwrap();

        let manuscript = "下人は梯子を一段ずつ登り、老婆の姿を窺った。";
        let context = engine.build_ai_graph_context(manuscript).unwrap();

        assert!(context.contains("<WorldGraphContext>"));
        assert!(context.contains("下人"));
        assert!(context.contains("老婆"));
        assert!(context.contains("対峙・追剥ぎ"));
        assert!(context.contains("一人称"));
    }

    #[test]
    fn test_analyze_scene_consistency() {
        let dir = tempdir().unwrap();
        let sample_dir = dir.path().join("NovelStudio_Sample");
        let engine = KuzuGraphEngine::new(&sample_dir);
        let _ = engine.init_sample_graph().unwrap();

        let manuscript = "下人は「私には行き場がない」と呟き、老婆の前に立った。";
        let analysis = engine.analyze_scene(manuscript).unwrap();

        assert_eq!(analysis.active_nodes.len(), 2);
        assert_eq!(analysis.active_edges.len(), 1);
        assert!(analysis.consistency_hints.iter().any(|h| h.contains("一人称確認")));
    }

    #[test]
    fn test_notes_and_sync_to_graph() {
        let dir = tempdir().unwrap();
        let sample_dir = dir.path().join("NovelStudio_Sample");
        let engine = KuzuGraphEngine::new(&sample_dir);
        let _ = engine.init_sample_graph().unwrap();

        // 1. Initial notes exist
        let notes = engine.list_notes().unwrap();
        assert!(notes.contains(&"characters.md".to_string()));
        assert!(notes.contains(&"locations.md".to_string()));
        assert!(notes.contains(&"plot.md".to_string()));

        // 2. Read note
        let char_content = engine.read_note("characters.md").unwrap();
        assert!(char_content.contains("下人"));

        // 3. Save a new note and check auto graph sync
        let custom_note = r#"# 新規設定ノート

## 盗賊頭領
- 種別: character
- 別名: 黒頭巾の男
- 口調: 威圧的で冷酷
- 関係: [[下人]] (追跡)

京洛の辻を騒がす盗賊一味の頭領。
"#;
        let synced = engine.save_note("thief.md", custom_note).unwrap();
        assert!(synced.nodes.iter().any(|n| n.name == "盗賊頭領"));
        let thief_node = synced.nodes.iter().find(|n| n.name == "盗賊頭領").unwrap();
        assert_eq!(thief_node.node_type, "character");
        assert!(thief_node.aliases.contains(&"黒頭巾の男".to_string()));

        // Edge between 盗賊頭領 and 下人
        assert!(synced.edges.iter().any(|e| {
            (e.source_id == thief_node.id || e.target_id == thief_node.id) && e.relation_type == "追跡"
        }));

        // 4. Overall plot
        let plot = engine.get_overall_plot().unwrap();
        assert!(plot.contains("悪への転向"));
        engine.save_overall_plot("# 全体プロット\n\n## クライマックス\n- 種別: plot\n下人の行方は誰も知らない。").unwrap();
        let updated_plot = engine.get_overall_plot().unwrap();
        assert!(updated_plot.contains("クライマックス"));
    }

    #[tokio::test]
    async fn test_sync_manuscript_to_world_heuristic() {
        let dir = tempdir().unwrap();
        let sample_dir = dir.path().join("NovelStudio_Sample");
        let engine = KuzuGraphEngine::new(&sample_dir);
        let _ = engine.init_sample_graph().unwrap();

        let manuscript = r#"
雨は依然として止む気配がなかった。
そんな折、従者修験が叫んだ。「門の下に誰かおりますぞ！」
下人は刀の柄に手をかけた。懐には先ほど拾った｜霊験符《れいげんふ》が隠されている。
"#;

        let result = engine.sync_manuscript_to_world(manuscript, None).await.unwrap();
        assert!(result.added_nodes_count >= 2);
        assert!(result.added_nodes.iter().any(|n| n.name == "従者修験" && n.node_type == "character"));
        assert!(result.added_nodes.iter().any(|n| n.name == "霊験符" && n.node_type == "term"));

        // Check if characters.md and world_terms.md were updated
        let char_note = engine.read_note("characters.md").unwrap();
        assert!(char_note.contains("従者修験"));

        let term_note = engine.read_note("world_terms.md").unwrap();
        assert!(term_note.contains("霊験符"));
    }
}
