import { useState } from 'react';
import { useVaultStore } from '../../store';
import { FileNode } from '../../lib/tauri-commands';
import {
  Folder,
  FolderOpen,
  FileText,
  GitBranch,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FolderUp,
} from 'lucide-react';

export function Sidebar() {
  const {
    vaultPath,
    files,
    activeFilePath,
    gitStatus,
    isLoading,
    setVaultPath,
    refreshFiles,
    refreshGitStatus,
    selectFile,
    commitCurrentVault,
  } = useVaultStore();

  const [commitMessage, setCommitMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [isCustomPathOpen, setIsCustomPathOpen] = useState(false);
  const [inputVaultPath, setInputVaultPath] = useState('');

  const handleOpenPath = () => {
    if (inputVaultPath.trim()) {
      setVaultPath(inputVaultPath.trim());
      setIsCustomPathOpen(false);
    }
  };

  const handleQuickCommit = async () => {
    if (!commitMessage.trim()) return;
    setIsCommitting(true);
    await commitCurrentVault(commitMessage.trim());
    setCommitMessage('');
    setIsCommitting(false);
  };

  const renderStatusBadge = (status?: string) => {
    if (!status) return null;
    const s = status.toLowerCase();
    if (s.includes('ready')) {
      return (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-950/80 text-sky-400 border border-sky-800/40">
          Ready
        </span>
      );
    }
    if (s.includes('reviewed')) {
      return (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/40">
          Reviewed
        </span>
      );
    }
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700">
        Draft
      </span>
    );
  };

  const renderTree = (nodes: FileNode[], depth = 0) => {
    return (
      <div className="flex flex-col space-y-0.5" style={{ paddingLeft: depth ? depth * 12 : 0 }}>
        {nodes.map((node) => {
          if (node.is_dir) {
            return (
              <div key={node.path} className="py-1">
                <div className="flex items-center text-xs text-neutral-400 font-medium px-2 py-1 rounded hover:bg-neutral-800/50 cursor-pointer">
                  <FolderOpen className="w-3.5 h-3.5 mr-1.5 text-neutral-400" />
                  <span className="truncate">{node.name}</span>
                </div>
                {node.children && renderTree(node.children, depth + 1)}
              </div>
            );
          }

          const isActive = activeFilePath === node.path;

          return (
            <div
              key={node.path}
              onClick={() => selectFile(node.path)}
              className={`group flex items-center justify-between px-2 py-1.5 rounded text-xs cursor-pointer transition-colors ${
                isActive
                  ? 'bg-sky-950/60 text-sky-200 border-l-2 border-sky-400'
                  : 'text-neutral-300 hover:bg-neutral-800/40 hover:text-white'
              }`}
            >
              <div className="flex items-center truncate mr-2">
                <FileText className={`w-3.5 h-3.5 mr-1.5 shrink-0 ${isActive ? 'text-sky-400' : 'text-neutral-500'}`} />
                <span className="truncate">{node.name}</span>
              </div>
              <div className="shrink-0">{renderStatusBadge(node.status)}</div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <aside className="w-72 h-full bg-[#161b22] border-r border-[#30363d] flex flex-col select-none">
      {/* Vault Header */}
      <div className="p-3 border-b border-[#30363d] flex items-center justify-between">
        <div className="flex items-center truncate">
          <Folder className="w-4 h-4 mr-2 text-sky-400 shrink-0" />
          <div className="truncate">
            <h2 className="text-xs font-semibold text-neutral-200 truncate">
              {vaultPath ? vaultPath.split('/').pop() : 'No Vault Selected'}
            </h2>
            <p className="text-[10px] text-neutral-500 truncate">{vaultPath || 'Choose local folder'}</p>
          </div>
        </div>
        <button
          onClick={() => setIsCustomPathOpen(!isCustomPathOpen)}
          title="Open Vault"
          className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
        >
          <FolderUp className="w-4 h-4" />
        </button>
      </div>

      {/* Path Input dropdown */}
      {isCustomPathOpen && (
        <div className="p-3 bg-neutral-900 border-b border-[#30363d] flex flex-col gap-2">
          <label className="text-[11px] text-neutral-400">Vault Folder Path:</label>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={inputVaultPath}
              onChange={(e) => setInputVaultPath(e.target.value)}
              placeholder="/Users/.../MyNovel"
              className="flex-1 bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 focus:outline-none focus:border-sky-500"
            />
            <button
              onClick={handleOpenPath}
              className="bg-sky-600 hover:bg-sky-500 text-white text-xs px-2.5 py-1 rounded font-medium"
            >
              Open
            </button>
          </div>
        </div>
      )}

      {/* File Tree Area */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="flex items-center justify-between px-2 py-1 mb-1">
          <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Vault Files</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                refreshFiles();
                refreshGitStatus();
              }}
              title="Refresh Vault"
              className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-xs text-neutral-500 p-4 text-center">Loading files...</div>
        ) : files.length === 0 ? (
          <div className="text-xs text-neutral-500 p-4 text-center">
            {vaultPath ? 'No novel files found (*.md, *.txt)' : 'Open a folder to start'}
          </div>
        ) : (
          renderTree(files)
        )}
      </div>

      {/* Git Status & Invisible Commit Panel */}
      <div className="p-3 border-t border-[#30363d] bg-neutral-900/60">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center text-xs text-neutral-300">
            <GitBranch className="w-3.5 h-3.5 mr-1.5 text-sky-400" />
            <span className="font-mono text-[11px]">{gitStatus?.current_branch || 'main'}</span>
          </div>
          {gitStatus?.is_clean ? (
            <span className="flex items-center text-[10px] text-emerald-400">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Clean
            </span>
          ) : (
            <span className="flex items-center text-[10px] text-amber-400">
              <AlertCircle className="w-3 h-3 mr-1" />
              {gitStatus?.modified_files.length || 0} modified
            </span>
          )}
        </div>

        {!gitStatus?.is_clean && (
          <div className="flex gap-1.5 mt-2">
            <input
              type="text"
              placeholder="Commit note..."
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              className="flex-1 bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 focus:outline-none focus:border-sky-500"
            />
            <button
              onClick={handleQuickCommit}
              disabled={isCommitting || !commitMessage.trim()}
              className="bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-neutral-200 text-xs px-2.5 py-1 rounded font-medium shrink-0"
            >
              Commit
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
