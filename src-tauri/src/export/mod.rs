use chrono::Utc;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;

use crate::editor_engine::frontmatter::extract_frontmatter;
use crate::storage::manifest::{ManifestManager, VaultManifest};

#[derive(Error, Debug)]
pub enum ExportError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Serialization error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Manifest error: {0}")]
    Manifest(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportOptions {
    /// "submission_txt" | "submission_html" | "kakuyomu" | "narou" | "aozora" | "plain"
    pub format: String,
    #[serde(default = "default_true")]
    pub include_cover: bool,
    #[serde(default = "default_true")]
    pub include_chapter_titles: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EpisodeData {
    pub title: String,
    pub body: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportResult {
    pub title: String,
    pub content: String,
    pub format: String,
    pub char_count: usize,
    pub page_count_400: usize,
    pub page_count_20x20: usize,
    pub page_count_40x40: usize,
    pub episode_count: usize,
    pub suggested_filename: String,
}

pub struct ExportEngine;

impl ExportEngine {
    /// Format manuscript episodes into specified platform / submission format
    pub fn export_vault(vault_path: &Path, options: &ExportOptions) -> Result<ExportResult, ExportError> {
        let manifest: VaultManifest = ManifestManager::load_manifest(vault_path);

        let title = vault_path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("小説原稿")
            .to_string();

        // 1. Collect episode files in order
        let mut episode_paths: Vec<PathBuf> = Vec::new();
        for rel_path in &manifest.episode_order {
            let full = vault_path.join(rel_path);
            if full.exists() {
                episode_paths.push(full);
            }
        }

        // Fallback: list all .md and .txt files in vault
        if episode_paths.is_empty() {
            if let Ok(entries) = fs::read_dir(vault_path) {
                let mut files = Vec::new();
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() {
                        if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
                            if (ext == "md" || ext == "txt")
                                && !path.file_name().and_then(|s| s.to_str()).unwrap_or("").starts_with('.')
                            {
                                files.push(path);
                            }
                        }
                    }
                }
                files.sort();
                episode_paths = files;
            }
        }

        // 2. Read episodes, strip frontmatter, collect text
        let mut episodes: Vec<EpisodeData> = Vec::new();
        let mut total_char_count = 0;

        for path in &episode_paths {
            let content = fs::read_to_string(path).unwrap_or_default();
            let (fm, body) = extract_frontmatter(&content);
            let raw_name = path.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_string();
            let ep_title = fm
                .and_then(|f| f.title)
                .filter(|t| !t.trim().is_empty())
                .unwrap_or(raw_name);

            // Count characters (excluding frontmatter, standard char count excluding newlines)
            let trimmed_body = body.trim().to_string();
            total_char_count += trimmed_body.chars().filter(|c| !c.is_whitespace()).count();

            episodes.push(EpisodeData {
                title: ep_title,
                body: trimmed_body,
            });
        }

        let episode_count = episodes.len();
        // 400字詰原稿用紙換算枚数
        let page_count_400 = (total_char_count as f64 / 400.0).ceil() as usize;
        // 20×20 公募換算枚数 (1枚400字)
        let page_count_20x20 = page_count_400;
        // 40×40 公募換算枚数 (1枚1600字)
        let page_count_40x40 = (total_char_count as f64 / 1600.0).ceil() as usize;

        // Retrieve overall plot or synopsis for cover
        let plot_path = vault_path.join(".novelstudio").join("notes").join("plot.md");
        let synopsis = if plot_path.exists() {
            fs::read_to_string(plot_path).unwrap_or_default()
        } else {
            String::new()
        };

        // 3. Build format-specific content
        let (output_content, suggested_filename) = match options.format.as_str() {
            "submission_html" => {
                let html = Self::build_submission_html(
                    &title,
                    &synopsis,
                    total_char_count,
                    page_count_400,
                    page_count_20x20,
                    page_count_40x40,
                    episode_count,
                    &episodes,
                    options,
                );
                (html, format!("{}_公募原稿_縦書き組版.html", title))
            }
            "submission_txt" => {
                let txt = Self::build_submission_txt(
                    &title,
                    &synopsis,
                    total_char_count,
                    page_count_400,
                    page_count_20x20,
                    page_count_40x40,
                    episode_count,
                    &episodes,
                    options,
                );
                (txt, format!("{}_公募提出原稿.txt", title))
            }
            "kakuyomu" => {
                let content = Self::build_web_format(&episodes, "kakuyomu", options);
                (content, format!("{}_カクヨム用一括.txt", title))
            }
            "narou" => {
                let content = Self::build_web_format(&episodes, "narou", options);
                (content, format!("{}_なろう用一括.txt", title))
            }
            "aozora" => {
                let content = Self::build_web_format(&episodes, "aozora", options);
                (content, format!("{}_青空文庫形式.txt", title))
            }
            _ => {
                // plain
                let content = Self::build_web_format(&episodes, "plain", options);
                (content, format!("{}_プレーンテキスト.txt", title))
            }
        };

        Ok(ExportResult {
            title,
            content: output_content,
            format: options.format.clone(),
            char_count: total_char_count,
            page_count_400,
            page_count_20x20,
            page_count_40x40,
            episode_count,
            suggested_filename,
        })
    }

    /// Build submission TXT with standard Japanese prize header
    fn build_submission_txt(
        title: &str,
        synopsis: &str,
        char_count: usize,
        page_count_400: usize,
        page_count_20x20: usize,
        page_count_40x40: usize,
        episode_count: usize,
        episodes: &[EpisodeData],
        options: &ExportOptions,
    ) -> String {
        let mut out = String::new();

        if options.include_cover {
            out.push_str("================================================================\n");
            out.push_str(&format!("【作品名】{}\n", title));
            out.push_str(&format!("【総文字数】約 {} 字（空白除く）\n", char_count));
            out.push_str(&format!("【原稿用紙換算枚数 (400字詰)】約 {} 枚\n", page_count_400));
            out.push_str(&format!("【公募規定換算 (20字×20行)】約 {} 枚\n", page_count_20x20));
            out.push_str(&format!("【公募規定換算 (40字×40行)】約 {} 枚\n", page_count_40x40));
            out.push_str(&format!("【話数】全 {} 話\n", episode_count));
            out.push_str(&format!("【出力日時】{}\n", Utc::now().format("%Y年%m月%d日")));
            if !synopsis.trim().is_empty() {
                out.push_str("\n【あらすじ・概要】\n");
                out.push_str(synopsis.trim());
                out.push('\n');
            }
            out.push_str("================================================================\n\n\n");
        }

        for (idx, ep) in episodes.iter().enumerate() {
            if options.include_chapter_titles {
                out.push_str(&format!("第{}話　{}\n\n", idx + 1, ep.title));
            }
            let converted_body = Self::convert_ruby_and_bouten(&ep.body, "submission_txt");
            out.push_str(&converted_body);
            out.push_str("\n\n\n");
        }

        out
    }

    /// Build publication-ready vertical-writing HTML for printing or saving to PDF
    fn build_submission_html(
        title: &str,
        synopsis: &str,
        char_count: usize,
        page_count_400: usize,
        page_count_20x20: usize,
        page_count_40x40: usize,
        episode_count: usize,
        episodes: &[EpisodeData],
        options: &ExportOptions,
    ) -> String {
        let mut out = String::new();
        out.push_str("<!DOCTYPE html>\n<html lang=\"ja\">\n<head>\n");
        out.push_str("<meta charset=\"utf-8\">\n");
        out.push_str(&format!("<title>{} - 統合原稿</title>\n", html_escape(title)));
        out.push_str(r#"<style>
@page {
    size: A4 portrait;
    margin: 22mm 18mm 22mm 18mm;
}
* {
    box-sizing: border-box;
}
html, body {
    margin: 0;
    padding: 0;
    background-color: #fff;
    color: #1a1a1a;
    font-family: "Source Han Serif", "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif;
    -webkit-print-color-adjust: exact;
}
body {
    writing-mode: vertical-rl;
    -webkit-writing-mode: vertical-rl;
    line-height: 2.15;
    letter-spacing: 0.05em;
    font-size: 14.5px;
    height: 100%;
}
.cover-page {
    page-break-after: always;
    break-after: page;
    height: 100vh;
    padding: 30px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    border-left: 2px solid #ccc;
}
.cover-title {
    font-size: 2.4em;
    font-weight: bold;
    letter-spacing: 0.12em;
    margin-left: 1.5em;
    line-height: 1.4;
}
.cover-meta {
    font-size: 0.95em;
    opacity: 0.85;
    line-height: 2.0;
    margin-left: 2em;
}
.cover-synopsis {
    margin-left: 2em;
    font-size: 0.9em;
    line-height: 2.0;
    max-height: 80vh;
    overflow: hidden;
}
.chapter {
    page-break-before: always;
    break-before: page;
    padding: 20px 0;
}
.chapter-title {
    font-size: 1.5em;
    font-weight: bold;
    margin-left: 2em;
    margin-bottom: 2em;
    letter-spacing: 0.1em;
}
.paragraph {
    text-indent: 1em;
    margin: 0;
    word-break: break-all;
}
ruby rt {
    font-size: 0.52em;
    letter-spacing: 0;
}
em.sesame, .bouten {
    text-emphasis: filled sesame;
    -webkit-text-emphasis: filled sesame;
    font-style: normal;
}
@media screen {
    body {
        padding: 40px;
        background-color: #f7f5f0;
    }
    .cover-page, .chapter {
        background-color: #fff;
        padding: 40px;
        margin-bottom: 30px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        border-radius: 4px;
        min-height: 800px;
    }
}
</style>
</head>
<body>
"#);

        if options.include_cover {
            out.push_str("<div class=\"cover-page\">\n");
            out.push_str(&format!("<div class=\"cover-title\">{}</div>\n", html_escape(title)));
            out.push_str("<div class=\"cover-meta\">\n");
            out.push_str(&format!("<div>総文字数：約 {} 字</div>\n", char_count));
            out.push_str(&format!("<div>400字詰原稿用紙換算：約 {} 枚</div>\n", page_count_400));
            out.push_str(&format!("<div>20×20 公募換算：約 {} 枚 ／ 40×40 換算：約 {} 枚</div>\n", page_count_20x20, page_count_40x40));
            out.push_str(&format!("<div>構成：全 {} 話</div>\n", episode_count));
            out.push_str(&format!("<div>出力日：{}</div>\n", Utc::now().format("%Y年%m月%d日")));
            out.push_str("</div>\n");
            if !synopsis.trim().is_empty() {
                out.push_str("<div class=\"cover-synopsis\">\n");
                out.push_str("<strong>【あらすじ】</strong><br>\n");
                for line in synopsis.lines() {
                    let trim = line.trim();
                    if !trim.is_empty() {
                        out.push_str(&format!("<div>{}</div>\n", html_escape(trim)));
                    }
                }
                out.push_str("</div>\n");
            }
            out.push_str("</div>\n");
        }

        for (idx, ep) in episodes.iter().enumerate() {
            out.push_str("<div class=\"chapter\">\n");
            if options.include_chapter_titles {
                out.push_str(&format!("<div class=\"chapter-title\">第{}話　{}</div>\n", idx + 1, html_escape(&ep.title)));
            }
            let converted_body = Self::convert_ruby_and_bouten(&ep.body, "submission_html");
            for line in converted_body.lines() {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    out.push_str("<p class=\"paragraph\">&nbsp;</p>\n");
                } else {
                    out.push_str(&format!("<p class=\"paragraph\">{}</p>\n", trimmed));
                }
            }
            out.push_str("</div>\n");
        }

        out.push_str("</body>\n</html>");
        out
    }

    /// Build web novel platform formatted text (Kakuyomu / Narou / Aozora / Plain)
    fn build_web_format(
        episodes: &[EpisodeData],
        format_type: &str,
        options: &ExportOptions,
    ) -> String {
        let mut out = String::new();

        for (idx, ep) in episodes.iter().enumerate() {
            if options.include_chapter_titles {
                out.push_str(&format!("第{}話　{}\n\n", idx + 1, ep.title));
            }
            let converted = Self::convert_ruby_and_bouten(&ep.body, format_type);
            out.push_str(&converted);
            out.push_str("\n\n--------------------------------\n\n");
        }

        out
    }

    /// Convert rubies and sesame dots (bouten) into target platform syntax
    pub fn convert_ruby_and_bouten(text: &str, format_type: &str) -> String {
        let mut result = text.to_string();

        // 1. Ruby syntax: ｜親文字《ルビ》 and 漢字《ルビ》 (Process first to avoid conflicts with bouten)
        let ruby_pipe_re = Regex::new(r"[｜|]([^\n《》]+)《([^\n》]+)》").unwrap();
        let ruby_kanji_re = Regex::new(r"([一-龠々〆ヵヶ]{1,20})《([^\n》]+)》").unwrap();

        match format_type {
            "submission_html" => {
                result = ruby_pipe_re.replace_all(&result, "<ruby>$1<rt>$2</rt></ruby>").to_string();
                result = ruby_kanji_re.replace_all(&result, "<ruby>$1<rt>$2</rt></ruby>").to_string();
            }
            "kakuyomu" => {
                result = ruby_pipe_re.replace_all(&result, "|$1《$2》").to_string();
                result = ruby_kanji_re.replace_all(&result, "|$1《$2》").to_string();
            }
            "narou" => {
                result = ruby_pipe_re.replace_all(&result, "|$1($2)").to_string();
                result = ruby_kanji_re.replace_all(&result, "|$1($2)").to_string();
            }
            "aozora" => {
                result = ruby_pipe_re.replace_all(&result, "｜$1《$2》").to_string();
                result = ruby_kanji_re.replace_all(&result, "｜$1《$2》").to_string();
            }
            "plain" => {
                result = ruby_pipe_re.replace_all(&result, "$1").to_string();
                result = ruby_kanji_re.replace_all(&result, "$1").to_string();
            }
            _ => {
                result = ruby_pipe_re.replace_all(&result, "｜$1《$2》").to_string();
                result = ruby_kanji_re.replace_all(&result, "｜$1《$2》").to_string();
            }
        }

        // 2. Bouten / Sesame dots: 《《傍点》》
        let bouten_re = Regex::new(r"《《([^\n》]+)》》").unwrap();
        match format_type {
            "submission_html" => {
                result = bouten_re.replace_all(&result, "<em class=\"sesame\">$1</em>").to_string();
            }
            "narou" => {
                result = bouten_re
                    .replace_all(&result, |caps: &regex::Captures| {
                        let word = caps.get(1).map(|m| m.as_str()).unwrap_or("");
                        let mut formatted = String::new();
                        for ch in word.chars() {
                            formatted.push_str(&format!("|{}《・》", ch));
                        }
                        formatted
                    })
                    .to_string();
            }
            "aozora" => {
                result = bouten_re.replace_all(&result, "［＃傍点］$1［＃傍点終わり］").to_string();
            }
            "plain" => {
                result = bouten_re.replace_all(&result, "$1").to_string();
            }
            _ => {}
        }

        result
    }

    /// Save exported content to a file inside or outside the vault
    pub fn save_export_file(
        vault_path: &Path,
        file_name: &str,
        content: &str,
    ) -> Result<String, ExportError> {
        let export_dir = vault_path.join("exports");
        if !export_dir.exists() {
            fs::create_dir_all(&export_dir)?;
        }
        let target_path = export_dir.join(file_name);
        fs::write(&target_path, content)?;
        Ok(target_path.to_string_lossy().to_string())
    }
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_ruby_and_bouten_conversion() {
        let input = "下人は｜死骸《しがい》を見下ろし、《《悪》》を肯定した。";

        // HTML
        let html = ExportEngine::convert_ruby_and_bouten(input, "submission_html");
        assert!(html.contains("<ruby>死骸<rt>しがい</rt></ruby>"));
        assert!(html.contains("<em class=\"sesame\">悪</em>"));

        // Kakuyomu
        let kaku = ExportEngine::convert_ruby_and_bouten(input, "kakuyomu");
        assert!(kaku.contains("|死骸《しがい》"));
        assert!(kaku.contains("《《悪》》"));

        // Narou
        let narou = ExportEngine::convert_ruby_and_bouten(input, "narou");
        assert!(narou.contains("|死骸(しがい)"));
        assert!(narou.contains("|悪《・》"));

        // Aozora
        let aozora = ExportEngine::convert_ruby_and_bouten(input, "aozora");
        assert!(aozora.contains("｜死骸《しがい》"));
        assert!(aozora.contains("［＃傍点］悪［＃傍点終わり］"));

        // Plain
        let plain = ExportEngine::convert_ruby_and_bouten(input, "plain");
        assert_eq!(plain, "下人は死骸を見下ろし、悪を肯定した。");
    }

    #[test]
    fn test_export_vault_with_cover() {
        let dir = tempdir().unwrap();
        let ep1_path = dir.path().join("01_ep.md");
        fs::write(
            &ep1_path,
            "---\ntitle: 羅生門の雨\nstatus: ready\n---\n\nある日の暮方の事である。一人の｜下人《げにん》が羅生門の下で雨やみを待っていた。",
        )
        .unwrap();

        let ep2_path = dir.path().join("02_ep.md");
        fs::write(
            &ep2_path,
            "---\ntitle: 楼上の灯\nstatus: draft\n---\n\n梯子を登ると、白髪の老婆が死人の髪を抜いていた。",
        )
        .unwrap();

        let options = ExportOptions {
            format: "submission_txt".to_string(),
            include_cover: true,
            include_chapter_titles: true,
        };

        let result = ExportEngine::export_vault(dir.path(), &options).unwrap();
        assert_eq!(result.episode_count, 2);
        assert!(result.char_count > 40);
        assert!(result.content.contains("【作品名】"));
        assert!(result.content.contains("第1話　羅生門の雨"));
        assert!(result.content.contains("第2話　楼上の灯"));
        assert!(result.content.contains("原稿用紙換算枚数"));

        // Save export file
        let saved_path = ExportEngine::save_export_file(dir.path(), &result.suggested_filename, &result.content).unwrap();
        assert!(Path::new(&saved_path).exists());
    }
}
