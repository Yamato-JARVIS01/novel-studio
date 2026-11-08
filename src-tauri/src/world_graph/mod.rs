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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
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
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct WorldEdge {
    pub id: String,
    pub source_id: String,
    pub target_id: String,
    pub relation_type: String, // "師弟", "敵対", "秘密を握る", "伏線回収", "登場" etc.
    #[serde(default)]
    pub description: String,
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

    /// Ensure directory and file exists, creating sample data if completely empty
    pub fn ensure_initialized(&self) -> Result<(), WorldGraphError> {
        let parent = self.graph_file_path.parent().unwrap();
        if !parent.exists() {
            fs::create_dir_all(parent)?;
        }

        let notes_dir = self.notes_dir();
        if !notes_dir.exists() {
            fs::create_dir_all(&notes_dir)?;
        }

        // Initialize sample notes if empty
        let char_note = notes_dir.join("characters.md");
        if !char_note.exists() {
            let sample_char = r#"# 登場人物ノート

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
"#;
            let _ = fs::write(char_note, sample_char);
        }

        let loc_note = notes_dir.join("locations.md");
        if !loc_note.exists() {
            let sample_loc = r#"# 世界観・舞台設定ノート

## 羅生門
- 種別: location
- 別名: 門, 楼上
- 状態: 荒廃、死体捨て場と化している
- 天気: 降りしきる夕方の雨

平安京の正門。荒廃し、狐狸や盗人が住みつき死骸が打ち捨てられている場所。
"#;
            let _ = fs::write(loc_note, sample_loc);
        }

        let plot_note = notes_dir.join("plot.md");
        if !plot_note.exists() {
            let sample_plot = r#"# 全体筋書き・プロット構成

## 悪への転向
- 種別: plot
- テーマ: 生存のための悪の肯定
- 結末: 下人が老婆の着物を剥ぎ取り闇へと消える
- 関連: [[下人]] (契機), [[老婆]] (契機)

老婆の弁明（生きるための悪）を聞き、下人が善悪の迷いを捨てて追剥ぎになる転換点。
"#;
            let _ = fs::write(plot_note, sample_plot);
        }

        if !self.graph_file_path.exists() {
            let sample_data = Self::build_sample_graph();
            self.save_graph_atomic(&sample_data)?;
        }
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
        };

        let edge1 = WorldEdge {
            id: "edge-01".to_string(),
            source_id: genin.id.clone(),
            target_id: roba.id.clone(),
            relation_type: "対峙・追剥ぎ".to_string(),
            description: "楼上で出遭い、老婆の論理を利用して着物を奪う関係。".to_string(),
        };

        let edge2 = WorldEdge {
            id: "edge-02".to_string(),
            source_id: genin.id.clone(),
            target_id: gate.id.clone(),
            relation_type: "滞在".to_string(),
            description: "雨宿りをしていたが、楼上の光に誘われて登る。".to_string(),
        };

        let edge3 = WorldEdge {
            id: "edge-03".to_string(),
            source_id: roba.id.clone(),
            target_id: plot.id.clone(),
            relation_type: "契機".to_string(),
            description: "老婆の言葉が下人のモラル崩壊を引き起こす。".to_string(),
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
                        });
                    }
                }
            }
        }

        self.save_graph_atomic(&current_graph)?;
        Ok(current_graph)
    }

    /// Atomically save graph data (.tmp -> rename)
    pub fn save_graph_atomic(&self, data: &GraphData) -> Result<(), WorldGraphError> {
        let parent = self.graph_file_path.parent().unwrap();
        if !parent.exists() {
            fs::create_dir_all(parent)?;
        }

        let tmp_file = parent.join(format!(".world_graph_{}.tmp", Uuid::new_v4()));
        let json = serde_json::to_string_pretty(data)?;
        fs::write(&tmp_file, json)?;
        fs::rename(tmp_file, &self.graph_file_path)?;
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
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_world_graph_crud_and_atomic_save() {
        let dir = tempdir().unwrap();
        let engine = KuzuGraphEngine::new(dir.path());

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
    fn test_build_ai_graph_context_matching() {
        let dir = tempdir().unwrap();
        let engine = KuzuGraphEngine::new(dir.path());

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
        let engine = KuzuGraphEngine::new(dir.path());

        let manuscript = "下人は「私には行き場がない」と呟き、老婆の前に立った。";
        let analysis = engine.analyze_scene(manuscript).unwrap();

        assert_eq!(analysis.active_nodes.len(), 2);
        assert_eq!(analysis.active_edges.len(), 1);
        assert!(analysis.consistency_hints.iter().any(|h| h.contains("一人称確認")));
    }

    #[test]
    fn test_notes_and_sync_to_graph() {
        let dir = tempdir().unwrap();
        let engine = KuzuGraphEngine::new(dir.path());
        engine.ensure_initialized().unwrap();

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
}
