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

    /// Ensure directory and file exists, creating sample data if completely empty
    fn ensure_initialized(&self) -> Result<(), WorldGraphError> {
        let parent = self.graph_file_path.parent().unwrap();
        if !parent.exists() {
            fs::create_dir_all(parent)?;
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
}
