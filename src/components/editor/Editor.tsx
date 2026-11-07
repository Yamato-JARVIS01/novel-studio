import { useEffect, useRef, useState, useMemo } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { oneDark } from '@codemirror/theme-one-dark';
import { useEditorStore, useVaultStore, useDiffStore, useAiStore } from '../../store';
import {
  Save,
  Check,
  Type,
  Maximize2,
  Minimize2,
  GitCompare,
  CheckCheck,
  XCircle,
  Sparkles,
  Loader2,
} from 'lucide-react';

export function Editor() {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  const {
    rawContent,
    isDirty,
    fontSize,
    fontFamily,
    updateContent,
    save,
    setFontSize,
    setFontFamily,
  } = useEditorStore();

  const { activeFilePath } = useVaultStore();
  const { isDiffOpen, diffFiles, acceptRevision, rejectRevision } = useDiffStore();
  const { isReviewing, lastError, runReview } = useAiStore();

  const [isZenMode, setIsZenMode] = useState(false);
  const [isAiPromptOpen, setIsAiPromptOpen] = useState(false);
  const [promptText, setPromptText] = useState('表現のブラッシュアップと情景描写の深化を行ってください。');

  // Custom editor theme based on novel writing preferences
  const customTheme = useMemo(() => {
    return EditorView.theme({
      '&': {
        height: '100%',
        fontSize: `${fontSize}px`,
        fontFamily: fontFamily === 'serif' ? '"Source Han Serif", "Hiragino Mincho ProN", "Yu Mincho", serif' : 'system-ui, sans-serif',
        backgroundColor: '#0d1117',
        color: '#e6edf3',
      },
      '.cm-content': {
        padding: '3rem 4rem',
        lineHeight: '2.1',
        letterSpacing: '0.04em',
        maxWidth: '850px',
        margin: '0 auto',
      },
      '.cm-cursor': {
        borderLeftColor: '#38bdf8',
        borderLeftWidth: '2.5px',
      },
      '.cm-activeLine': {
        backgroundColor: 'rgba(56, 189, 248, 0.04)',
      },
      '.cm-gutters': {
        backgroundColor: '#0d1117',
        color: '#484f58',
        border: 'none',
        paddingLeft: '1rem',
      },
    });
  }, [fontSize, fontFamily]);

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

  // Initialize CodeMirror 6 Editor
  useEffect(() => {
    if (!editorRef.current) return;

    const startState = EditorState.create({
      doc: rawContent,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        oneDark,
        customTheme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newDoc = update.state.doc.toString();
            updateContent(newDoc);
          }
        }),
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
    };
  }, []);

  // Sync external changes (e.g. file switched or revision accepted)
  useEffect(() => {
    if (viewRef.current) {
      const currentDoc = viewRef.current.state.doc.toString();
      if (currentDoc !== rawContent) {
        viewRef.current.dispatch({
          changes: { from: 0, to: currentDoc.length, insert: rawContent },
        });
      }
    }
  }, [rawContent]);

  const handleRunAi = async () => {
    setIsAiPromptOpen(false);
    await runReview(promptText);
  };

  const activeDiff = diffFiles.length > 0 ? diffFiles[0] : null;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d1117] relative">
      {/* Top Toolbar */}
      <div className="h-10 border-b border-[#30363d] px-4 flex items-center justify-between bg-[#161b22]/70 backdrop-blur z-20">
        <div className="flex items-center space-x-3 text-xs text-neutral-300">
          <span className="font-medium truncate max-w-xs text-neutral-200">
            {activeFilePath ? activeFilePath.split('/').pop() : 'No file open'}
          </span>
          {isDirty && (
            <span className="flex items-center text-[11px] text-amber-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5 animate-pulse" />
              Unsaved
            </span>
          )}
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center space-x-2">
          {/* AI Revision Button */}
          <button
            onClick={() => setIsAiPromptOpen(!isAiPromptOpen)}
            disabled={isReviewing || !activeFilePath}
            className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white shadow-sm disabled:opacity-50 transition-all"
          >
            {isReviewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>{isReviewing ? 'AI推敲中...' : 'AI推敲'}</span>
          </button>

          {/* Typography Controls */}
          <div className="flex items-center bg-neutral-900 border border-neutral-700 rounded p-0.5 text-xs text-neutral-300">
            <button
              onClick={() => setFontFamily(fontFamily === 'serif' ? 'sans' : 'serif')}
              className="px-2 py-0.5 rounded hover:bg-neutral-800 transition-colors flex items-center gap-1"
              title="Font Family"
            >
              <Type className="w-3.5 h-3.5" />
              <span className="text-[10px]">{fontFamily === 'serif' ? '明朝' : 'ゴシック'}</span>
            </button>
            <span className="w-px h-3 bg-neutral-700 mx-1" />
            <button
              onClick={() => setFontSize(Math.max(12, fontSize - 1))}
              className="px-1.5 py-0.5 rounded hover:bg-neutral-800"
              title="Decrease Font Size"
            >
              -
            </button>
            <span className="text-[11px] font-mono px-1">{fontSize}</span>
            <button
              onClick={() => setFontSize(Math.min(26, fontSize + 1))}
              className="px-1.5 py-0.5 rounded hover:bg-neutral-800"
              title="Increase Font Size"
            >
              +
            </button>
          </div>

          {/* Zen Mode */}
          <button
            onClick={() => setIsZenMode(!isZenMode)}
            className="p-1.5 rounded border border-neutral-700 bg-neutral-900 text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
            title={isZenMode ? 'Exit Zen Mode' : 'Zen Mode'}
          >
            {isZenMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Save Button */}
          <button
            onClick={save}
            disabled={!isDirty}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
              isDirty
                ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-sm'
                : 'bg-neutral-800 text-neutral-400 cursor-default'
            }`}
          >
            {isDirty ? <Save className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
            Save
          </button>
        </div>
      </div>

      {/* AI Prompt Popover */}
      {isAiPromptOpen && (
        <div className="absolute top-12 right-6 w-96 bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl p-4 z-40 text-xs">
          <div className="font-semibold text-neutral-200 mb-2 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-sky-400" />
            AI 推敲・編集指示
          </div>
          <div className="space-y-1.5 mb-3">
            {[
              '表現のブラッシュアップと情景描写の深化',
              '文体リズムの向上と不要な修飾の削ぎ落とし',
              '登場人物の感情・心理描写の掘り下げ',
              '日本語組版・誤字脱字の徹底校閲',
            ].map((preset) => (
              <button
                key={preset}
                onClick={() => setPromptText(preset)}
                className="w-full text-left p-1.5 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-[11px] border border-neutral-800 transition-colors"
              >
                {preset}
              </button>
            ))}
          </div>
          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            rows={3}
            placeholder="AIへの推敲指示を入力..."
            className="w-full bg-neutral-950 border border-neutral-700 rounded-md p-2 text-neutral-200 focus:outline-none focus:border-sky-500 mb-3"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsAiPromptOpen(false)}
              className="px-3 py-1 rounded text-neutral-400 hover:text-white"
            >
              閉じる
            </button>
            <button
              onClick={handleRunAi}
              className="px-3.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium shadow-sm"
            >
              推敲を開始
            </button>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {lastError && (
        <div className="bg-rose-950/90 border-b border-rose-800 text-rose-200 px-4 py-2 text-xs flex justify-between items-center">
          <span>{lastError}</span>
          <button onClick={() => useAiStore.setState({ lastError: null })} className="text-rose-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* AI Revision Banner / Diff View */}
      {isDiffOpen && (
        <div className="bg-sky-950/90 border-b border-sky-800/80 px-4 py-2.5 flex items-center justify-between z-10 text-xs">
          <div className="flex items-center gap-2 text-sky-200">
            <GitCompare className="w-4 h-4 text-sky-400" />
            <span>AI推敲提案のプレビュー中（採用すると現在のファイルに反映されます）</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={acceptRevision}
              className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded font-medium shadow-sm"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              推敲を採用
            </button>
            <button
              onClick={rejectRevision}
              className="flex items-center gap-1 bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 px-3 py-1 rounded font-medium"
            >
              <XCircle className="w-3.5 h-3.5" />
              却下
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

      {/* Editor Surface */}
      <div className="flex-1 overflow-hidden relative">
        <div ref={editorRef} className="h-full w-full overflow-y-auto" />
      </div>
    </div>
  );
}
