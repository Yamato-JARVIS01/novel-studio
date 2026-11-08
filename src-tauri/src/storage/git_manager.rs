use git2::{DiffOptions, IndexAddOption, Repository, Signature};
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::path::Path;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum GitError {
    #[error("Git2 error: {0}")]
    Git2(#[from] git2::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Repository not found at: {0}")]
    NotFound(String),
    #[error("Shadow branch error: {0}")]
    BranchError(String),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum DiffLineType {
    Context,
    Addition,
    Deletion,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DiffLine {
    pub line_type: DiffLineType,
    pub old_lineno: Option<u32>,
    pub new_lineno: Option<u32>,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DiffHunk {
    pub header: String,
    pub old_start: u32,
    pub old_lines: u32,
    pub new_start: u32,
    pub new_lines: u32,
    pub lines: Vec<DiffLine>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DiffFile {
    pub old_path: Option<String>,
    pub new_path: Option<String>,
    pub hunks: Vec<DiffHunk>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitStatusInfo {
    pub current_branch: String,
    pub is_clean: bool,
    pub modified_files: Vec<String>,
    pub untracked_files: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitHistoryItem {
    pub commit_id: String,
    pub message: String,
    pub author: String,
    pub timestamp: i64,
    pub date_str: String,
    pub content: Option<String>,
}

pub struct GitManager;

impl GitManager {
    /// Initialize a git repository at the given path if not present
    pub fn init_or_open(path: &Path) -> Result<Repository, GitError> {
        if path.join(".git").exists() {
            Ok(Repository::open(path)?)
        } else {
            let repo = Repository::init(path)?;
            // Make an initial commit if empty
            if repo.head().is_err() {
                let sig = Signature::now("NovelStudio", "support@novelstudio.app")?;
                let mut index = repo.index()?;
                let tree_id = index.write_tree()?;
                let tree = repo.find_tree(tree_id)?;
                repo.commit(Some("HEAD"), &sig, &sig, "Initial commit by NovelStudio", &tree, &[])?;
            }
            Ok(repo)
        }
    }

    /// Check working directory git status
    pub fn get_status(repo: &Repository) -> Result<GitStatusInfo, GitError> {
        let head = repo.head().ok();
        let current_branch = head
            .as_ref()
            .and_then(|h| h.shorthand())
            .unwrap_or("main")
            .to_string();

        let statuses = repo.statuses(None)?;
        let mut modified_files = Vec::new();
        let mut untracked_files = Vec::new();

        for entry in statuses.iter() {
            let status = entry.status();
            let path = entry.path().unwrap_or("").to_string();
            if status.is_wt_modified() || status.is_index_modified() {
                modified_files.push(path);
            } else if status.is_wt_new() {
                untracked_files.push(path);
            }
        }

        let is_clean = modified_files.is_empty() && untracked_files.is_empty();

        Ok(GitStatusInfo {
            current_branch,
            is_clean,
            modified_files,
            untracked_files,
        })
    }

    /// Stage all changes and create a commit
    pub fn auto_commit(repo: &Repository, message: &str) -> Result<String, GitError> {
        let mut index = repo.index()?;
        index.add_all(["*"].iter(), IndexAddOption::DEFAULT, None)?;
        index.write()?;

        let tree_id = index.write_tree()?;
        let tree = repo.find_tree(tree_id)?;

        let sig = Signature::now("NovelStudio Author", "author@novelstudio.local")?;

        let parent_commit = match repo.head() {
            Ok(head_ref) => Some(head_ref.peel_to_commit()?),
            Err(_) => None,
        };

        let parents = match &parent_commit {
            Some(c) => vec![c],
            None => vec![],
        };

        let commit_oid = repo.commit(
            Some("HEAD"),
            &sig,
            &sig,
            message,
            &tree,
            &parents,
        )?;

        Ok(commit_oid.to_string())
    }

    /// Create a shadow branch for AI suggestions (e.g. `novel-studio/ai-revision-timestamp`)
    pub fn create_shadow_branch(repo: &Repository, branch_name: &str) -> Result<(), GitError> {
        let head_commit = repo.head()?.peel_to_commit()?;
        repo.branch(branch_name, &head_commit, true)?;
        Ok(())
    }

    /// Extract diff between current working tree / commit and shadow branch
    pub fn get_diff_against_branch(repo: &Repository, branch_name: &str) -> Result<Vec<DiffFile>, GitError> {
        let branch = repo.find_branch(branch_name, git2::BranchType::Local)?;
        let branch_commit = branch.get().peel_to_commit()?;
        let branch_tree = branch_commit.tree()?;

        let mut diff_opts = DiffOptions::new();
        diff_opts.context_lines(3);

        let head_tree = repo.head()?.peel_to_commit()?.tree()?;
        let diff = repo.diff_tree_to_tree(Some(&head_tree), Some(&branch_tree), Some(&mut diff_opts))?;

        let result_files = RefCell::new(Vec::new());

        diff.foreach(
            &mut |delta, _progress| {
                result_files.borrow_mut().push(DiffFile {
                    old_path: delta.old_file().path().map(|p| p.to_string_lossy().to_string()),
                    new_path: delta.new_file().path().map(|p| p.to_string_lossy().to_string()),
                    hunks: Vec::new(),
                });
                true
            },
            None,
            Some(&mut |_delta, hunk| {
                let mut files = result_files.borrow_mut();
                if let Some(file) = files.last_mut() {
                    let header = String::from_utf8_lossy(hunk.header()).to_string();
                    file.hunks.push(DiffHunk {
                        header,
                        old_start: hunk.old_start(),
                        old_lines: hunk.old_lines(),
                        new_start: hunk.new_start(),
                        new_lines: hunk.new_lines(),
                        lines: Vec::new(),
                    });
                }
                true
            }),
            Some(&mut |_delta, _hunk, line| {
                let mut files = result_files.borrow_mut();
                if let Some(file) = files.last_mut() {
                    if let Some(current_hunk) = file.hunks.last_mut() {
                        let line_type = match line.origin() {
                            '+' => DiffLineType::Addition,
                            '-' => DiffLineType::Deletion,
                            _ => DiffLineType::Context,
                        };
                        let content = String::from_utf8_lossy(line.content()).to_string();
                        current_hunk.lines.push(DiffLine {
                            line_type,
                            old_lineno: line.old_lineno(),
                            new_lineno: line.new_lineno(),
                            content,
                        });
                    }
                }
                true
            }),
        )?;

        Ok(result_files.into_inner())
    }

    /// Merge shadow branch into main (accept AI proposal)
    pub fn apply_shadow_branch(repo: &Repository, branch_name: &str) -> Result<(), GitError> {
        let branch = repo.find_branch(branch_name, git2::BranchType::Local)?;
        let branch_commit = branch.get().peel_to_commit()?;
        let branch_tree = branch_commit.tree()?;

        // Fast checkout tree into workdir
        repo.checkout_tree(branch_commit.as_object(), None)?;

        // Commit merge
        let sig = Signature::now("NovelStudio AI Merge", "ai@novelstudio.local")?;
        let head_commit = repo.head()?.peel_to_commit()?;

        repo.commit(
            Some("HEAD"),
            &sig,
            &sig,
            &format!("Apply AI Revision from {}", branch_name),
            &branch_tree,
            &[&head_commit, &branch_commit],
        )?;

        // Delete the shadow branch
        let mut b = branch;
        b.delete()?;

        Ok(())
    }

    /// Discard shadow branch (reject AI proposal)
    pub fn discard_shadow_branch(repo: &Repository, branch_name: &str) -> Result<(), GitError> {
        let mut branch = repo.find_branch(branch_name, git2::BranchType::Local)?;
        branch.delete()?;
        Ok(())
    }

    /// Retrieve commit history and file contents for writing time machine
    pub fn get_file_history(repo: &Repository, relative_path: &str) -> Result<Vec<CommitHistoryItem>, GitError> {
        let mut revwalk = repo.revwalk()?;
        if revwalk.push_head().is_err() {
            return Ok(Vec::new());
        }
        revwalk.set_sorting(git2::Sort::TIME)?;

        let mut history = Vec::new();
        let norm_path = Path::new(relative_path);

        for oid in revwalk {
            let oid = match oid {
                Ok(id) => id,
                Err(_) => continue,
            };
            let commit = match repo.find_commit(oid) {
                Ok(c) => c,
                Err(_) => continue,
            };

            let tree = match commit.tree() {
                Ok(t) => t,
                Err(_) => continue,
            };

            if let Ok(entry) = tree.get_path(norm_path) {
                let blob = match repo.find_blob(entry.id()) {
                    Ok(b) => b,
                    Err(_) => continue,
                };
                let content = String::from_utf8_lossy(blob.content()).to_string();
                let time = commit.time();
                let dt = chrono::DateTime::from_timestamp(time.seconds(), 0)
                    .map(|t| t.format("%Y-%m-%d %H:%M").to_string())
                    .unwrap_or_else(|| "".to_string());

                history.push(CommitHistoryItem {
                    commit_id: oid.to_string(),
                    message: commit.summary().unwrap_or("").to_string(),
                    author: commit.author().name().unwrap_or("").to_string(),
                    timestamp: time.seconds(),
                    date_str: dt,
                    content: Some(content),
                });
                if history.len() >= 50 {
                    break;
                }
            }
        }

        Ok(history)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_git_init_commit_and_shadow_branch() {
        let dir = tempdir().unwrap();
        let repo_path = dir.path();

        // 1. Init
        let repo = GitManager::init_or_open(repo_path).unwrap();
        assert!(repo_path.join(".git").exists());

        // 2. Create file and commit
        let test_file = repo_path.join("chapter_01.md");
        fs::write(&test_file, "# 第一章\nこれはテスト原稿です。\n").unwrap();

        let commit_oid = GitManager::auto_commit(&repo, "feat: write chapter 1").unwrap();
        assert!(!commit_oid.is_empty());

        let status = GitManager::get_status(&repo).unwrap();
        assert!(status.is_clean);

        // 3. Create shadow branch
        let shadow_branch = "novel-studio/ai-revision-test";
        GitManager::create_shadow_branch(&repo, shadow_branch).unwrap();

        // Verify branch exists
        let branch = repo.find_branch(shadow_branch, git2::BranchType::Local);
        assert!(branch.is_ok());

        // 4. Discard shadow branch
        GitManager::discard_shadow_branch(&repo, shadow_branch).unwrap();
        let branch = repo.find_branch(shadow_branch, git2::BranchType::Local);
        assert!(branch.is_err());

        // 5. Test file history for Time Machine
        let history = GitManager::get_file_history(&repo, "chapter_01.md").unwrap();
        assert!(!history.is_empty());
        assert_eq!(history[0].message, "feat: write chapter 1");
        assert!(history[0].content.as_ref().unwrap().contains("第一章"));
    }
}
