use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum FrontmatterError {
    #[error("YAML serialization/deserialization failed: {0}")]
    YamlError(#[from] serde_yaml::Error),
    #[error("Invalid frontmatter format: {0}")]
    InvalidFormat(String),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SceneStatus {
    Draft,
    Ready,
    Reviewed,
}

impl Default for SceneStatus {
    fn default() -> Self {
        SceneStatus::Draft
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct Frontmatter {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default)]
    pub status: SceneStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pov: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timeline: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub location: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub characters: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub synopsis: Option<String>,
    #[serde(flatten)]
    pub extra: serde_yaml::Mapping,
}

/// Splits Markdown text into Frontmatter and Markdown Body.
/// Returns (Option<Frontmatter>, body_str)
pub fn extract_frontmatter(content: &str) -> (Option<Frontmatter>, String) {
    let trimmed = content.trim_start();
    if !trimmed.starts_with("---") {
        return (None, content.to_string());
    }

    // Skip the first "---" and newline
    let after_first_delimiter = &trimmed[3..];
    let start_idx = match after_first_delimiter.find('\n') {
        Some(idx) => idx + 1,
        None => return (None, content.to_string()),
    };

    let remaining = &after_first_delimiter[start_idx..];

    // Find the closing "---"
    let mut end_idx = None;
    for (i, line) in remaining.split_inclusive('\n').enumerate() {
        let trimmed_line = line.trim();
        if trimmed_line == "---" {
            // Find byte offset in remaining
            let offset = remaining
                .split_inclusive('\n')
                .take(i)
                .map(|s| s.len())
                .sum::<usize>();
            end_idx = Some((offset, offset + line.len()));
            break;
        }
    }

    if let Some((yaml_end, after_closing_delim)) = end_idx {
        let yaml_str = &remaining[..yaml_end];
        let body = remaining[after_closing_delim..].to_string();

        match serde_yaml::from_str::<Frontmatter>(yaml_str) {
            Ok(fm) => (Some(fm), body),
            Err(_) => {
                // Return None but preserve body if invalid yaml
                (None, content.to_string())
            }
        }
    } else {
        (None, content.to_string())
    }
}

/// Prepends or updates frontmatter in document content
pub fn update_frontmatter(content: &str, frontmatter: &Frontmatter) -> Result<String, FrontmatterError> {
    let (_, body) = extract_frontmatter(content);
    let yaml_str = serde_yaml::to_string(frontmatter)?;
    let clean_body = body.trim_start_matches('\n');

    Ok(format!("---\n{}---\n\n{}", yaml_str, clean_body))
}

/// Updates just the SceneStatus, keeping other fields intact
pub fn update_status(content: &str, new_status: SceneStatus) -> Result<String, FrontmatterError> {
    let (existing_fm, body) = extract_frontmatter(content);
    let mut fm = existing_fm.unwrap_or_default();
    fm.status = new_status;
    update_frontmatter(&body, &fm)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_frontmatter_valid() {
        let raw = r#"---
title: 第1話 旅立ちの夜
status: draft
pov: アリス
characters:
  - アリス
  - ボブ
---

ここは夜の王都。
冷たい風が吹き抜けていく。
"#;
        let (fm, body) = extract_frontmatter(raw);
        assert!(fm.is_some());
        let fm = fm.unwrap();
        assert_eq!(fm.title.as_deref(), Some("第1話 旅立ちの夜"));
        assert_eq!(fm.status, SceneStatus::Draft);
        assert_eq!(fm.pov.as_deref(), Some("アリス"));
        assert_eq!(fm.characters, vec!["アリス", "ボブ"]);
        assert!(body.contains("ここは夜の王都。"));
    }

    #[test]
    fn test_extract_without_frontmatter() {
        let raw = "ただのプレーンテキストです。\n二行目。";
        let (fm, body) = extract_frontmatter(raw);
        assert!(fm.is_none());
        assert_eq!(body, raw);
    }

    #[test]
    fn test_update_status() {
        let raw = r#"---
title: プロローグ
status: draft
---
本文開始"#;
        let updated = update_status(raw, SceneStatus::Ready).unwrap();
        let (fm, body) = extract_frontmatter(&updated);
        assert!(fm.is_some());
        let fm = fm.unwrap();
        assert_eq!(fm.status, SceneStatus::Ready);
        assert_eq!(fm.title.as_deref(), Some("プロローグ"));
        assert!(body.contains("本文開始"));
    }
}
