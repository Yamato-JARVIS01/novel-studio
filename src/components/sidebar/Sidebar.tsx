import { useState } from 'react';
import { useVaultStore, useEditorStore } from '../../store';
import { FileNode } from '../../lib/tauri-commands';
import {
  BookMarked,
  FolderOpen,
  FileText,
  Plus,
  RefreshCw,
  FolderUp,
  Cloud,
  BookmarkCheck,
  Sparkles,
} from 'lucide-react';

export function Sidebar() {
  const {
    vaultPath,
    files,
    activeFilePath,
    isLoading,
    isSnapshotSaved,
    setVaultPath,
    refreshFiles,
    selectFile,
    addEpisode,
    snapshotCurrentState,
  } = useVaultStore();

  const { theme } = useEditorStore();

  const [isAddingEpisode, setIsAddingEpisode] = useState(false);
  const [newEpisodeTitle, setNewEpisodeTitle] = useState('');
  const [isCustomPathOpen, setIsCustomPathOpen] = useState(false);
  const [inputVaultPath, setInputVaultPath] = useState('');

  const isSepia = theme === 'cream-sepia';

  const handleOpenPath = () => {
    if (inputVaultPath.trim()) {
      setVaultPath(inputVaultPath.trim());
      setIsCustomPathOpen(false);
    }
  };

  const handleCreateEpisode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newEpisodeTitle.trim()) {
      setIsAddingEpisode(false);
      return;
    }
    await addEpisode(newEpisodeTitle.trim());
    setNewEpisodeTitle('');
    setIsAddingEpisode(false);
  };

  const renderStatusBadge = (status?: string) => {
    if (!status) return null;
    const s = status.toLowerCase();
    if (s.includes('ready')) {
      return (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-0.5">
          <span>👀</span> 推敲待ち
        </span>
      );
    }
    if (s.includes('reviewed')) {
      return (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-0.5">
          <span>✅</span> 完成
        </span>
      );
    }
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-500/10 text-neutral-500 dark:text-neutral-400 border border-neutral-500/20 flex items-center gap-0.5">
        <span>✏️</span> 執筆中
      </span>
    );
  };

  const renderTree = (nodes: FileNode[], depth = 0) => {
    return (
      <div className="flex flex-col space-y-1" style={{ paddingLeft: depth ? depth * 12 : 0 }}>
        {nodes.map((node) => {
          if (node.is_dir) {
            return (
              <div key={node.path} className="py-1">
                <div className={`flex items-center text-xs font-medium px-2 py-1 rounded transition-colors ${
                  isSepia ? 'text-amber-900/70 hover:bg-amber-100/60' : 'text-neutral-400 hover:bg-neutral-800/40'
                }`}>
                  <FolderOpen className="w-3.5 h-3.5 mr-1.5 opacity-60" />
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
              className={`group flex items-center justify-between px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-all ${
                isActive
                  ? isSepia
                    ? 'bg-amber-100/90 text-amber-950 font-medium shadow-sm border-l-2 border-amber-600'
                    : 'bg-[#282624] text-amber-200 font-medium shadow-sm border-l-2 border-amber-400'
                  : isSepia
                  ? 'text-neutral-700 hover:bg-amber-50 hover:text-amber-950'
                  : 'text-neutral-300 hover:bg-[#201f1d] hover:text-neutral-100'
              }`}
            >
              <div className="flex items-center truncate mr-2">
                <FileText
                  className={`w-3.5 h-3.5 mr-2 shrink-0 ${
                    isActive ? (isSepia ? 'text-amber-700' : 'text-amber-400') : 'opacity-40'
                  }`}
                />
                <span className="truncate">{node.name.replace(/\.md$|\.txt$/, '')}</span>
              </div>
              <div className="shrink-0">{renderStatusBadge(node.status)}</div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <aside
      className={`w-72 h-full flex flex-col select-none transition-colors border-r ${
        isSepia
          ? 'bg-[#f6f2ea] border-amber-900/10 text-neutral-800'
          : 'bg-[#181816] border-[#2c2a27] text-neutral-200'
      }`}
    >
      {/* Bookshelf Header */}
      <div className={`p-3.5 border-b flex items-center justify-between ${
        isSepia ? 'border-amber-900/10 bg-amber-50/50' : 'border-[#2c2a27] bg-[#1c1b19]'
      }`}>
        <div className="flex items-center truncate mr-2">
          <BookMarked className="w-4 h-4 mr-2 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="truncate">
            <h2 className="text-xs font-bold tracking-wide truncate">
              {vaultPath ? vaultPath.split('/').pop() : '作品本棚（未選択）'}
            </h2>
            <p className="text-[10px] opacity-50 truncate">
              {vaultPath ? '原稿フォルダ' : '作品を開いて執筆を開始'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsCustomPathOpen(!isCustomPathOpen)}
          title="別の原稿フォルダを開く"
          className="p-1.5 rounded-lg opacity-60 hover:opacity-100 transition-opacity"
        >
          <FolderUp className="w-4 h-4" />
        </button>
      </div>

      {/* Path Input dropdown */}
      {isCustomPathOpen && (
        <div className={`p-3 border-b flex flex-col gap-2 ${
          isSepia ? 'bg-amber-100/50 border-amber-900/10' : 'bg-[#1c1b19] border-[#2c2a27]'
        }`}>
          <label className="text-[11px] font-medium opacity-70">原稿フォルダの場所（パス）:</label>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={inputVaultPath}
              onChange={(e) => setInputVaultPath(e.target.value)}
              placeholder="/Users/あなたの名前/小説原稿"
              className={`flex-1 border rounded-md px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                isSepia
                  ? 'bg-white border-amber-300 text-neutral-900'
                  : 'bg-black/40 border-neutral-700 text-neutral-100'
              }`}
            />
            <button
              onClick={handleOpenPath}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs px-3 py-1 rounded-md font-medium transition-colors"
            >
              開く
            </button>
          </div>
        </div>
      )}

      {/* New Episode Button */}
      {vaultPath && (
        <div className="p-3 pb-1">
          {isAddingEpisode ? (
            <form onSubmit={handleCreateEpisode} className="flex gap-1.5 items-center">
              <input
                type="text"
                autoFocus
                value={newEpisodeTitle}
                onChange={(e) => setNewEpisodeTitle(e.target.value)}
                placeholder="エピソード名（例: 第3話...）"
                className={`flex-1 border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                  isSepia
                    ? 'bg-white border-amber-300 text-neutral-900'
                    : 'bg-[#22211f] border-neutral-700 text-neutral-100'
                }`}
              />
              <button
                type="submit"
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs px-2.5 py-1.5 rounded-lg font-medium"
              >
                作成
              </button>
              <button
                type="button"
                onClick={() => setIsAddingEpisode(false)}
                className="text-xs opacity-60 hover:opacity-100 px-1 py-1"
              >
                ✕
              </button>
            </form>
          ) : (
            <button
              onClick={() => setIsAddingEpisode(true)}
              className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all ${
                isSepia
                  ? 'bg-amber-600/10 hover:bg-amber-600/20 text-amber-900 border border-amber-600/20'
                  : 'bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 border border-amber-400/20'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              新しいエピソードを追加
            </button>
          )}
        </div>
      )}

      {/* Episodes List */}
      <div className="flex-1 overflow-y-auto p-3 pt-2">
        <div className="flex items-center justify-between px-1 py-1 mb-1">
          <span className="text-[11px] font-bold tracking-wider opacity-50 uppercase">
            エピソード一覧
          </span>
          <button
            onClick={() => refreshFiles()}
            title="一覧を更新"
            className="p-1 rounded opacity-50 hover:opacity-100 transition-opacity"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>

        {isLoading ? (
          <div className="text-xs opacity-50 p-6 text-center">原稿を読み込んでいます...</div>
        ) : files.length === 0 ? (
          <div className="text-xs opacity-50 p-6 text-center leading-relaxed">
            {vaultPath ? 'エピソードがまだありません。\n上の「＋」から書き始めましょう。' : '本棚を開くとエピソードがここに並びます。'}
          </div>
        ) : (
          renderTree(files)
        )}
      </div>

      {/* Invisible Git / Cloud Backup Panel */}
      <div className={`p-3.5 border-t ${
        isSepia ? 'border-amber-900/10 bg-amber-50/70' : 'border-[#2c2a27] bg-[#141412]'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs">
            <Cloud className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
            <span className="text-[11px] font-medium opacity-80">自動バックアップ稼働中</span>
          </div>
          <span className="text-[10px] opacity-40">安心の多重保存</span>
        </div>

        <button
          onClick={snapshotCurrentState}
          className={`w-full py-1.5 px-2.5 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all ${
            isSnapshotSaved
              ? 'bg-emerald-600 text-white'
              : isSepia
              ? 'bg-white hover:bg-amber-100 border border-amber-200 text-amber-950 shadow-xs'
              : 'bg-[#22211f] hover:bg-[#2c2a27] border border-[#35332f] text-neutral-300'
          }`}
        >
          {isSnapshotSaved ? (
            <>
              <Sparkles className="w-3 h-3" />
              <span>✨ 記念保存（スナップショット）完了</span>
            </>
          ) : (
            <>
              <BookmarkCheck className="w-3 h-3 opacity-70" />
              <span>現在の状態を記念保存</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
