import { useState, useEffect } from 'react';
import { useVaultStore, useEditorStore } from '../../store';
import { NovelProjectItem } from '../../lib/tauri-commands';
import {
  X,
  BookOpen,
  Plus,
  Trash2,
  FolderOpen,
  Search,
  Sparkles,
  Clock,
  FileText,
  CheckCircle2,
  Bookmark,
  FolderInput,
  PenTool,
} from 'lucide-react';

interface BookShelfModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BookShelfModal({ isOpen, onClose }: BookShelfModalProps) {
  const {
    projects,
    vaultPath,
    isLoading,
    loadProjects,
    createProject,
    deleteProject,
    importProject,
    switchProject,
  } = useVaultStore();

  const { theme } = useEditorStore();
  const isSepia = theme === 'cream-sepia';

  const [searchQuery, setSearchQuery] = useState('');
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importPathInput, setImportPathInput] = useState('');

  // Wizard state
  const [newTitle, setNewTitle] = useState('');
  const [newSynopsis, setNewSynopsis] = useState('');
  const [targetPaper, setTargetPaper] = useState<'400' | '1600' | 'short'>('400');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadProjects();
    }
  }, [isOpen, loadProjects]);

  if (!isOpen) return null;

  const filteredProjects = projects.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      p.title.toLowerCase().includes(q) ||
      (p.synopsis && p.synopsis.toLowerCase().includes(q))
    );
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setIsSubmitting(true);
    try {
      const proj = await createProject(
        newTitle.trim(),
        newSynopsis.trim() || undefined,
        targetPaper
      );
      if (proj) {
        setNewTitle('');
        setNewSynopsis('');
        setTargetPaper('400');
        setIsWizardOpen(false);
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importPathInput.trim()) return;
    setIsSubmitting(true);
    try {
      const proj = await importProject(importPathInput.trim());
      if (proj) {
        setImportPathInput('');
        setIsImportOpen(false);
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, project: NovelProjectItem) => {
    e.stopPropagation();
    if (
      window.confirm(
        `小説『${project.title}』を作品本棚から削除しますか？\n（~/Documents/NovelStudio/.trash/ へ安全に退避されます）`
      )
    ) {
      await deleteProject(project.path);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 sm:p-6">
      <div
        className={`w-full max-w-4xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all ${
          isSepia
            ? 'bg-[#fbf9f5] border-amber-200 text-neutral-800'
            : 'bg-[#1a1917] border-[#363430] text-neutral-100'
        }`}
      >
        {/* Header */}
        <div
          className={`px-6 py-4.5 border-b flex items-center justify-between ${
            isSepia ? 'border-amber-200 bg-amber-50/70' : 'border-[#2d2b27] bg-[#161513]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-wide">📚 作品本棚マネージャー</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold">
                  マルチ作品管理
                </span>
              </div>
              <p className="text-[11px] opacity-60">
                標準書斎（~/Documents/NovelStudio/）にて全作品を自動管理中
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isWizardOpen && (
              <button
                onClick={() => setIsWizardOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-md transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>＋ 新しい小説を書き始める</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl opacity-60 hover:opacity-100 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Wizard Panel (Overlay or Expanded inside modal) */}
        {isWizardOpen && (
          <div
            className={`p-6 border-b transition-colors ${
              isSepia ? 'bg-amber-100/40 border-amber-200' : 'bg-[#201e1b] border-[#302e2a]'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <PenTool className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-bold">新しい小説の執筆ウィザード</h3>
              </div>
              <button
                onClick={() => setIsWizardOpen(false)}
                className="text-xs opacity-60 hover:opacity-100 transition-opacity"
              >
                キャンセル
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold opacity-80 flex items-center gap-1">
                    作品タイトル <span className="text-amber-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="例: 夜明けの羅生門 / 星巡る図書館"
                    className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                      isSepia
                        ? 'bg-white border-amber-300 text-neutral-900'
                        : 'bg-[#141311] border-[#3a3834] text-neutral-100'
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold opacity-80">目標規定・用紙フォーマット</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: '400', label: '400字詰 (20×20)', desc: '文芸・短編' },
                      { id: '1600', label: '公募 (40×40)', desc: '長編公募規定' },
                      { id: 'short', label: 'Web小説', desc: '自由形式' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setTargetPaper(opt.id as any)}
                        className={`p-2 rounded-xl border text-left transition-all ${
                          targetPaper === opt.id
                            ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                            : isSepia
                            ? 'bg-white border-amber-200 text-neutral-700 hover:bg-amber-50'
                            : 'bg-[#181715] border-[#383632] text-neutral-300 hover:bg-[#22211e]'
                        }`}
                      >
                        <div className="text-[11px] font-bold">{opt.label}</div>
                        <div
                          className={`text-[9px] ${
                            targetPaper === opt.id ? 'text-white/80' : 'opacity-50'
                          }`}
                        >
                          {opt.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold opacity-80">あらすじ・構想メモ（任意）</label>
                <textarea
                  rows={2}
                  value={newSynopsis}
                  onChange={(e) => setNewSynopsis(e.target.value)}
                  placeholder="作品のログラインや概要、世界観のメモを入力..."
                  className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                    isSepia
                      ? 'bg-white border-amber-300 text-neutral-900'
                      : 'bg-[#141311] border-[#3a3834] text-neutral-100'
                  }`}
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <p className="text-[10px] opacity-50">
                  ※ フォルダ作成・Git履歴・設定グラフ・第1話ファイルがすべて一瞬で自動準備されます
                </p>
                <button
                  type="submit"
                  disabled={isSubmitting || !newTitle.trim()}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white shadow-md transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? '作成中...' : '執筆を開始する'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Existing Folder Import Accordion */}
        {isImportOpen && (
          <div
            className={`p-4 border-b flex flex-col gap-2 ${
              isSepia ? 'bg-amber-50/90 border-amber-200' : 'bg-[#1f1e1b] border-[#302e2a]'
            }`}
          >
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold flex items-center gap-1.5">
                <FolderInput className="w-3.5 h-3.5 text-amber-500" />
                既存フォルダを作品本棚に追加
              </label>
              <button
                onClick={() => setIsImportOpen(false)}
                className="text-xs opacity-60 hover:opacity-100"
              >
                キャンセル
              </button>
            </div>
            <form onSubmit={handleImport} className="flex gap-2">
              <input
                type="text"
                value={importPathInput}
                onChange={(e) => setImportPathInput(e.target.value)}
                placeholder="/Users/名前/既存の小説フォルダへの絶対パス"
                className={`flex-1 border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                  isSepia
                    ? 'bg-white border-amber-300 text-neutral-900'
                    : 'bg-[#141311] border-[#3a3834] text-neutral-100'
                }`}
              />
              <button
                type="submit"
                disabled={isSubmitting || !importPathInput.trim()}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-neutral-700 hover:bg-neutral-600 text-white transition-all disabled:opacity-40"
              >
                追加する
              </button>
            </form>
          </div>
        )}

        {/* Filter & Import Bar */}
        <div
          className={`px-6 py-3 border-b flex items-center justify-between gap-4 text-xs ${
            isSepia ? 'border-amber-200/60 bg-white/40' : 'border-[#262522] bg-[#141311]/50'
          }`}
        >
          <div className="flex items-center gap-2 flex-1 max-w-sm relative">
            <Search className="w-3.5 h-3.5 absolute left-3 opacity-40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="作品名・あらすじで絞り込み..."
              className={`w-full pl-8 pr-3 py-1.5 rounded-xl border text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                isSepia
                  ? 'bg-white border-amber-200 text-neutral-900'
                  : 'bg-[#1b1a18] border-[#33312d] text-neutral-200'
              }`}
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isImportOpen && (
              <button
                onClick={() => setIsImportOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border opacity-70 hover:opacity-100 transition-all text-[11px]"
              >
                <FolderInput className="w-3 h-3 text-amber-500" />
                <span>既存フォルダをインポート</span>
              </button>
            )}
            <span className="text-[11px] opacity-50">{filteredProjects.length} 作品</span>
          </div>
        </div>

        {/* Book Cards Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading && projects.length === 0 ? (
            <div className="py-16 text-center text-xs opacity-50">本棚を読み込んでいます...</div>
          ) : filteredProjects.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto text-amber-500">
                <BookOpen className="w-6 h-6" />
              </div>
              <p className="text-xs font-medium opacity-70">
                該当する作品が見つかりませんでした。
              </p>
              <button
                onClick={() => setIsWizardOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-md transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>新しく小説を書き始める</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.map((project) => {
                const isActive = vaultPath === project.path;
                return (
                  <div
                    key={project.path}
                    onClick={() => {
                      switchProject(project.path);
                      onClose();
                    }}
                    className={`group relative rounded-2xl border p-4.5 transition-all duration-200 flex flex-col justify-between cursor-pointer shadow-xs hover:shadow-lg hover:-translate-y-0.5 ${
                      isActive
                        ? isSepia
                          ? 'bg-gradient-to-br from-amber-50 to-amber-100/70 border-amber-400 ring-2 ring-amber-400/40'
                          : 'bg-gradient-to-br from-[#272522] to-[#1f1e1b] border-amber-500/60 ring-2 ring-amber-500/30'
                        : isSepia
                        ? 'bg-white hover:bg-amber-50/50 border-amber-200/80 hover:border-amber-300'
                        : 'bg-[#1e1d1b] hover:bg-[#252421] border-[#35332f] hover:border-[#4d4a44]'
                    }`}
                  >
                    {/* Top Spine Stripe & Badges */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isActive && (
                            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white shadow-2xs">
                              <CheckCircle2 className="w-3 h-3" />
                              現在執筆中
                            </span>
                          )}
                          {project.is_sample && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-neutral-500/15 text-neutral-500 dark:text-neutral-400 border border-neutral-500/20">
                              サンプル短編
                            </span>
                          )}
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 opacity-60">
                            {project.target_paper === '1600'
                              ? '公募規定 (40×40)'
                              : project.target_paper === 'short'
                              ? 'Web小説'
                              : '400字詰'}
                          </span>
                        </div>

                        {/* Trash Button */}
                        <button
                          onClick={(e) => handleDelete(e, project)}
                          className="p-1 rounded-lg opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-red-500/15 text-red-500 transition-all"
                          title="作品をゴミ箱へ退避"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Novel Title */}
                      <h3 className="text-sm font-bold tracking-tight mb-1.5 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors line-clamp-2">
                        {project.title}
                      </h3>

                      {/* Synopsis Preview */}
                      <p className="text-[11px] opacity-65 line-clamp-2 leading-relaxed mb-4 min-h-[32px]">
                        {project.synopsis || 'あらすじ未設定'}
                      </p>
                    </div>

                    {/* Book Metadata Footer */}
                    <div
                      className={`pt-3 border-t flex items-center justify-between text-[10px] opacity-60 ${
                        isSepia ? 'border-amber-200/50' : 'border-[#2d2b27]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="flex items-center gap-1 font-mono">
                          <FileText className="w-3 h-3 text-amber-500" />
                          {project.total_chars.toLocaleString()}字
                        </span>
                        <span className="flex items-center gap-1">
                          <Bookmark className="w-3 h-3 opacity-60" />
                          {project.episode_count}話
                        </span>
                      </div>

                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 opacity-50" />
                        {project.last_modified}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={`px-6 py-3.5 border-t flex items-center justify-between ${
            isSepia ? 'border-amber-200 bg-amber-50/50' : 'border-[#2d2b27] bg-[#161513]'
          }`}
        >
          <div className="flex items-center gap-2 text-[11px] opacity-60">
            <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
            <span>書斎ルート: ~/Documents/NovelStudio/</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs opacity-75 hover:opacity-100 transition-opacity"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
