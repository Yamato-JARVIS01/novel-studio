import { useState, useRef } from 'react';
import { useVaultStore, useEditorStore, useExportStore } from '../../store';
import {
  X,
  FileDown,
  Copy,
  Check,
  Printer,
  HardDrive,
  Loader2,
} from 'lucide-react';
import { ExportOptions } from '../../lib/tauri-commands';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExportModal({ isOpen, onClose }: ExportModalProps) {
  const { vaultPath } = useVaultStore();
  const { theme } = useEditorStore();
  const {
    options,
    result,
    isLoading,
    savedPath,
    setFormat,
    setIncludeCover,
    setIncludeChapterTitles,
    saveToFile,
  } = useExportStore();

  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const isSepia = theme === 'cream-sepia';

  if (!isOpen) return null;

  const handleCopy = async () => {
    if (!result?.content) return;
    await navigator.clipboard.writeText(result.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveFile = async () => {
    if (!vaultPath || !result) return;
    setIsSaving(true);
    await saveToFile(vaultPath, result.suggested_filename, result.content);
    setIsSaving(false);
  };

  const handlePrint = () => {
    if (options.format === 'submission_html') {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
      }
    } else {
      // Print as plain text
      const printWin = window.open('', '_blank');
      if (printWin && result) {
        printWin.document.write(`<pre style="white-space: pre-wrap; font-family: monospace; padding: 20px;">${result.content}</pre>`);
        printWin.document.close();
        printWin.focus();
        printWin.print();
      }
    }
  };

  const formatButtons: { id: ExportOptions['format']; label: string; icon: string; desc: string }[] = [
    {
      id: 'submission_txt',
      label: '公募用テキスト (.txt)',
      icon: '📄',
      desc: '扉ページ・原稿用紙換算枚数付き、小説賞・新人賞応募規定形式',
    },
    {
      id: 'submission_html',
      label: '印刷・PDF用 縦書き組版 (.html)',
      icon: '📚',
      desc: '文庫組版・縦書き明朝・ルビ・傍点・章ごと改ページ対応',
    },
    {
      id: 'kakuyomu',
      label: 'カクヨム形式',
      icon: '🖋️',
      desc: '|漢字《ルビ》記法、傍点《《》》記法に一括整形',
    },
    {
      id: 'narou',
      label: '小説家になろう形式',
      icon: '🌐',
      desc: '|漢字(ルビ)記法、点打ちルビ傍点に一括整形',
    },
    {
      id: 'aozora',
      label: '青空文庫形式',
      icon: '🏛️',
      desc: '｜親文字《ルビ》、［＃傍点］記法に一括整形',
    },
    {
      id: 'plain',
      label: 'プレーンテキスト',
      icon: '📝',
      desc: 'ルビ・傍点記法を完全除去した純粋本文テキスト',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full max-w-5xl h-[88vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden transition-all ${
          isSepia
            ? 'bg-[#fcfbf9] border-amber-900/20 text-neutral-800 shadow-amber-950/20'
            : 'bg-[#181715] border-neutral-800 text-neutral-200 shadow-black/80'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`px-6 py-3.5 border-b flex items-center justify-between select-none ${
            isSepia ? 'bg-amber-500/10 border-amber-900/15' : 'bg-white/5 border-neutral-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <FileDown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wide flex items-center gap-2">
                <span>一括出力（エクスポート）スタジオ</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-mono font-medium">
                  Phase 10
                </span>
              </h2>
              <p className="text-xs opacity-60">
                公募規定提出ファイル ＆ 各種Web小説サイト投稿用記法への一括変換・出力
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={!result}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                isSepia
                  ? 'bg-white hover:bg-amber-50 border-amber-200 text-neutral-700 shadow-2xs'
                  : 'bg-[#242320] hover:bg-[#2e2c28] border-neutral-700 text-neutral-200'
              } disabled:opacity-40`}
              title="ブラウザ印刷ダイアログからPDFとして保存または印刷"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>印刷 / PDF出力</span>
            </button>

            <button
              onClick={handleCopy}
              disabled={!result}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                copied
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : isSepia
                  ? 'bg-white hover:bg-amber-50 border-amber-200 text-neutral-700 shadow-2xs'
                  : 'bg-[#242320] hover:bg-[#2e2c28] border-neutral-700 text-neutral-200'
              } disabled:opacity-40`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '一括コピー完了' : '本文をコピー'}</span>
            </button>

            <button
              onClick={handleSaveFile}
              disabled={isSaving || !result}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-sm disabled:opacity-40 transition-all"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <HardDrive className="w-3.5 h-3.5" />}
              <span>ファイル保存</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl opacity-60 hover:opacity-100 hover:bg-neutral-500/10 transition-colors ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body: 2-Column Studio Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Settings Sidebar */}
          <div
            className={`w-80 shrink-0 border-r p-4 overflow-y-auto space-y-4 ${
              isSepia ? 'border-amber-900/10 bg-amber-50/30' : 'border-neutral-800 bg-[#141311]'
            }`}
          >
            {/* Format Selection List */}
            <div>
              <label className="text-xs font-bold opacity-70 block mb-2">
                出力フォーマット選択
              </label>
              <div className="space-y-1.5">
                {formatButtons.map((f) => {
                  const isSelected = options.format === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setFormat(f.id)}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5 ${
                        isSelected
                          ? isSepia
                            ? 'bg-white border-amber-600 text-amber-950 shadow-xs ring-1 ring-amber-600/30'
                            : 'bg-[#262421] border-amber-400 text-amber-300 shadow-xs ring-1 ring-amber-400/30'
                          : isSepia
                          ? 'border-transparent hover:bg-white/60 text-neutral-700'
                          : 'border-transparent hover:bg-[#201f1c] text-neutral-300'
                      }`}
                    >
                      <span className="text-base leading-none mt-0.5">{f.icon}</span>
                      <div className="overflow-hidden flex-1">
                        <div className="text-xs font-semibold truncate">{f.label}</div>
                        <div className="text-[10px] opacity-60 line-clamp-2 mt-0.5 leading-snug">
                          {f.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Options Toggles */}
            <div
              className={`p-3 rounded-xl border space-y-2.5 ${
                isSepia ? 'bg-white/80 border-amber-900/10' : 'bg-[#1b1a18] border-neutral-800'
              }`}
            >
              <div className="text-xs font-bold opacity-75">原稿オプション</div>

              <label className="flex items-center justify-between text-xs cursor-pointer select-none">
                <span className="opacity-80">扉ページ（表紙・規定枚数）を含める</span>
                <input
                  type="checkbox"
                  checked={options.include_cover}
                  onChange={(e) => setIncludeCover(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between text-xs cursor-pointer select-none">
                <span className="opacity-80">各エピソードの章見出しを含める</span>
                <input
                  type="checkbox"
                  checked={options.include_chapter_titles}
                  onChange={(e) => setIncludeChapterTitles(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                />
              </label>
            </div>

            {/* Saved File Notice */}
            {savedPath && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>ファイルを保存しました</span>
                </div>
                <div className="text-[10px] font-mono break-all opacity-80">{savedPath}</div>
              </div>
            )}
          </div>

          {/* Right Main Preview Area */}
          <div className="flex-1 flex flex-col overflow-hidden bg-neutral-900/5 dark:bg-black/20">
            {/* Statistics Banner */}
            {result && (
              <div
                className={`px-6 py-3 border-b grid grid-cols-5 gap-4 text-center shrink-0 ${
                  isSepia ? 'bg-white/60 border-amber-900/10' : 'bg-[#1b1a18]/80 border-neutral-800'
                }`}
              >
                <div>
                  <div className="text-[10px] opacity-60">総文字数（空白除く）</div>
                  <div className="text-sm font-bold font-mono text-amber-600 dark:text-amber-400">
                    {result.char_count.toLocaleString()} <span className="text-[10px] font-normal">字</span>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] opacity-60">400字詰原稿用紙換算</div>
                  <div className="text-sm font-bold font-mono">
                    約 {result.page_count_400} <span className="text-[10px] font-normal">枚</span>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] opacity-60">公募 20×20 換算</div>
                  <div className="text-sm font-bold font-mono">
                    約 {result.page_count_20x20} <span className="text-[10px] font-normal">枚</span>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] opacity-60">公募 40×40 換算</div>
                  <div className="text-sm font-bold font-mono">
                    約 {result.page_count_40x40} <span className="text-[10px] font-normal">枚</span>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] opacity-60">収録エピソード</div>
                  <div className="text-sm font-bold font-mono">
                    全 {result.episode_count} <span className="text-[10px] font-normal">話</span>
                  </div>
                </div>
              </div>
            )}

            {/* Preview Viewport */}
            <div className="flex-1 p-4 overflow-hidden relative">
              {isLoading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-2 opacity-60">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                  <span className="text-xs">原稿を一括結合・記法変換中...</span>
                </div>
              ) : result ? (
                options.format === 'submission_html' ? (
                  <iframe
                    ref={iframeRef}
                    srcDoc={result.content}
                    title="縦書き組版プレビュー"
                    className="w-full h-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white shadow-inner"
                  />
                ) : (
                  <textarea
                    readOnly
                    value={result.content}
                    className={`w-full h-full p-4 rounded-xl text-xs font-mono resize-none outline-none border leading-relaxed ${
                      isSepia
                        ? 'bg-white border-amber-900/15 text-neutral-800'
                        : 'bg-[#121110] border-neutral-800 text-neutral-200'
                    }`}
                  />
                )
              ) : (
                <div className="h-full flex items-center justify-center opacity-40 text-xs">
                  原稿データがありません
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
