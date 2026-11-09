import { useState, useEffect, useRef, useCallback } from 'react';
import { useVaultStore, useEditorStore, useWorldGraphStore, useAiStore } from '../../store';
import {
  Compass,
  X,
  Minimize2,
  Maximize2,
  Save,
  Users,
  Sparkles,
  Check,
  RefreshCw,
  Loader2,
  Wand2,
  Layers,
  ArrowRight,
  GitBranch,
  GripHorizontal,
  CheckSquare,
  Square,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ListTodo,
  Edit3,
} from 'lucide-react';

interface FloatingPlotHudProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PlotTodoItem {
  id: string;
  text: string;
  completed: boolean;
}

// Parse markdown text into todo items
function parseTodosFromSynopsis(text: string): { todos: PlotTodoItem[]; nonTodoPrefix: string; nonTodoSuffix: string } {
  if (!text) return { todos: [], nonTodoPrefix: '', nonTodoSuffix: '' };
  const lines = text.split('\n');
  const todos: PlotTodoItem[] = [];
  const prefixLines: string[] = [];
  const suffixLines: string[] = [];

  let foundTodo = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(\s*[-*]\s*\[([ xX])\])\s*(.*)$/);
    if (match) {
      foundTodo = true;
      todos.push({
        id: `todo-${i}-${Math.random().toString(36).slice(2, 7)}`,
        completed: match[2].toLowerCase() === 'x',
        text: match[3].trim(),
      });
    } else {
      if (!foundTodo) {
        prefixLines.push(line);
      } else {
        suffixLines.push(line);
      }
    }
  }

  return {
    todos,
    nonTodoPrefix: prefixLines.join('\n'),
    nonTodoSuffix: suffixLines.join('\n'),
  };
}

// Serialize todos back into markdown synopsis
function serializeTodosToSynopsis(
  todos: PlotTodoItem[],
  prefix: string,
  suffix: string
): string {
  const todoLines = todos.map(
    (t) => `- [${t.completed ? 'x' : ' '}] ${t.text}`
  );
  const parts: string[] = [];
  if (prefix.trim()) parts.push(prefix.trim());
  if (todoLines.length > 0) parts.push(todoLines.join('\n'));
  if (suffix.trim()) parts.push(suffix.trim());
  return parts.join('\n\n');
}

export function FloatingPlotHud({ isOpen, onClose }: FloatingPlotHudProps) {
  const { vaultPath, activeFilePath } = useVaultStore();
  const { frontmatter, updateFrontmatterField, theme, body } = useEditorStore();
  const {
    overallPlot,
    saveOverallPlotText,
    sceneAnalysis,
    loadOverallPlot,
    syncManuscriptToWorldAction,
    isSyncingManuscript,
    syncResultNotice,
  } = useWorldGraphStore();
  const { generateBeats, expandDraft, isGeneratingBeats, isExpandingDraft } = useAiStore();

  const [activeTab, setActiveTab] = useState<'episode' | 'assistant' | 'overall' | 'characters'>('episode');
  const [synopsisMode, setSynopsisMode] = useState<'todo' | 'text'>('todo');
  const [isMinimized, setIsMinimized] = useState(false);
  const [localPlot, setLocalPlot] = useState(overallPlot);
  const [localSynopsis, setLocalSynopsis] = useState(frontmatter?.synopsis || '');
  const [isSavedNotice, setIsSavedNotice] = useState(false);

  // Todo list state
  const [todoList, setTodoList] = useState<PlotTodoItem[]>([]);
  const [nonTodoPrefix, setNonTodoPrefix] = useState('');
  const [nonTodoSuffix, setNonTodoSuffix] = useState('');
  const [newTodoInput, setNewTodoInput] = useState('');

  // Dragging state with GPU Direct Transform (useRef + translate3d)
  const hudRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const initialPos = (() => {
    try {
      const saved = localStorage.getItem('novel_studio_hud_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return {
            x: Math.min(Math.max(10, parsed.x), window.innerWidth - 300),
            y: Math.min(Math.max(10, parsed.y), window.innerHeight - 150),
          };
        }
      }
    } catch {
      // fallback
    }
    return {
      x: Math.max(20, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 450),
      y: 60,
    };
  })();
  const currentPosRef = useRef<{ x: number; y: number }>(initialPos);
  const [position, setPosition] = useState<{ x: number; y: number }>(initialPos);
  const dragStartOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Scene Beats & Draft Expansion state
  const [generatedBeats, setGeneratedBeats] = useState<string | null>(null);
  const [draftInstruction, setDraftInstruction] = useState('筋書きの展開に沿って、情景描写と登場人物の会話を自然に執筆・加筆してください。');

  const isSepia = theme === 'cream-sepia';

  useEffect(() => {
    if (vaultPath) {
      loadOverallPlot(vaultPath);
    }
  }, [vaultPath, loadOverallPlot]);

  useEffect(() => {
    setLocalPlot(overallPlot);
  }, [overallPlot]);

  // Sync localSynopsis and parse todos when frontmatter changes
  useEffect(() => {
    const syn = frontmatter?.synopsis || '';
    setLocalSynopsis(syn);
    const parsed = parseTodosFromSynopsis(syn);
    setTodoList(parsed.todos);
    setNonTodoPrefix(parsed.nonTodoPrefix);
    setNonTodoSuffix(parsed.nonTodoSuffix);
  }, [frontmatter?.synopsis]);

  // Save updated synopsis helper
  const commitSynopsisUpdate = useCallback((newText: string) => {
    setLocalSynopsis(newText);
    updateFrontmatterField({ synopsis: newText });
    useEditorStore.getState().save();
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 2000);
  }, [updateFrontmatterField]);

  // GPU Direct Pointer Dragging (120fps direct transform, zero React re-renders during drag)
  const handlePointerDown = (e: React.PointerEvent) => {
    // Only drag from header handle or empty header space
    if ((e.target as HTMLElement).closest('button, input, textarea')) return;
    isDraggingRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    dragStartOffset.current = {
      x: e.clientX - currentPosRef.current.x,
      y: e.clientY - currentPosRef.current.y,
    };

    if (hudRef.current) {
      hudRef.current.style.transition = 'none';
      hudRef.current.style.willChange = 'transform';
    }
    e.preventDefault();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;

    const hudWidth = isMinimized ? 160 : 420;
    const hudHeight = isMinimized ? 50 : 500;
    const maxX = Math.max(10, window.innerWidth - hudWidth - 10);
    const maxY = Math.max(10, window.innerHeight - hudHeight - 10);

    const nextX = Math.min(Math.max(10, e.clientX - dragStartOffset.current.x), maxX);
    const nextY = Math.min(Math.max(10, e.clientY - dragStartOffset.current.y), maxY);

    currentPosRef.current = { x: nextX, y: nextY };

    if (hudRef.current) {
      hudRef.current.style.transform = `translate3d(${nextX}px, ${nextY}px, 0)`;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    if (hudRef.current) {
      hudRef.current.style.willChange = 'auto';
    }

    const finalPos = currentPosRef.current;
    setPosition(finalPos);
    try {
      localStorage.setItem('novel_studio_hud_pos', JSON.stringify(finalPos));
    } catch {
      // ignore
    }
  };

  if (!isOpen) return null;

  // Todo operations
  const handleToggleTodo = (id: string) => {
    const updated = todoList.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t));
    setTodoList(updated);
    const newSynopsis = serializeTodosToSynopsis(updated, nonTodoPrefix, nonTodoSuffix);
    commitSynopsisUpdate(newSynopsis);
  };

  const handleAddTodo = () => {
    if (!newTodoInput.trim()) return;
    const newItem: PlotTodoItem = {
      id: `todo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: newTodoInput.trim(),
      completed: false,
    };
    const updated = [...todoList, newItem];
    setTodoList(updated);
    setNewTodoInput('');
    const newSynopsis = serializeTodosToSynopsis(updated, nonTodoPrefix, nonTodoSuffix);
    commitSynopsisUpdate(newSynopsis);
  };

  const handleDeleteTodo = (id: string) => {
    const updated = todoList.filter((t) => t.id !== id);
    setTodoList(updated);
    const newSynopsis = serializeTodosToSynopsis(updated, nonTodoPrefix, nonTodoSuffix);
    commitSynopsisUpdate(newSynopsis);
  };

  const handleMoveTodo = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= todoList.length) return;
    const copy = [...todoList];
    const temp = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = temp;
    setTodoList(copy);
    const newSynopsis = serializeTodosToSynopsis(copy, nonTodoPrefix, nonTodoSuffix);
    commitSynopsisUpdate(newSynopsis);
  };

  const handleConvertTextToTodos = () => {
    if (!localSynopsis.trim()) return;
    const lines = localSynopsis
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const newTodos: PlotTodoItem[] = lines.map((line, idx) => {
      // Strip leading bullet or number
      const cleaned = line.replace(/^[-*•\d+.]\s*/, '').replace(/^\[[ xX]\]\s*/, '');
      return {
        id: `todo-${Date.now()}-${idx}`,
        text: cleaned || line,
        completed: false,
      };
    });
    setTodoList(newTodos);
    setNonTodoPrefix('');
    setNonTodoSuffix('');
    const serialized = serializeTodosToSynopsis(newTodos, '', '');
    commitSynopsisUpdate(serialized);
    setSynopsisMode('todo');
  };

  const handleSaveOverall = async () => {
    if (!vaultPath) return;
    await saveOverallPlotText(vaultPath, localPlot);
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 2000);
  };

  const handleSaveSynopsisText = () => {
    commitSynopsisUpdate(localSynopsis);
  };

  // Phase 9: Sync manuscript entities to notes & World Graph
  const handleSyncToWorld = async () => {
    if (!vaultPath || !body) return;
    await syncManuscriptToWorldAction(vaultPath, body);
  };

  // Phase 9: Generate 3-5 structured scene beats
  const handleGenerateBeats = async () => {
    if (!vaultPath) return;
    const beats = await generateBeats(vaultPath, overallPlot, localSynopsis);
    if (beats) {
      setGeneratedBeats(beats);
    }
  };

  // Append generated beats as Todo items or text
  const handleAppendBeatsToSynopsis = () => {
    if (!generatedBeats) return;
    const beatLines = generatedBeats
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('【') && !l.startsWith('#'));

    if (beatLines.length > 0) {
      const newItems: PlotTodoItem[] = beatLines.map((line, i) => ({
        id: `beat-${Date.now()}-${i}`,
        text: line.replace(/^[-*•\d+.]\s*/, '').replace(/^\[[ xX]\]\s*/, ''),
        completed: false,
      }));
      const merged = [...todoList, ...newItems];
      setTodoList(merged);
      const newSynopsis = serializeTodosToSynopsis(merged, nonTodoPrefix, nonTodoSuffix);
      commitSynopsisUpdate(newSynopsis);
      setActiveTab('episode');
      setSynopsisMode('todo');
    } else {
      const newSynopsis = localSynopsis
        ? `${localSynopsis}\n\n${generatedBeats}`
        : generatedBeats;
      commitSynopsisUpdate(newSynopsis);
      setActiveTab('episode');
    }
  };

  // Phase 9: Expand scene draft into shadow branch & Inline Diff
  const handleExpandDraft = async () => {
    if (!vaultPath || !activeFilePath) return;
    await expandDraft(vaultPath, activeFilePath, overallPlot, localSynopsis, draftInstruction);
  };

  // Todo Completion Metrics
  const totalTodos = todoList.length;
  const completedTodos = todoList.filter((t) => t.completed).length;
  const completionPercent = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;

  // Minimized Floating Pill
  if (isMinimized) {
    return (
      <div
        ref={hudRef}
        style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
        className="fixed top-0 left-0 z-40 select-none animate-in fade-in"
      >
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-full border shadow-xl backdrop-blur-xl cursor-grab active:cursor-grabbing touch-none select-none ${
            isSepia
              ? 'bg-[#fbf9f5]/90 border-amber-900/20 text-amber-950 hover:bg-amber-100/90'
              : 'bg-[#1e1d1a]/90 border-amber-500/30 text-amber-300 hover:bg-[#282723]/95 shadow-amber-950/40'
          }`}
          title="掴んでドラッグ移動できます。クリックで展開"
        >
          <GripHorizontal className="w-3.5 h-3.5 opacity-40 shrink-0" />
          <Compass className="w-4 h-4 animate-spin-slow text-amber-500 shrink-0" />
          <span className="text-xs font-bold tracking-wide">
            筋書きHUD {totalTodos > 0 && `(${completedTodos}/${totalTodos})`}
          </span>
          <button
            onClick={() => setIsMinimized(false)}
            className="p-1 hover:opacity-100 opacity-60"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={hudRef}
      style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
      className="fixed top-0 left-0 z-40 w-[420px] max-w-[calc(100vw-2rem)] select-none animate-in fade-in"
    >
      <div
        className={`rounded-2xl border shadow-2xl backdrop-blur-2xl overflow-hidden flex flex-col ${
          isSepia
            ? 'bg-[#fcfbf9]/90 border-amber-900/20 text-neutral-800 shadow-amber-950/20'
            : 'bg-[#1b1a17]/95 border-amber-500/30 text-neutral-200 shadow-black/80 ring-1 ring-white/5'
        }`}
      >
        {/* HUD Window Header (Drag Handle with Pointer Capture) */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={`px-4 py-2.5 flex items-center justify-between border-b select-none cursor-grab active:cursor-grabbing touch-none ${
            isSepia ? 'border-amber-900/10 bg-amber-500/10' : 'border-neutral-800/80 bg-white/5'
          }`}
          title="ここを掴んで画面内の好きな場所にドラッグできます（120fps吸い付き追従）"
        >
          <div className="flex items-center gap-2 pointer-events-none">
            <div className="p-1 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold tracking-wide flex items-center gap-1.5">
                <span>筋書き・構成羅針盤 HUD</span>
                {isSavedNotice && (
                  <span className="text-[10px] text-emerald-500 flex items-center font-normal animate-pulse">
                    <Check className="w-3 h-3 mr-0.5" /> 保存済
                  </span>
                )}
              </div>
              <div className="text-[10px] opacity-60 flex items-center gap-1">
                <GripHorizontal className="w-3 h-3 opacity-40 inline" />
                <span>GPU Direct 120fps追従</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1 rounded-md opacity-60 hover:opacity-100 hover:bg-neutral-500/10 transition-colors"
              title="最小化"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-md opacity-60 hover:opacity-100 hover:bg-neutral-500/10 transition-colors"
              title="閉じる"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Global Action Bar: Bi-directional Manuscript to World Sync */}
        <div
          className={`px-3 py-1.5 border-b flex items-center justify-between text-xs transition-colors ${
            isSepia ? 'bg-amber-100/50 border-amber-900/10' : 'bg-amber-950/20 border-neutral-800/80'
          }`}
        >
          <div className="flex items-center gap-1.5 overflow-hidden">
            <RefreshCw
              className={`w-3 h-3 shrink-0 text-amber-500 ${isSyncingManuscript ? 'animate-spin' : ''}`}
            />
            <span className="text-[11px] truncate opacity-80">
              {syncResultNotice || '原稿の新キャラ・新設定を相関図に還元'}
            </span>
          </div>
          <button
            onClick={handleSyncToWorld}
            disabled={isSyncingManuscript || !body}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 shrink-0 transition-all ${
              isSepia
                ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-2xs'
                : 'bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold'
            } disabled:opacity-40`}
            title="原稿本文から未登録の登場人物・用語・関係性を自動抽出してノートとグラフDBに反映"
          >
            {isSyncingManuscript ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            <span>設定・相関図に還元</span>
          </button>
        </div>

        {/* Tab Controls */}
        <div className="grid grid-cols-4 p-1.5 gap-1 border-b text-xs border-inherit">
          <button
            onClick={() => setActiveTab('episode')}
            className={`py-1.5 px-1.5 rounded-lg font-medium text-center transition-all flex items-center justify-center gap-1 text-[11px] ${
              activeTab === 'episode'
                ? isSepia
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-500 text-neutral-950 font-semibold shadow-xs'
                : 'opacity-70 hover:opacity-100 hover:bg-neutral-500/10'
            }`}
          >
            <ListTodo className="w-3 h-3" />
            <span>話筋書き</span>
          </button>

          <button
            onClick={() => setActiveTab('assistant')}
            className={`py-1.5 px-1.5 rounded-lg font-medium text-center transition-all flex items-center justify-center gap-1 text-[11px] ${
              activeTab === 'assistant'
                ? isSepia
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-500 text-neutral-950 font-semibold shadow-xs'
                : 'opacity-70 hover:opacity-100 hover:bg-neutral-500/10'
            }`}
          >
            <Sparkles className="w-3 h-3 text-amber-300" />
            <span>展開支援</span>
          </button>

          <button
            onClick={() => setActiveTab('overall')}
            className={`py-1.5 px-1.5 rounded-lg font-medium text-center transition-all flex items-center justify-center gap-1 text-[11px] ${
              activeTab === 'overall'
                ? isSepia
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-500 text-neutral-950 font-semibold shadow-xs'
                : 'opacity-70 hover:opacity-100 hover:bg-neutral-500/10'
            }`}
          >
            <Compass className="w-3 h-3" />
            <span>全体構成</span>
          </button>

          <button
            onClick={() => setActiveTab('characters')}
            className={`py-1.5 px-1.5 rounded-lg font-medium text-center transition-all flex items-center justify-center gap-1 text-[11px] ${
              activeTab === 'characters'
                ? isSepia
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-500 text-neutral-950 font-semibold shadow-xs'
                : 'opacity-70 hover:opacity-100 hover:bg-neutral-500/10'
            }`}
          >
            <Users className="w-3 h-3" />
            <span>登場相関</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-3 max-h-[460px] overflow-y-auto space-y-3 text-xs leading-relaxed">
          {/* Tab 1: Episode Specific Plot with Interactive Todo Checklist */}
          {activeTab === 'episode' && (
            <div className="space-y-3">
              {/* Mode switch & Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-[11px] opacity-80">
                    本話プロット進行管理
                  </span>
                  <div className="flex items-center rounded-lg border border-neutral-500/20 p-0.5 text-[10px]">
                    <button
                      onClick={() => setSynopsisMode('todo')}
                      className={`px-2 py-0.5 rounded flex items-center gap-1 transition-all ${
                        synopsisMode === 'todo'
                          ? 'bg-amber-500 text-neutral-950 font-bold'
                          : 'opacity-60 hover:opacity-100'
                      }`}
                    >
                      <ListTodo className="w-3 h-3" />
                      <span>Todo</span>
                    </button>
                    <button
                      onClick={() => setSynopsisMode('text')}
                      className={`px-2 py-0.5 rounded flex items-center gap-1 transition-all ${
                        synopsisMode === 'text'
                          ? 'bg-amber-500 text-neutral-950 font-bold'
                          : 'opacity-60 hover:opacity-100'
                      }`}
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>テキスト</span>
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('assistant')}
                  className="text-[10px] text-amber-500 hover:underline flex items-center gap-1 font-semibold"
                >
                  <Wand2 className="w-3 h-3" />
                  <span>AIビート展開</span>
                </button>
              </div>

              {/* Progress Bar (Todo Mode) */}
              {totalTodos > 0 && (
                <div
                  className={`p-2.5 rounded-xl border space-y-1.5 ${
                    isSepia ? 'bg-amber-50/80 border-amber-900/10' : 'bg-neutral-900/80 border-neutral-800'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <CheckSquare className="w-3.5 h-3.5" />
                      プロット達成率
                    </span>
                    <span className="font-bold">
                      {completedTodos} / {totalTodos} 完了 ({completionPercent}%)
                    </span>
                  </div>
                  <div className="w-full bg-neutral-500/20 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${completionPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Todo Interactive List View */}
              {synopsisMode === 'todo' ? (
                <div className="space-y-2">
                  {todoList.length === 0 ? (
                    <div
                      className={`p-4 rounded-xl border text-center space-y-2 ${
                        isSepia ? 'bg-white/60 border-amber-900/10' : 'bg-[#131210]/60 border-neutral-800'
                      }`}
                    >
                      <p className="text-[11px] opacity-70">
                        プロット項目がまだTodo化されていません。
                      </p>
                      {localSynopsis.trim().length > 0 ? (
                        <button
                          onClick={handleConvertTextToTodos}
                          className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-2xs"
                        >
                          既存テキストを行ごとにTodo化
                        </button>
                      ) : (
                        <button
                          onClick={() => setActiveTab('assistant')}
                          className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-2xs"
                        >
                          AIにシーンビートを自動生成させる
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {todoList.map((todo, idx) => (
                        <div
                          key={todo.id}
                          className={`p-2 rounded-xl border flex items-center justify-between gap-2 group transition-all ${
                            todo.completed
                              ? isSepia
                                ? 'bg-emerald-50/50 border-emerald-900/10 opacity-70'
                                : 'bg-emerald-950/20 border-emerald-800/30 opacity-60'
                              : isSepia
                              ? 'bg-white/90 border-amber-900/15 shadow-2xs'
                              : 'bg-[#201f1c] border-neutral-700/80 shadow-2xs'
                          }`}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <button
                              onClick={() => handleToggleTodo(todo.id)}
                              className="text-amber-500 hover:scale-110 transition-transform shrink-0"
                            >
                              {todo.completed ? (
                                <CheckSquare className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <Square className="w-4 h-4 opacity-60" />
                              )}
                            </button>
                            <span
                              className={`text-xs break-words select-text ${
                                todo.completed ? 'line-through text-neutral-500' : 'font-medium'
                              }`}
                            >
                              {todo.text}
                            </span>
                          </div>

                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button
                              onClick={() => handleMoveTodo(idx, 'up')}
                              disabled={idx === 0}
                              className="p-1 rounded hover:bg-neutral-500/20 disabled:opacity-20"
                              title="上へ"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleMoveTodo(idx, 'down')}
                              disabled={idx === todoList.length - 1}
                              className="p-1 rounded hover:bg-neutral-500/20 disabled:opacity-20"
                              title="下へ"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteTodo(todo.id)}
                              className="p-1 rounded hover:bg-rose-500/20 text-rose-500"
                              title="削除"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add New Todo Form */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <input
                      type="text"
                      value={newTodoInput}
                      onChange={(e) => setNewTodoInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
                      placeholder="新しいプロット項目を追加... (Enter)"
                      className={`flex-1 p-2 rounded-xl text-xs outline-none border transition-all ${
                        isSepia
                          ? 'bg-white/90 border-amber-900/20 focus:border-amber-600 text-neutral-900'
                          : 'bg-[#131210]/90 border-neutral-700/80 focus:border-amber-400 text-neutral-100'
                      }`}
                    />
                    <button
                      onClick={handleAddTodo}
                      disabled={!newTodoInput.trim()}
                      className="px-3 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-40 transition-all flex items-center gap-1 shrink-0 shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>追加</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Raw Text Mode */
                <div className="space-y-2">
                  <textarea
                    value={localSynopsis}
                    onChange={(e) => setLocalSynopsis(e.target.value)}
                    placeholder="このエピソードで下人が直面する葛藤、転換点、結末など... (- [ ] でTodo化可能)"
                    rows={6}
                    className={`w-full p-2.5 rounded-xl text-xs resize-none outline-none border transition-all ${
                      isSepia
                        ? 'bg-white/90 border-amber-900/20 focus:border-amber-600 text-neutral-900'
                        : 'bg-[#131210]/90 border-neutral-700/80 focus:border-amber-400 text-neutral-100'
                    }`}
                  />
                  <div className="flex items-center justify-between">
                    <button
                      onClick={handleConvertTextToTodos}
                      className="text-[10px] text-amber-500 hover:underline flex items-center gap-1"
                    >
                      <ListTodo className="w-3 h-3" />
                      <span>チェックリスト形式に変換</span>
                    </button>
                    <button
                      onClick={handleSaveSynopsisText}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-xs transition-all"
                    >
                      <Save className="w-3 h-3" />
                      <span>テキストを保存</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Frontmatter quick facts */}
              <div
                className={`p-2.5 rounded-xl border text-[11px] space-y-1 ${
                  isSepia ? 'bg-amber-500/5 border-amber-900/10' : 'bg-white/5 border-white/5'
                }`}
              >
                <div className="flex justify-between">
                  <span className="opacity-60">視点 (POV):</span>
                  <span className="font-semibold">{frontmatter?.pov || '未設定'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-60">舞台 (Location):</span>
                  <span className="font-semibold">{frontmatter?.location || '未設定'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-60">時間軸:</span>
                  <span className="font-semibold">{frontmatter?.timeline || '未設定'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Scene Beats & Draft Expansion Assistant */}
          {activeTab === 'assistant' && (
            <div className="space-y-4">
              {/* Feature 1: Scene Beats Generator */}
              <div
                className={`p-3 rounded-xl border space-y-2.5 ${
                  isSepia ? 'bg-white/80 border-amber-900/15' : 'bg-[#151412]/80 border-neutral-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-amber-600 dark:text-amber-400">
                    <Layers className="w-3.5 h-3.5" />
                    <span>① 起承転結シーンビート提案</span>
                  </div>
                  <button
                    onClick={handleGenerateBeats}
                    disabled={isGeneratingBeats || !vaultPath}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-2xs disabled:opacity-40 transition-all"
                  >
                    {isGeneratingBeats ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                    <span>{isGeneratingBeats ? 'ビート構成中...' : 'ビートを自動生成'}</span>
                  </button>
                </div>

                <p className="text-[10px] opacity-70">
                  全体構成と話筋書き、世界観設定を統合し、3〜5個の具体的なシーン展開ビートを提案します。
                </p>

                {generatedBeats ? (
                  <div className="space-y-2">
                    <div
                      className={`p-2.5 rounded-lg border text-[11px] whitespace-pre-wrap max-h-36 overflow-y-auto leading-relaxed font-mono ${
                        isSepia ? 'bg-amber-50/70 border-amber-900/10' : 'bg-neutral-900/80 border-neutral-700/60'
                      }`}
                    >
                      {generatedBeats}
                    </div>
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={handleAppendBeatsToSynopsis}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-2xs"
                      >
                        <Check className="w-3 h-3" />
                        <span>Todoプロットに追加反映</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-[10px] opacity-40 text-center py-2 border border-dashed border-neutral-500/20 rounded-lg">
                    「ビートを自動生成」を押すとシーン展開案がここに表示されます
                  </div>
                )}
              </div>

              {/* Feature 2: Draft Expansion & Revision Bridge */}
              <div
                className={`p-3 rounded-xl border space-y-2.5 ${
                  isSepia ? 'bg-white/80 border-amber-900/15' : 'bg-[#151412]/80 border-neutral-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-amber-600 dark:text-amber-400">
                    <GitBranch className="w-3.5 h-3.5" />
                    <span>② 本文への推敲・加筆ブリッジ</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 font-mono">
                    Shadow Diff
                  </span>
                </div>

                <p className="text-[10px] opacity-70">
                  筋書きに沿って原稿の続きや描写強化をAIが下書きし、シャドウブランチのInline Diff（採用/却下）へ直接送ります。
                </p>

                <div>
                  <label className="text-[10px] font-semibold block mb-1 opacity-70">
                    加筆・展開の指示:
                  </label>
                  <textarea
                    value={draftInstruction}
                    onChange={(e) => setDraftInstruction(e.target.value)}
                    rows={3}
                    className={`w-full p-2 rounded-lg text-[11px] resize-none outline-none border transition-all ${
                      isSepia
                        ? 'bg-white/90 border-amber-900/20 focus:border-amber-600 text-neutral-900'
                        : 'bg-[#131210]/90 border-neutral-700/80 focus:border-amber-400 text-neutral-100'
                    }`}
                  />
                </div>

                <button
                  onClick={handleExpandDraft}
                  disabled={isExpandingDraft || !vaultPath || !activeFilePath}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white shadow-xs disabled:opacity-40 transition-all"
                >
                  {isExpandingDraft ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ArrowRight className="w-3.5 h-3.5" />
                  )}
                  <span>{isExpandingDraft ? '下書きを生成中...' : '下書きを展開してDiff比較へ'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Tab 3: Overall Plot Markdown */}
          {activeTab === 'overall' && (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold opacity-70">
                    全編筋書き構成（.novelstudio/notes/plot.md）
                  </label>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 font-mono">
                    Graph同期
                  </span>
                </div>
                <textarea
                  value={localPlot}
                  onChange={(e) => setLocalPlot(e.target.value)}
                  placeholder="# 全体筋書き..."
                  rows={8}
                  className={`w-full p-2.5 rounded-xl text-xs font-mono resize-none outline-none border transition-all ${
                    isSepia
                      ? 'bg-white/90 border-amber-900/20 focus:border-amber-600 text-neutral-900'
                      : 'bg-[#131210]/90 border-neutral-700/80 focus:border-amber-400 text-neutral-100'
                  }`}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[10px] opacity-50">保存時に世界観グラフへ自動同期</span>
                <button
                  onClick={handleSaveOverall}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-xs transition-all"
                >
                  <Save className="w-3 h-3" />
                  <span>筋書きを保存＆同期</span>
                </button>
              </div>
            </div>
          )}

          {/* Tab 4: Active Scene Character / Rule Digest */}
          {activeTab === 'characters' && (
            <div className="space-y-3">
              <div className="text-[11px] font-bold opacity-70 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>現シーンで検知された設定要素</span>
              </div>

              {sceneAnalysis && sceneAnalysis.active_nodes.length > 0 ? (
                <div className="space-y-2">
                  {sceneAnalysis.active_nodes.map((node) => (
                    <div
                      key={node.id}
                      className={`p-2.5 rounded-xl border text-xs transition-all ${
                        isSepia
                          ? 'bg-white/80 border-amber-900/15 shadow-2xs'
                          : 'bg-[#22211e]/90 border-neutral-800 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-amber-600 dark:text-amber-400">
                          {node.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-500/15 uppercase font-mono">
                          {node.node_type}
                        </span>
                      </div>
                      <p className="text-[11px] opacity-80 leading-relaxed mb-1.5">
                        {node.summary || '説明なし'}
                      </p>
                      {Object.keys(node.attributes).length > 0 && (
                        <div className="flex flex-wrap gap-1 text-[10px]">
                          {Object.entries(node.attributes).map(([k, v]) => (
                            <span
                              key={k}
                              className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300"
                            >
                              {k}: {v}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center opacity-50 text-xs">
                  原稿内に対象人物または用語が検知されていません
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
