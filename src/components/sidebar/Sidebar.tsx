import { useState } from 'react';
import { useVaultStore, useEditorStore, useSyncStore } from '../../store';
import { FileNode } from '../../lib/tauri-commands';
import {
  BookMarked,
  FolderOpen,
  Plus,
  RefreshCw,
  FolderUp,
  Cloud,
  BookmarkCheck,
  Sparkles,
  Trash2,
  ChevronUp,
  ChevronDown,
  GripVertical,
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
    reorderEpisodesList,
    removeEpisode,
    snapshotCurrentState,
  } = useVaultStore();

  const { theme } = useEditorStore();
  const { status: syncStatus, triggerSync, isLoading: isSyncing } = useSyncStore();

  const [isAddingEpisode, setIsAddingEpisode] = useState(false);
  const [newEpisodeTitle, setNewEpisodeTitle] = useState('');
  const [isCustomPathOpen, setIsCustomPathOpen] = useState(false);
  const [inputVaultPath, setInputVaultPath] = useState('');
  const [draggedPath, setDraggedPath] = useState<string | null>(null);

  const isSepia = theme === 'cream-sepia';

  const handleOpenPath = () => {
    if (inputVaultPath.trim()) {
      setVaultPath(inputVaultPath.trim());
      setIsCustomPathOpen(false);
    }
  };

  const handleCreateEpisode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanTitle = newEpisodeTitle.trim() || `第0${files.filter((f) => !f.is_dir).length + 1}話`;
    await addEpisode(cleanTitle);
    setNewEpisodeTitle('');
    setIsAddingEpisode(false);
  };

  const handleDelete = async (e: React.MouseEvent, node: FileNode) => {
    e.stopPropagation();
    const cleanName = node.name.replace(/\.md$|\.txt$/, '');
    if (window.confirm(`エピソード『${cleanName}』をゴミ箱に移動しますか？\n（.novelstudio/trash/ へ安全退避されます）`)) {
      await removeEpisode(node.path);
    }
  };

  // Move item up / down
  const handleMove = async (e: React.MouseEvent, index: number, direction: 'up' | 'down') => {
    e.stopPropagation();
    const fileOnlyNodes = files.filter((f) => !f.is_dir);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= fileOnlyNodes.length) return;

    const newOrder = [...fileOnlyNodes];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(targetIndex, 0, moved);

    const orderedPaths = newOrder.map((f) => f.path);
    await reorderEpisodesList(orderedPaths);
  };

  // Drag and Drop reordering
  const handleDragStart = (path: string) => {
    setDraggedPath(path);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetPath: string) => {
    e.preventDefault();
    if (!draggedPath || draggedPath === targetPath) {
      setDraggedPath(null);
      return;
    }

    const fileOnlyNodes = files.filter((f) => !f.is_dir);
    const fromIndex = fileOnlyNodes.findIndex((f) => f.path === draggedPath);
    const toIndex = fileOnlyNodes.findIndex((f) => f.path === targetPath);

    if (fromIndex !== -1 && toIndex !== -1) {
      const newOrder = [...fileOnlyNodes];
      const [moved] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, moved);
      const orderedPaths = newOrder.map((f) => f.path);
      await reorderEpisodesList(orderedPaths);
    }
    setDraggedPath(null);
  };

  const renderStatusBadge = (status?: string) => {
    if (!status) return null;
    const s = status.toLowerCase();
    if (s.includes('ready')) {
      return (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-0.5">
          <span>👀</span> 推敲
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
      <div className="flex flex-col space-y-1.5" style={{ paddingLeft: depth ? depth * 12 : 0 }}>
        {nodes.map((node, index) => {
          if (node.is_dir) {
            return (
              <div key={node.path} className="py-1">
                <div
                  className={`flex items-center text-xs font-medium px-2 py-1 rounded transition-colors ${
                    isSepia ? 'text-amber-900/70 hover:bg-amber-100/60' : 'text-neutral-400 hover:bg-neutral-800/40'
                  }`}
                >
                  <FolderOpen className="w-3.5 h-3.5 mr-1.5 opacity-60" />
                  <span className="truncate">{node.name}</span>
                </div>
                {node.children && renderTree(node.children, depth + 1)}
              </div>
            );
          }

          const isActive = activeFilePath === node.path;
          const isFirst = index === 0;
          const isLast = index === nodes.length - 1;

          return (
            <div
              key={node.path}
              draggable
              onDragStart={() => handleDragStart(node.path)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, node.path)}
              onClick={() => selectFile(node.path)}
              className={`group flex items-center justify-between px-2 py-2 rounded-xl text-xs cursor-pointer transition-all border ${
                draggedPath === node.path ? 'opacity-40 border-dashed border-amber-500' : ''
              } ${
                isActive
                  ? isSepia
                    ? 'bg-amber-100/90 text-amber-950 font-medium shadow-xs border-amber-300'
                    : 'bg-[#282624] text-amber-200 font-medium shadow-xs border-amber-500/40'
                  : isSepia
                  ? 'bg-white/60 border-amber-900/5 text-neutral-700 hover:bg-amber-50 hover:border-amber-200'
                  : 'bg-[#201f1d]/60 border-[#2d2c29] text-neutral-300 hover:bg-[#252422] hover:border-[#3d3b37]'
              }`}
            >
              {/* Left drag handle and title */}
              <div className="flex items-center truncate mr-1.5 flex-1">
                <GripVertical className="w-3 h-3 mr-1 opacity-20 group-hover:opacity-70 transition-opacity shrink-0 cursor-grab" />
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-black/5 dark:bg-white/5 opacity-60 mr-1.5 shrink-0">
                  {`第${index + 1}話`}
                </span>
                <span className="truncate font-medium">{node.name.replace(/\.md$|\.txt$/, '')}</span>
              </div>

              {/* Right tools: Status badge, Up/Down reorder, Delete */}
              <div className="flex items-center gap-1 shrink-0">
                <div className="group-hover:hidden transition-all">{renderStatusBadge(node.status)}</div>

                <div className="hidden group-hover:flex items-center gap-0.5">
                  <button
                    onClick={(e) => handleMove(e, index, 'up')}
                    disabled={isFirst}
                    className="p-1 rounded hover:bg-amber-500/20 disabled:opacity-20 transition-all"
                    title="上へ移動"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => handleMove(e, index, 'down')}
                    disabled={isLast}
                    className="p-1 rounded hover:bg-amber-500/20 disabled:opacity-20 transition-all"
                    title="下へ移動"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, node)}
                    className="p-1 rounded text-red-500 hover:bg-red-500/15 transition-all"
                    title="ゴミ箱へ移動（安全削除）"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
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
      <div
        className={`p-3.5 border-b flex items-center justify-between ${
          isSepia ? 'border-amber-900/10 bg-amber-50/50' : 'border-[#2c2a27] bg-[#1c1b19]'
        }`}
      >
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
        <div
          className={`p-3 border-b flex flex-col gap-2 ${
            isSepia ? 'bg-amber-100/50 border-amber-900/10' : 'bg-[#1c1b19] border-[#2c2a27]'
          }`}
        >
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
                placeholder="エピソード名（空欄で連番作成）"
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
              className={`w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition-all ${
                isSepia
                  ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
                  : 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>＋ 新しいエピソードを追加</span>
            </button>
          )}
        </div>
      )}

      {/* Episodes List with Reorder and D&D */}
      <div className="flex-1 overflow-y-auto p-3 pt-2">
        <div className="flex items-center justify-between px-1 py-1 mb-1">
          <span className="text-[11px] font-bold tracking-wider opacity-50 uppercase">
            エピソード一覧（並び替え可能）
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
            {vaultPath
              ? 'エピソードがまだありません。\n上の「＋」から書き始めましょう。'
              : '本棚を開くとエピソードがここに並びます。'}
          </div>
        ) : (
          renderTree(files)
        )}
      </div>

      {/* Zero-Touch Cloud Sync & Snapshot Panel */}
      <div
        className={`p-3 border-t space-y-2 ${
          isSepia ? 'border-amber-900/10 bg-amber-50/70' : 'border-[#2c2a27] bg-[#141412]'
        }`}
      >
        {/* Cloud Sync Status Badge */}
        <div
          onClick={() => vaultPath && triggerSync(vaultPath, '手動確認同期')}
          title="クリックでクラウド・バックアップを今すぐ確認同期"
          className={`flex items-center justify-between p-2 rounded-xl border text-[11px] cursor-pointer transition-all ${
            isSepia
              ? 'bg-white hover:bg-amber-100/60 border-amber-200/70 text-neutral-700 shadow-2xs'
              : 'bg-[#1e1d1b] hover:bg-[#252421] border-[#33312d] text-neutral-300'
          }`}
        >
          <div className="flex items-center gap-1.5 truncate">
            <Cloud
              className={`w-3.5 h-3.5 shrink-0 ${
                isSyncing ? 'text-amber-500 animate-spin' : 'text-emerald-500'
              }`}
            />
            <span className="truncate font-medium">
              {syncStatus?.message || '☁️ 全自動クラウド同期：完了'}
            </span>
          </div>
          <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
            自動
          </span>
        </div>

        {/* Snapshot trigger */}
        <button
          onClick={snapshotCurrentState}
          className={`w-full py-1.5 px-2.5 rounded-xl text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all ${
            isSnapshotSaved
              ? 'bg-emerald-600 text-white'
              : isSepia
              ? 'bg-white hover:bg-amber-100 border border-amber-200 text-amber-950 shadow-2xs'
              : 'bg-[#22211f] hover:bg-[#2c2a27] border border-[#35332f] text-neutral-300'
          }`}
        >
          {isSnapshotSaved ? (
            <>
              <Sparkles className="w-3 h-3" />
              <span>✨ 記念保存完了</span>
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
