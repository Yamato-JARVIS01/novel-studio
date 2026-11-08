import { useState, useEffect } from 'react';
import { useVaultStore, useEditorStore } from '../../store';
import { getFileHistory, CommitHistoryItem } from '../../lib/tauri-commands';
import {
  History,
  X,
  RotateCcw,
  Clock,
  Calendar,
  ArrowRight,
  Check,
} from 'lucide-react';

interface TimeMachineModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TimeMachineModal({ isOpen, onClose }: TimeMachineModalProps) {
  const { vaultPath, activeFilePath, refreshFiles, refreshGitStatus } = useVaultStore();
  const { body, updateBody, save, theme } = useEditorStore();

  const [historyItems, setHistoryItems] = useState<CommitHistoryItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestored, setIsRestored] = useState(false);

  const isSepia = theme === 'cream-sepia';

  useEffect(() => {
    if (isOpen && vaultPath && activeFilePath) {
      setIsLoading(true);
      setIsRestored(false);
      getFileHistory(vaultPath, activeFilePath)
        .then((items) => {
          setHistoryItems(items);
          setSelectedIndex(0);
          setIsLoading(false);
        })
        .catch((err) => {
          console.error('Failed to load history:', err);
          setIsLoading(false);
        });
    }
  }, [isOpen, vaultPath, activeFilePath]);

  if (!isOpen) return null;

  const currentItem = historyItems[selectedIndex];
  const historicalContent = currentItem?.content || '';

  const currentCharCount = body.length;
  const historicalCharCount = historicalContent.length;
  const charDiff = historicalCharCount - currentCharCount;

  const handleRestore = async () => {
    if (!historicalContent) return;
    updateBody(historicalContent);
    await save();
    if (vaultPath) {
      await refreshGitStatus();
      await refreshFiles();
    }
    setIsRestored(true);
    setTimeout(() => {
      setIsRestored(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div
        className={`w-full max-w-5xl h-[85vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden transition-all ${
          isSepia
            ? 'bg-[#fcfbf9] border-amber-900/15 text-neutral-800'
            : 'bg-[#1b1a18] border-[#33302b] text-neutral-100'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`px-6 py-4 flex items-center justify-between border-b ${
            isSepia ? 'border-amber-900/10 bg-amber-500/5' : 'border-neutral-800/80 bg-white/5'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wide flex items-center gap-2">
                <span>執筆タイムマシン（過去スナップショット復元）</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  {historyItems.length} 個の過去時点
                </span>
              </h2>
              <p className="text-xs opacity-60">
                {activeFilePath ? activeFilePath.split('/').pop() : 'エピソード未選択'} の時間旅行
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isRestored && (
              <span className="text-xs text-emerald-500 font-bold flex items-center gap-1 animate-pulse">
                <Check className="w-4 h-4" /> 復元が完了しました！
              </span>
            )}
            <button
              onClick={handleRestore}
              disabled={!historicalContent || historyItems.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-md transition-all disabled:opacity-40"
            >
              <RotateCcw className="w-4 h-4" />
              <span>この時点の原稿に巻き戻す</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl opacity-60 hover:opacity-100 hover:bg-neutral-500/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-2">
              <Clock className="w-8 h-8 animate-spin-slow text-amber-500 mx-auto opacity-70" />
              <p className="text-xs opacity-60">タイムトラベル中（Gitリビジョンを探索しています）...</p>
            </div>
          </div>
        ) : historyItems.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-8 text-center opacity-60">
            <p className="text-sm">まだ保存履歴がありません。執筆を進めて保存するとタイムマシンが記録されます。</p>
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            {/* Left Timeline Panel */}
            <div
              className={`w-80 border-r flex flex-col ${
                isSepia ? 'border-amber-900/10 bg-amber-50/30' : 'border-neutral-800 bg-[#161513]/60'
              }`}
            >
              {/* Slider for quick scrubbing */}
              <div className="p-4 border-b border-inherit space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="opacity-70">タイムライン・スクラブ</span>
                  <span className="font-mono text-amber-600 dark:text-amber-400">
                    {selectedIndex + 1} / {historyItems.length}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, historyItems.length - 1)}
                  value={selectedIndex}
                  onChange={(e) => setSelectedIndex(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Commit Snapshot List */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {historyItems.map((item, idx) => (
                  <button
                    key={item.commit_id}
                    onClick={() => setSelectedIndex(idx)}
                    className={`w-full text-left p-3 rounded-xl text-xs transition-all flex flex-col gap-1 border ${
                      selectedIndex === idx
                        ? isSepia
                          ? 'bg-amber-100/80 border-amber-300 text-amber-950 font-semibold shadow-xs'
                          : 'bg-amber-500/15 border-amber-500/40 text-amber-200 font-semibold shadow-xs'
                        : 'border-transparent opacity-70 hover:opacity-100 hover:bg-neutral-500/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold truncate max-w-[170px]">
                        {item.message || '原稿保存'}
                      </span>
                      <span className="text-[10px] font-mono opacity-60">
                        {item.date_str.split(' ')[1] || ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] opacity-60">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {item.date_str.split(' ')[0]}
                      </span>
                      <span className="font-mono truncate">{item.commit_id.substring(0, 7)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right Comparison & Preview Pane */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Metrics Bar */}
              <div
                className={`px-6 py-2.5 border-b flex items-center justify-between text-xs ${
                  isSepia ? 'border-amber-900/10 bg-white/50' : 'border-neutral-800 bg-white/5'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div>
                    <span className="opacity-60 mr-1.5">現在の文字数:</span>
                    <span className="font-mono font-semibold">{currentCharCount.toLocaleString()} 字</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 opacity-40" />
                  <div>
                    <span className="opacity-60 mr-1.5">この時点の文字数:</span>
                    <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                      {historicalCharCount.toLocaleString()} 字
                    </span>
                  </div>
                  <div
                    className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full ${
                      charDiff >= 0 ? 'bg-emerald-500/15 text-emerald-600' : 'bg-rose-500/15 text-rose-500'
                    }`}
                  >
                    {charDiff >= 0 ? `+${charDiff.toLocaleString()}` : charDiff.toLocaleString()} 字
                  </div>
                </div>

                <div className="text-[11px] opacity-60">
                  記録日時: {currentItem?.date_str}
                </div>
              </div>

              {/* Document Preview Viewport */}
              <div className="flex-1 overflow-y-auto p-8 font-serif leading-loose text-base select-text whitespace-pre-wrap">
                <div className="max-w-2xl mx-auto">
                  {historicalContent || (
                    <div className="text-center opacity-40 py-12">原稿データなし</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
