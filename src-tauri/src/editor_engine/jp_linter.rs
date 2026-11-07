use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ManuscriptPaperRule {
    /// 400-character paper: 20 characters x 20 lines
    Genko20x20,
    /// 1600-character standard page: 40 characters x 40 lines (used in many novel contests)
    Genko40x40,
    /// Custom layout: chars_per_line x lines_per_page
    Custom { chars_per_line: usize, lines_per_page: usize },
}

impl Default for ManuscriptPaperRule {
    fn default() -> Self {
        ManuscriptPaperRule::Genko20x20
    }
}

impl ManuscriptPaperRule {
    pub fn dimensions(&self) -> (usize, usize) {
        match self {
            ManuscriptPaperRule::Genko20x20 => (20, 20),
            ManuscriptPaperRule::Genko40x40 => (40, 40),
            ManuscriptPaperRule::Custom { chars_per_line, lines_per_page } => (*chars_per_line, *lines_per_page),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ManuscriptMetrics {
    pub total_chars: usize,
    pub chars_without_whitespace: usize,
    pub total_lines: usize,
    pub genko_20x20_pages: f64,
    pub genko_40x40_pages: f64,
    pub estimated_reading_time_min: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LintSeverity {
    Info,
    Warning,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LintIssue {
    pub id: String,
    pub line: usize,
    pub column: usize,
    pub message: String,
    pub suggestion: Option<String>,
    pub severity: LintSeverity,
    pub matched_text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LintConfig {
    pub check_indent: bool,
    pub check_ellipsis: bool,
    pub check_dash: bool,
    pub check_closing_quote_punct: bool,
    pub check_exclamation_space: bool,
    pub check_duplicate_punctuation: bool,
}

impl LintConfig {
    pub fn all_enabled() -> Self {
        Self {
            check_indent: true,
            check_ellipsis: true,
            check_dash: true,
            check_closing_quote_punct: true,
            check_exclamation_space: true,
            check_duplicate_punctuation: true,
        }
    }
}

/// Calculate page conversion and statistics for Japanese novel manuscripts
pub fn calculate_metrics(text: &str) -> ManuscriptMetrics {
    let mut total_chars = 0;
    let mut chars_without_whitespace = 0;
    let mut lines_count = 0;
    let mut consumed_lines_20 = 0;
    let mut consumed_lines_40 = 0;

    for raw_line in text.lines() {
        lines_count += 1;
        let line_chars = raw_line.chars().count();
        total_chars += line_chars;
        chars_without_whitespace += raw_line.chars().filter(|c| !c.is_whitespace()).count();

        if line_chars == 0 {
            consumed_lines_20 += 1;
            consumed_lines_40 += 1;
        } else {
            // Lines consumed on 20-char grid
            let l20 = (line_chars + 19) / 20;
            consumed_lines_20 += l20.max(1);

            // Lines consumed on 40-char grid
            let l40 = (line_chars + 39) / 40;
            consumed_lines_40 += l40.max(1);
        }
    }

    if text.is_empty() {
        lines_count = 0;
    }

    let genko_20x20_pages = if consumed_lines_20 == 0 {
        0.0
    } else {
        (consumed_lines_20 as f64) / 20.0
    };

    let genko_40x40_pages = if consumed_lines_40 == 0 {
        0.0
    } else {
        (consumed_lines_40 as f64) / 40.0
    };

    // Average reading speed: 600 Japanese characters per minute
    let estimated_reading_time_min = (chars_without_whitespace as f64 / 600.0 * 10.0).round() / 10.0;

    ManuscriptMetrics {
        total_chars,
        chars_without_whitespace,
        total_lines: lines_count,
        genko_20x20_pages: (genko_20x20_pages * 100.0).round() / 100.0,
        genko_40x40_pages: (genko_40x40_pages * 100.0).round() / 100.0,
        estimated_reading_time_min,
    }
}

/// Ultra-fast Japanese typography linter
pub fn lint_japanese_text(text: &str, config: Option<&LintConfig>) -> Vec<LintIssue> {
    let default_cfg = LintConfig::all_enabled();
    let cfg = config.unwrap_or(&default_cfg);
    let mut issues = Vec::new();

    for (line_idx, line) in text.lines().enumerate() {
        let line_num = line_idx + 1;
        let trimmed_line = line.trim();

        if trimmed_line.is_empty() {
            continue;
        }

        let char_entries: Vec<(usize, char)> = line.char_indices().collect();
        if char_entries.is_empty() {
            continue;
        }

        // 1. Check line indentation (starts with fullwidth space unless dialogue or markdown syntax)
        if cfg.check_indent {
            let (_, first_char) = char_entries[0];
            let is_dialogue_or_special = matches!(
                first_char,
                '「' | '『' | '【' | '（' | '(' | '［' | '[' | '〈' | '《' | '―' | '─' | '…' | '#' | '*' | '-' | '>'
            );

            if !is_dialogue_or_special && first_char != '　' {
                // If it starts with half-width space or no space
                issues.push(LintIssue {
                    id: "indent_missing".to_string(),
                    line: line_num,
                    column: 1,
                    message: "段落の先頭は全角空白で字下げするのが原則です".to_string(),
                    suggestion: Some(format!("　{}", line)),
                    severity: LintSeverity::Warning,
                    matched_text: first_char.to_string(),
                });
            }
        }

        // 2. Check odd ellipses (…… is standard in Japanese novels)
        if cfg.check_ellipsis {
            check_repeated_char_parity(line, line_num, '…', 2, "三点リーダーは偶数個（……）で重ねるのが原則です", "odd_ellipsis", &mut issues);
        }

        // 3. Check odd dashes (―― is standard in Japanese novels)
        if cfg.check_dash {
            check_repeated_char_parity(line, line_num, '―', 2, "ダッシュは偶数個（――）で重ねるのが原則です", "odd_dash", &mut issues);
            check_repeated_char_parity(line, line_num, '—', 2, "ダッシュは偶数個（――）で重ねるのが原則です", "odd_dash", &mut issues);
        }

        // 4. Check punctuation before closing quote (e.g., 「〜〜。」)
        if cfg.check_closing_quote_punct {
            for i in 1..char_entries.len() {
                let (curr_byte, curr_ch) = char_entries[i];
                let (prev_byte, prev_ch) = char_entries[i - 1];

                if (curr_ch == '」' || curr_ch == '』') && (prev_ch == '。') {
                    let suggestion = format!("{}{}", &line[..prev_byte], &line[curr_byte..]);
                    issues.push(LintIssue {
                        id: "punct_before_closing_quote".to_string(),
                        line: line_num,
                        column: i,
                        message: "閉じ括弧の直前の句点（。）は不要です".to_string(),
                        suggestion: Some(suggestion),
                        severity: LintSeverity::Info,
                        matched_text: format!("{}{}", prev_ch, curr_ch),
                    });
                }
            }
        }

        // 5. Check exclamation/question mark followed by space (unless right before closing quote)
        if cfg.check_exclamation_space {
            for i in 0..char_entries.len() {
                let (_, curr_ch) = char_entries[i];
                let is_exclamation = matches!(curr_ch, '！' | '？' | '!' | '?');
                if is_exclamation && i + 1 < char_entries.len() {
                    let (_, next_ch) = char_entries[i + 1];
                    let is_closing = matches!(next_ch, '」' | '』' | '）' | ')' | '”' | '\"' | '　' | ' ' | '！' | '？' | '!' | '?');
                    if !is_closing {
                        issues.push(LintIssue {
                            id: "space_missing_after_exclamation".to_string(),
                            line: line_num,
                            column: i + 1,
                            message: "感嘆符・疑問符の直後には全角空白を空けるのが標準的です".to_string(),
                            suggestion: Some(format!("{}　{}", curr_ch, next_ch)),
                            severity: LintSeverity::Info,
                            matched_text: format!("{}{}", curr_ch, next_ch),
                        });
                    }
                }
            }
        }

        // 6. Duplicate punctuation (、、 or 。。)
        if cfg.check_duplicate_punctuation {
            for i in 1..char_entries.len() {
                let (_, curr_ch) = char_entries[i];
                let (_, prev_ch) = char_entries[i - 1];
                if (curr_ch == '、' && prev_ch == '、') || (curr_ch == '。' && prev_ch == '。') {
                    issues.push(LintIssue {
                        id: "duplicate_punctuation".to_string(),
                        line: line_num,
                        column: i,
                        message: "句読点が連続しています".to_string(),
                        suggestion: Some(curr_ch.to_string()),
                        severity: LintSeverity::Warning,
                        matched_text: format!("{}{}", prev_ch, curr_ch),
                    });
                }
            }
        }
    }

    issues
}

fn check_repeated_char_parity(
    line: &str,
    line_num: usize,
    target: char,
    unit: usize,
    message: &str,
    rule_id: &str,
    issues: &mut Vec<LintIssue>,
) {
    let mut count = 0;
    let mut start_col = 0;

    for (idx, ch) in line.chars().enumerate() {
        if ch == target {
            if count == 0 {
                start_col = idx + 1;
            }
            count += 1;
        } else {
            if count > 0 && count % unit != 0 {
                issues.push(LintIssue {
                    id: rule_id.to_string(),
                    line: line_num,
                    column: start_col,
                    message: message.to_string(),
                    suggestion: Some(target.to_string().repeat(count + 1)),
                    severity: LintSeverity::Warning,
                    matched_text: target.to_string().repeat(count),
                });
            }
            count = 0;
        }
    }

    if count > 0 && count % unit != 0 {
        issues.push(LintIssue {
            id: rule_id.to_string(),
            line: line_num,
            column: start_col,
            message: message.to_string(),
            suggestion: Some(target.to_string().repeat(count + 1)),
            severity: LintSeverity::Warning,
            matched_text: target.to_string().repeat(count),
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_metrics() {
        let text = "　第１行のテキストです。\n　第２行のテキストです。\n\n「台詞です」";
        let metrics = calculate_metrics(text);
        assert_eq!(metrics.total_lines, 4);
        assert!(metrics.genko_20x20_pages > 0.1);
        assert!(metrics.total_chars > 20);
        assert!(metrics.chars_without_whitespace > 15);
    }

    #[test]
    fn test_lint_indent_missing() {
        let text = "字下げのない行です。\n　字下げのある行です。\n「台詞は字下げ不要」";
        let issues = lint_japanese_text(text, None);
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].id, "indent_missing");
        assert_eq!(issues[0].line, 1);
    }

    #[test]
    fn test_lint_odd_ellipsis() {
        let text = "　これは奇数の…リーダー。\n　これは偶数の……リーダー。";
        let issues = lint_japanese_text(text, None);
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].id, "odd_ellipsis");
        assert_eq!(issues[0].line, 1);
    }

    #[test]
    fn test_lint_punct_before_closing_quote() {
        let text = "「さようなら。」\n「こんにちは」";
        let issues = lint_japanese_text(text, None);
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].id, "punct_before_closing_quote");
        assert_eq!(issues[0].line, 1);
        assert_eq!(issues[0].suggestion.as_deref(), Some("「さようなら」"));
    }

    #[test]
    fn test_lint_exclamation_space() {
        let text = "「なんだって！？」\n　本当に！？そんなはずは……";
        let issues = lint_japanese_text(text, None);
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].id, "space_missing_after_exclamation");
        assert_eq!(issues[0].line, 2);
    }
}
