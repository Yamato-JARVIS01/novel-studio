import { useEffect, useRef, useState, useMemo } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { useEditorStore, useVaultStore, useDiffStore, useAiStore, useWorldGraphStore, useExportStore } from '../../store';
import { VerticalPreviewModal } from './VerticalPreviewModal';
import { rubyExtension } from './rubyExtension';
import { FloatingPlotHud } from './FloatingPlotHud';
import { TimeMachineModal } from './TimeMachineModal';
import {
  Check,
  Type,
  Maximize2,
  Minimize2,
  GitCompare,
  CheckCheck,
  XCircle,
  Sparkles,
  Loader2,
  Sun,
  Moon,
  Hash,
  BookOpen,
  FolderOpen,
  ChevronDown,
  AlertCircle,
  BookMarked,
  Compass,
  History,
  RefreshCw,
  FileDown,
} from 'lucide-react';

interface EditorProps {
  onOpenSettings?: () => void;
}

export function Editor({ onOpenSettings }: EditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  const {
    body,
    fontSize,
    fontFamily,
    theme,
    showLineNumbers,
    isZenFocus,
    updateBody,
    save,
    setFontSize,
    setFontFamily,
    toggleTheme,
    toggleLineNumbers,
    toggleVerticalPreview,
    setIsZenFocus,
    setIsTyping,
  } = useEditorStore();

  const { vaultPath, activeFilePath, loadSampleProject, setVaultPath } = useVaultStore();
  const { isDiffOpen, diffFiles, acceptRevision, rejectRevision } = useDiffStore();
  const { isReviewing, lastError, runReview } = useAiStore();
  const { syncManuscriptToWorldAction, isSyncingManuscript, syncResultNotice } = useWorldGraphStore();
  const { openExportModal } = useExportStore();

  const [isPlotHudOpen, setIsPlotHudOpen] = useState(false);
  const [isTimeMachineOpen, setIsTimeMachineOpen] = useState(false);
  const [isAiMenuOpen, setIsAiMenuOpen] = useState(false);
  const [promptText] = useState('表現のブラッシュアップと情景描写の深化を行ってください。');
  const [isApiKeyWarningOpen, setIsApiKeyWarningOpen] = useState(false);

  const isSepia = theme === 'cream-sepia';

  // Beautiful themes for CodeMirror 6: Warm Dark & Cream Sepia
  const customTheme = useMemo(() => {
    if (isSepia) {
      return EditorView.theme({
        '&': {
          height: '100%',
          fontSize: `${fontSize}px`,
          fontFamily:
            fontFamily === 'serif'
              ? '"Source Han Serif", "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif'
              : '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          backgroundColor: '#fbf9f5',
          color: '#2a2622',
        },
        '.cm-content': {
          padding: '4rem 2rem 10rem 2rem',
          lineHeight: '2.25',
          letterSpacing: '0.05em',
          maxWidth: '760px',
          margin: '0 auto',
          wordBreak: 'break-all',
          overflowWrap: 'break-word',
        },
        '.cm-line': {
          wordBreak: 'break-all',
          overflowWrap: 'break-word',
        },
        '.cm-cursor': {
          borderLeftColor: '#b45309',
          borderLeftWidth: '2.5px',
        },
        '.cm-activeLine': {
          backgroundColor: 'rgba(180, 83, 9, 0.04)',
        },
        '.cm-gutters': {
          backgroundColor: '#fbf9f5',
          color: '#a8a29e',
          border: 'none',
          paddingRight: '1rem',
          fontSize: '12px',
        },
        '.cm-selectionBackground, ::selection': {
          backgroundColor: '#eadbc8 !important',
        },
      });
    }

    // Warm Dark
    return EditorView.theme({
      '&': {
        height: '100%',
        fontSize: `${fontSize}px`,
        fontFamily:
          fontFamily === 'serif'
            ? '"Source Han Serif", "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif'
            : '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        backgroundColor: '#1a1917',
        color: '#e8e4de',
      },
      '.cm-content': {
        padding: '4rem 2rem 10rem 2rem',
        lineHeight: '2.25',
        letterSpacing: '0.05em',
        maxWidth: '760px',
        margin: '0 auto',
        wordBreak: 'break-all',
        overflowWrap: 'break-word',
      },
      '.cm-line': {
        wordBreak: 'break-all',
        overflowWrap: 'break-word',
      },
      '.cm-cursor': {
        borderLeftColor: '#fbbf24',
        borderLeftWidth: '2.5px',
      },
      '.cm-activeLine': {
        backgroundColor: 'rgba(251, 191, 36, 0.04)',
      },
      '.cm-gutters': {
        backgroundColor: '#1a1917',
        color: '#57534e',
        border: 'none',
        paddingRight: '1rem',
        fontSize: '12px',
      },
      '.cm-selectionBackground, ::selection': {
        backgroundColor: '#38342e !important',
      },
    });
  }, [fontSize, fontFamily, isSepia]);

  // Keyboard shortcut listener (Cmd+S / Ctrl+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [save]);

  // Re-create or re-configure CodeMirror when options change
  useEffect(() => {
    if (!editorRef.current || !activeFilePath) return;

    if (viewRef.current) {
      viewRef.current.destroy();
    }

    // 1. Line Wrapping and Ruby & Bouten extension
    const extensions = [
      EditorView.lineWrapping,
      highlightActiveLine(),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      ...rubyExtension,
      customTheme,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const newDoc = update.state.doc.toString();
          updateBody(newDoc);
          // Maintain Zen Focus typing mode without auto-restoring timer
          setIsTyping(true);
        }
      }),
      EditorView.domEventHandlers({
        focus: () => {
          setIsTyping(true);
        },
        compositionstart: () => {
          // IME conversion started: lock Zen focus completely
          setIsTyping(true);
        },
        compositionend: () => {
          // IME conversion completed: keep Zen focus
          setIsTyping(true);
        },
        keydown: (e) => {
          // Esc or Cmd+B / Ctrl+B to exit/toggle Zen focus
          if (e.key === 'Escape' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b')) {
            e.preventDefault();
            const currentZen = useEditorStore.getState().isZenFocus;
            useEditorStore.getState().setIsZenFocus(!currentZen);
            useEditorStore.getState().setIsTyping(false);
          }
        },
      }),
    ];

    if (showLineNumbers) {
      extensions.unshift(lineNumbers());
    }

    const startState = EditorState.create({
      doc: body,
      extensions,
    });

    const view = new EditorView({
      state: startState,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [activeFilePath, showLineNumbers, customTheme]);

  // Sync external content update without destroying cursor
  useEffect(() => {
    if (viewRef.current) {
      const currentDoc = viewRef.current.state.doc.toString();
      if (currentDoc !== body) {
        viewRef.current.dispatch({
          changes: { from: 0, to: currentDoc.length, insert: body },
        });
      }
    }
  }, [body]);

  const handleTriggerAi = async (presetPrompt?: string) => {
    const prompt = presetPrompt || promptText;
    setIsAiMenuOpen(false);

    const apiKey = localStorage.getItem('novel_studio_api_key');
    const provider = localStorage.getItem('novel_studio_provider') || 'gemini';
    if (!apiKey && provider !== 'ollama') {
      setIsApiKeyWarningOpen(true);
      return;
    }

    await runReview(prompt);
  };

  const activeDiff = diffFiles.length > 0 ? diffFiles[0] : null;

  return (
    <div
      className={`flex-1 flex flex-col h-full relative transition-colors ${
        isSepia ? 'bg-[#fbf9f5] text-[#2a2622]' : 'bg-[#1a1917] text-[#e8e4de]'
      }`}
    >
      {/* Top Author Toolbar */}
      <div
        className={`h-11 border-b px-3 flex items-center justify-between select-none z-20 backdrop-blur-md overflow-hidden ${
          isSepia
            ? 'bg-[#fbf9f5]/85 border-amber-900/10'
            : 'bg-[#1a1917]/85 border-[#2c2a27]'
        }`}
      >
        <div className="flex items-center space-x-2 text-xs shrink-0 overflow-hidden pr-2">
          <span className="font-semibold truncate max-w-[160px] text-amber-800 dark:text-amber-200">
            {activeFilePath
              ? activeFilePath.split('/').pop()?.replace(/\.md$|\.txt$/, '')
              : '執筆待機中'}
          </span>
        </div>

        {/* Toolbar Controls: completely prevents wrapping/truncation with whitespace-nowrap and overflow-x-auto */}
        <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-0.5">
          {/* Floating Plot HUD Button */}
          <button
            onClick={() => setIsPlotHudOpen(!isPlotHudOpen)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border shadow-xs transition-all whitespace-nowrap shrink-0 ${
              isPlotHudOpen
                ? 'bg-amber-600 text-white border-amber-600 shadow-amber-900/30'
                : isSepia
                ? 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-neutral-700'
                : 'bg-[#282623] hover:bg-[#33302c] border-[#44403a] text-neutral-300'
            }`}
            title="全体＆話別筋書きのフローティングHUD"
          >
            <Compass className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>筋書きHUD</span>
          </button>

          {/* Time Machine Modal Button */}
          <button
            onClick={() => setIsTimeMachineOpen(true)}
            disabled={!activeFilePath}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border shadow-xs transition-all whitespace-nowrap shrink-0 ${
              isSepia
                ? 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-neutral-700'
                : 'bg-[#282623] hover:bg-[#33302c] border-[#44403a] text-neutral-300'
            } disabled:opacity-40`}
            title="過去のスナップショットをタイムトラベル・復元"
          >
            <History className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>タイムマシン</span>
          </button>

          {/* Vertical Preview Button */}
          <button
            onClick={toggleVerticalPreview}
            disabled={!activeFilePath}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border shadow-xs transition-all whitespace-nowrap shrink-0 ${
              isSepia
                ? 'bg-amber-100/70 hover:bg-amber-200/70 border-amber-300 text-amber-950'
                : 'bg-[#282623] hover:bg-[#33302c] border-[#44403a] text-amber-300'
            } disabled:opacity-40`}
            title="文庫本のように美しい縦書きで確認"
          >
            <BookMarked className="w-3.5 h-3.5 shrink-0" />
            <span>縦書きプレビュー</span>
          </button>

          {/* Bi-directional World Graph Auto-sync Button */}
          <button
            onClick={async () => {
              if (vaultPath && body) {
                await syncManuscriptToWorldAction(vaultPath, body);
              }
            }}
            disabled={isSyncingManuscript || !vaultPath || !body}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border shadow-xs transition-all whitespace-nowrap shrink-0 ${
              isSepia
                ? 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-neutral-700'
                : 'bg-[#282623] hover:bg-[#33302c] border-[#44403a] text-neutral-300'
            } disabled:opacity-40`}
            title="原稿本文から新キャラ・重要用語を抽出し、設定ノートとグラフDBへ自動還元"
          >
            {isSyncingManuscript ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500 shrink-0" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            )}
            <span>設定還元</span>
          </button>

          {/* Export Studio Modal Button */}
          <button
            onClick={() => openExportModal()}
            disabled={!vaultPath}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border shadow-xs transition-all whitespace-nowrap shrink-0 ${
              isSepia
                ? 'bg-amber-100/70 hover:bg-amber-200/70 border-amber-300 text-amber-950'
                : 'bg-[#282623] hover:bg-[#33302c] border-[#44403a] text-amber-300'
            } disabled:opacity-40`}
            title="公募提出原稿やWeb小説サイト記法（カクヨム/なろう/青空文庫/縦書きHTML）へ一括出力"
          >
            <FileDown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>原稿出力</span>
          </button>

          {/* AI Editing Dropdown */}
          <div className="relative shrink-0">
            <div className="flex items-center">
              <button
                onClick={() => handleTriggerAi()}
                disabled={isReviewing || !activeFilePath}
                className="flex items-center gap-1 px-2.5 py-1 rounded-l-lg text-xs font-semibold bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white shadow-sm disabled:opacity-40 transition-all whitespace-nowrap shrink-0"
              >
                {isReviewing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{isReviewing ? '推敲中...' : 'AI推敲'}</span>
              </button>
              <button
                onClick={() => setIsAiMenuOpen(!isAiMenuOpen)}
                disabled={isReviewing || !activeFilePath}
                className="px-1.5 py-1 rounded-r-lg bg-amber-700 hover:bg-amber-600 text-white border-l border-amber-600/40 text-xs disabled:opacity-40 shrink-0"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>

            {/* Presets Menu */}
            {isAiMenuOpen && (
              <div
                className={`absolute top-9 right-0 w-80 rounded-xl shadow-xl p-2 z-50 text-xs border ${
                  isSepia
                    ? 'bg-white border-amber-200 text-neutral-800'
                    : 'bg-[#22211f] border-[#383531] text-neutral-200'
                }`}
              >
                <div className="px-2 py-1 text-[11px] font-bold opacity-60">推敲コースを選択</div>
                <div className="space-y-1 my-1">
                  {[
                    { label: '✨ 表現を豊かに・情景描写の深化', prompt: '作家の文体を尊重しつつ、五感に訴える情景描写や比喩表現を豊かにブラッシュアップしてください。' },
                    { label: '🖋️ 文体リズムの向上・修飾の整理', prompt: '文章のリズムとテンポを良くし、重複した表現や過剰な修飾を削ぎ落として読みやすく整えてください。' },
                    { label: '💡 誤字脱字・日本語組版の徹底校閲', prompt: '出版組版基準に基づき、誤字脱字、三点リーダーやダッシュの用法、段落字下げなどを徹底校閲してください。' },
                    { label: '🎭 心理描写・感情の掘り下げ', prompt: '登場人物の心情の揺らぎや動機が読者により鮮やかに伝わるよう、心理描写を深めてください。' },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => handleTriggerAi(item.prompt)}
                      className={`w-full text-left p-2 rounded-lg text-xs transition-colors flex flex-col ${
                        isSepia ? 'hover:bg-amber-50' : 'hover:bg-[#2c2925]'
                      }`}
                    >
                      <span className="font-semibold text-[11px]">{item.label}</span>
                      <span className="text-[10px] opacity-60 truncate">{item.prompt}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Theme Toggle (Warm Dark / Cream Sepia) */}
          <button
            onClick={toggleTheme}
            className={`p-1.5 rounded-lg border transition-colors shrink-0 ${
              isSepia
                ? 'bg-amber-100/60 border-amber-200 text-amber-900 hover:bg-amber-200/60'
                : 'bg-[#252321] border-[#383531] text-amber-300 hover:bg-[#2f2c29]'
            }`}
            title={isSepia ? 'ウォームダークに切り替え' : '和紙セピア調に切り替え'}
          >
            {isSepia ? <Moon className="w-3.5 h-3.5 shrink-0" /> : <Sun className="w-3.5 h-3.5 shrink-0" />}
          </button>

          {/* Line Numbers Toggle */}
          <button
            onClick={toggleLineNumbers}
            className={`p-1.5 rounded-lg border transition-colors shrink-0 ${
              showLineNumbers
                ? 'bg-amber-600 text-white border-amber-600'
                : isSepia
                ? 'bg-amber-50 border-amber-200 text-neutral-600 hover:bg-amber-100'
                : 'bg-[#252321] border-[#383531] text-neutral-400 hover:text-neutral-200'
            }`}
            title={showLineNumbers ? '行番号を隠す' : '行番号を表示'}
          >
            <Hash className="w-3.5 h-3.5 shrink-0" />
          </button>

          {/* Typography Controls */}
          <div
            className={`flex items-center border rounded-lg p-0.5 text-xs shrink-0 whitespace-nowrap ${
              isSepia ? 'bg-amber-50/70 border-amber-200' : 'bg-[#252321] border-[#383531]'
            }`}
          >
            <button
              onClick={() => setFontFamily(fontFamily === 'serif' ? 'sans' : 'serif')}
              className="px-2 py-0.5 rounded hover:opacity-80 transition-opacity flex items-center gap-1 whitespace-nowrap"
              title="書体切り替え"
            >
              <Type className="w-3 h-3 shrink-0" />
              <span className="text-[10px] font-medium">{fontFamily === 'serif' ? '明朝' : 'ゴシック'}</span>
            </button>
            <span className="w-px h-3 bg-neutral-500/20 mx-0.5" />
            <button
              onClick={() => setFontSize(Math.max(13, fontSize - 1))}
              className="px-1.5 py-0.5 rounded hover:opacity-80 font-mono"
              title="文字を小さく"
            >
              -
            </button>
            <span className="text-[11px] font-mono px-1 opacity-75">{fontSize}</span>
            <button
              onClick={() => setFontSize(Math.min(26, fontSize + 1))}
              className="px-1.5 py-0.5 rounded hover:opacity-80 font-mono"
              title="文字を大きく"
            >
              +
            </button>
          </div>

          {/* Zen Focus Mode Button */}
          <button
            onClick={() => setIsZenFocus(!isZenFocus)}
            className={`p-1.5 rounded-lg border transition-colors shrink-0 ${
              isZenFocus
                ? 'bg-amber-600 text-white border-amber-600'
                : isSepia
                ? 'bg-amber-50 border-amber-200 text-neutral-700 hover:bg-amber-100'
                : 'bg-[#252321] border-[#383531] text-neutral-300 hover:bg-[#2f2c29]'
            }`}
            title={isZenFocus ? '執筆没入モードを解除 (Esc / Cmd+B)' : '執筆没入モード（Esc / Cmd+B）'}
          >
            {isZenFocus ? <Minimize2 className="w-3.5 h-3.5 shrink-0" /> : <Maximize2 className="w-3.5 h-3.5 shrink-0" />}
          </button>
        </div>
      </div>

      {/* AI Key Missing Modal */}
      {isApiKeyWarningOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div
            className={`max-w-md w-full p-6 rounded-2xl shadow-2xl border ${
              isSepia ? 'bg-white border-amber-200 text-neutral-800' : 'bg-[#201f1d] border-[#35332f] text-neutral-100'
            }`}
          >
            <div className="flex items-center gap-2 mb-3 text-amber-600 dark:text-amber-400">
              <Sparkles className="w-5 h-5" />
              <h3 className="font-bold text-sm">AI推敲のご案内</h3>
            </div>
            <p className="text-xs opacity-80 leading-relaxed mb-4">
              AI推敲を利用するには、設定画面で Gemini、Claude、OpenAI、またはローカルの Ollama を設定してください。
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsApiKeyWarningOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs opacity-70 hover:opacity-100"
              >
                あとで
              </button>
              <button
                onClick={() => {
                  setIsApiKeyWarningOpen(false);
                  if (onOpenSettings) onOpenSettings();
                }}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-sm"
              >
                ⚙️ 設定画面を開く
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Revision Banner / Diff View */}
      {isDiffOpen && (
        <div className="bg-amber-950/90 border-b border-amber-800/80 px-4 py-2.5 flex items-center justify-between z-10 text-xs">
          <div className="flex items-center gap-2 text-amber-200">
            <GitCompare className="w-4 h-4 text-amber-400" />
            <span>AI推敲提案のプレビュー中（採用すると現在のファイルに反映されます）</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={acceptRevision}
              className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-lg font-semibold shadow-sm"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              推敲を採用する
            </button>
            <button
              onClick={rejectRevision}
              className="flex items-center gap-1 bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 px-3 py-1 rounded-lg font-medium"
            >
              <XCircle className="w-3.5 h-3.5" />
              今回は見送る
            </button>
          </div>
        </div>
      )}

      {/* Diff Inspector Details (if in diff mode) */}
      {isDiffOpen && activeDiff && (
        <div className="bg-[#12161f] border-b border-neutral-800 p-4 max-h-56 overflow-y-auto font-mono text-xs">
          {activeDiff.hunks.map((hunk, hIdx) => (
            <div key={hIdx} className="mb-3">
              <div className="text-neutral-500 bg-neutral-900/80 px-2 py-0.5 rounded text-[11px] mb-1">
                {hunk.header}
              </div>
              {hunk.lines.map((line, lIdx) => (
                <div
                  key={lIdx}
                  className={`px-2 py-0.5 flex items-start ${
                    line.line_type === 'Addition'
                      ? 'bg-emerald-950/50 text-emerald-300'
                      : line.line_type === 'Deletion'
                      ? 'bg-rose-950/50 text-rose-300'
                      : 'text-neutral-400'
                  }`}
                >
                  <span className="w-6 shrink-0 text-neutral-600 text-[10px]">
                    {line.line_type === 'Addition' ? '+' : line.line_type === 'Deletion' ? '-' : ' '}
                  </span>
                  <pre className="whitespace-pre-wrap font-mono flex-1">{line.content}</pre>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Error Banner */}
      {lastError && (
        <div className="bg-rose-950/90 border-b border-rose-800 text-rose-200 px-4 py-2 text-xs flex justify-between items-center">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{lastError}</span>
          </div>
          <button onClick={() => useAiStore.setState({ lastError: null })} className="text-rose-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Editor Surface or Welcome Screen */}
      <div className="flex-1 overflow-hidden relative">
        {!activeFilePath ? (
          /* Welcome Card for Writers (Onboarding) */
          <div className="h-full w-full flex items-center justify-center p-6 overflow-y-auto">
            <div
              className={`max-w-lg w-full p-8 rounded-3xl border shadow-2xl text-center space-y-6 ${
                isSepia
                  ? 'bg-white/80 border-amber-200/80 text-neutral-800 shadow-amber-900/5'
                  : 'bg-[#201f1d] border-[#33312d] text-neutral-100 shadow-black/40'
              }`}
            >
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-amber-600/20">
                <BookOpen className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-bold tracking-tight">小説執筆スタジオへようこそ</h2>
                <p className="text-xs opacity-75 leading-relaxed max-w-sm mx-auto">
                  余計な機能やエンジニア用語を排し、あなたの物語の執筆と推敲だけに集中できる専用空間です。
                </p>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                {/* 1-click sample button */}
                <button
                  onClick={loadSampleProject}
                  className="w-full py-3.5 px-4 rounded-xl font-semibold text-xs bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white shadow-md flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>✨ サンプル作品を自動作成してすぐ試す</span>
                </button>

                {/* Open existing folder */}
                <button
                  onClick={() => {
                    const path = prompt('原稿フォルダのフルパスを入力してください:');
                    if (path) setVaultPath(path);
                  }}
                  className={`w-full py-3 px-4 rounded-xl font-medium text-xs border flex items-center justify-center gap-2 transition-colors ${
                    isSepia
                      ? 'bg-amber-50/60 border-amber-200 text-amber-950 hover:bg-amber-100/60'
                      : 'bg-[#292724] border-[#3d3a35] text-neutral-200 hover:bg-[#322f2b]'
                  }`}
                >
                  <FolderOpen className="w-4 h-4 opacity-70" />
                  <span>📂 既存の原稿フォルダを開く</span>
                </button>
              </div>

              <div className="pt-2 text-[11px] opacity-50 flex items-center justify-center gap-4">
                <span>✓ ゼロ遅延打鍵</span>
                <span>✓ 自動バックアップ</span>
                <span>✓ 公募原稿用紙換算</span>
              </div>
            </div>
          </div>
        ) : (
          <div ref={editorRef} className="h-full w-full overflow-y-auto" />
        )}
        {/* Floating Plot & Synopsis HUD */}
        <FloatingPlotHud isOpen={isPlotHudOpen} onClose={() => setIsPlotHudOpen(false)} />

        {/* Floating Notification Toast for Bi-directional Setting Sync */}
        {syncResultNotice && (
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 text-white shadow-xl text-xs font-semibold backdrop-blur-md">
              <Check className="w-4 h-4 text-emerald-300" />
              <span>{syncResultNotice}</span>
            </div>
          </div>
        )}
      </div>

      {/* Vertical Japanese Book Reading Modal */}
      <VerticalPreviewModal />

      {/* Writing Time Machine Modal */}
      <TimeMachineModal isOpen={isTimeMachineOpen} onClose={() => setIsTimeMachineOpen(false)} />
    </div>
  );
}
