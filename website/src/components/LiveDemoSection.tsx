import React, { useState, useRef } from 'react';
import {
  FileText,
  Compass,
  Share2,
  Sparkles,
  Columns,
  CheckSquare,
  Square,
  Check,
  X,
  GripHorizontal,
  ArrowRight,
  Maximize2,
  Calendar,
  Layers,
} from 'lucide-react';

interface LiveDemoSectionProps {
  isAwakened: boolean;
  onInteract: () => void;
}

// Demo Todo beats
interface DemoTodo {
  id: string;
  text: string;
  completed: boolean;
}

export const LiveDemoSection: React.FC<LiveDemoSectionProps> = ({
  isAwakened,
  onInteract,
}) => {
  const [activeDemoTab, setActiveDemoTab] = useState<'editor' | 'plot' | 'graph' | 'ai'>('editor');

  // Tab 1: Editor State
  const [manuscriptText, setManuscriptText] = useState<string>(
    'ある日の暮方の事である。一人の｜下人《げにん》が、｜羅生門《らしょうもん》の下で雨やみを待っていた。\n\n広い門の下には、この男のほかに誰もいない。ただ、所々｜丹塗《にぬり》の剥げた、大きな円柱に、螽斯が一匹とまっている。\n\n私は、どこへ行こうか途方に暮れていた。'
  );
  const [isVertical, setIsVertical] = useState(false);

  // Tab 2: Floating Plot HUD State (GPU Direct Pointer Dragging)
  const hudRef = useRef<HTMLDivElement | null>(null);
  const isDraggingHudRef = useRef(false);
  const hudOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hudPos, setHudPos] = useState<{ x: number; y: number }>({ x: 420, y: 40 });
  const [todos, setTodos] = useState<DemoTodo[]>([
    { id: '1', text: '雨宿りする下人の焦燥と無力感を描く', completed: true },
    { id: '2', text: '羅生門の荒廃と死体累々の情景描写', completed: true },
    { id: '3', text: '楼上に揺らめく松明の火を発見する', completed: true },
    { id: '4', text: '老婆の死体抜毛を目撃し激しい怒りを覚える', completed: false },
    { id: '5', text: '生きるための悪を自覚し着物を奪い闇へ消える', completed: false },
  ]);

  // Tab 3: Timeline & Graph State
  const [graphPhase, setGraphPhase] = useState<'ep1' | 'ep2'>('ep1');
  const [plotNodePos, setPlotNodePos] = useState<{ x: number; y: number }>({ x: 300, y: 160 });
  const isDraggingNodeRef = useRef(false);
  const nodeOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Tab 4: AI Inline Diff State
  const [showDiff, setShowDiff] = useState(false);
  const [isDiffApplied, setIsDiffApplied] = useState(false);

  // Todo Completion Metrics
  const completedCount = todos.filter((t) => t.completed).length;
  const progressPercent = Math.round((completedCount / todos.length) * 100);

  // Pointer dragging for HUD
  const handleHudPointerDown = (e: React.PointerEvent) => {
    onInteract();
    if ((e.target as HTMLElement).closest('button, input')) return;
    isDraggingHudRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    hudOffsetRef.current = {
      x: e.clientX - hudPos.x,
      y: e.clientY - hudPos.y,
    };
    if (hudRef.current) {
      hudRef.current.style.transition = 'none';
    }
  };

  const handleHudPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingHudRef.current) return;
    const nextX = Math.min(Math.max(10, e.clientX - hudOffsetRef.current.x), 520);
    const nextY = Math.min(Math.max(10, e.clientY - hudOffsetRef.current.y), 240);
    if (hudRef.current) {
      hudRef.current.style.transform = `translate3d(${nextX}px, ${nextY}px, 0)`;
    }
  };

  const handleHudPointerUp = (e: React.PointerEvent) => {
    if (!isDraggingHudRef.current) return;
    isDraggingHudRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    if (hudRef.current) {
      const match = hudRef.current.style.transform.match(/translate3d\(([\d.-]+)px,\s*([\d.-]+)px/);
      if (match) {
        setHudPos({ x: parseFloat(match[1]), y: parseFloat(match[2]) });
      }
    }
  };

  // Helper to parse ruby into HTML
  const renderRubyHtml = (text: string) => {
    // ｜親文字《ルビ》
    let html = text.replace(/｜([^《\n\r]+)《([^》\n\r]+)》/g, '<ruby>$1<rt>$2</rt></ruby>');
    // 《《傍点》》
    html = html.replace(/《《([^》\n\r]+)》》/g, '<span class="underline decoration-dotted underline-offset-4 font-bold text-amber-400">$1</span>');
    return html.replace(/\n/g, '<br/>');
  };

  return (
    <section id="live-demo" className="relative py-20 px-4 sm:px-8 max-w-6xl mx-auto">
      {/* Section Header */}
      <div className="text-center space-y-4 mb-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold border border-neutral-700 bg-neutral-900/60 text-neutral-300">
          <Sparkles className={`w-3.5 h-3.5 color-transition ${isAwakened ? 'text-amber-400' : 'text-neutral-400'}`} />
          <span>Interactive Live Studio</span>
        </div>
        <h2 className="font-shippori text-3xl sm:text-4xl font-bold tracking-tight">
          ブラウザ上で触れる、次世代の執筆体験
        </h2>
        <p className="text-sm sm:text-base text-neutral-400 max-w-xl mx-auto">
          ダウンロード前に、NovelStudio の核心機能をそのまま体験できます。
        </p>
      </div>

      {/* Main Studio Frame */}
      <div
        className={`rounded-3xl border shadow-2xl overflow-hidden color-transition flex flex-col ${
          isAwakened
            ? 'bg-[#181715]/95 border-amber-500/30 shadow-amber-950/20 ring-1 ring-amber-500/20'
            : 'bg-[#141414] border-neutral-800 shadow-black'
        }`}
      >
        {/* Studio Window Header Bar */}
        <div className="px-5 py-3 border-b border-inherit flex items-center justify-between select-none bg-neutral-900/40">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
            <span className="ml-3 text-xs font-mono opacity-50 tracking-wide">NovelStudio — Episode 1: 羅生門.md</span>
          </div>

          {/* Interactive Feature Switcher Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-black/40 border border-neutral-800 text-xs">
            <button
              onClick={() => {
                setActiveDemoTab('editor');
                onInteract();
              }}
              className={`px-3 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                activeDemoTab === 'editor'
                  ? isAwakened
                    ? 'bg-amber-500 text-neutral-950 font-bold shadow-xs'
                    : 'bg-white text-black font-bold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Zen執筆・縦書き</span>
            </button>

            <button
              onClick={() => {
                setActiveDemoTab('plot');
                onInteract();
              }}
              className={`px-3 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                activeDemoTab === 'plot'
                  ? isAwakened
                    ? 'bg-amber-500 text-neutral-950 font-bold shadow-xs'
                    : 'bg-white text-black font-bold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>吸い付くTodo筋書きHUD</span>
            </button>

            <button
              onClick={() => {
                setActiveDemoTab('graph');
                onInteract();
              }}
              className={`px-3 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                activeDemoTab === 'graph'
                  ? isAwakened
                    ? 'bg-amber-500 text-neutral-950 font-bold shadow-xs'
                    : 'bg-white text-black font-bold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>時系列・伏線相関図</span>
            </button>

            <button
              onClick={() => {
                setActiveDemoTab('ai');
                onInteract();
              }}
              className={`px-3 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                activeDemoTab === 'ai'
                  ? isAwakened
                    ? 'bg-amber-500 text-neutral-950 font-bold shadow-xs'
                    : 'bg-white text-black font-bold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>GraphRAG推敲</span>
            </button>
          </div>
        </div>

        {/* Studio Viewport Area */}
        <div className="relative min-h-[460px] p-6 flex flex-col justify-between">
          {/* TAB 1: Zen Writing & Vertical Japanese Preview */}
          {activeDemoTab === 'editor' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                <span className="text-xs font-semibold opacity-75">
                  ルビ構文（｜親文字《ルビ》）とリアルタイムプレビュー
                </span>
                <button
                  onClick={() => setIsVertical(!isVertical)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                    isVertical
                      ? 'bg-amber-500 text-neutral-950 border-amber-400'
                      : 'border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-neutral-500'
                  }`}
                >
                  <Columns className="w-3.5 h-3.5" />
                  <span>{isVertical ? '横書きに戻す' : '原稿用紙 縦書きプレビュー'}</span>
                </button>
              </div>

              {isVertical ? (
                /* Vertical Preview Mode */
                <div className="h-[360px] p-8 rounded-2xl bg-[#f7f3e9] text-[#2c2724] border border-amber-900/15 overflow-x-auto flex flex-row-reverse justify-start shadow-inner">
                  <div
                    className="writing-vertical font-shippori text-lg leading-[2.6] tracking-widest h-full select-text"
                    dangerouslySetInnerHTML={{ __html: renderRubyHtml(manuscriptText) }}
                  />
                </div>
              ) : (
                /* Editor Mode */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[360px]">
                  <div className="flex flex-col space-y-1.5">
                    <span className="text-[11px] font-mono text-neutral-500">入力原稿エディタ（編集可能）:</span>
                    <textarea
                      value={manuscriptText}
                      onChange={(e) => {
                        setManuscriptText(e.target.value);
                        onInteract();
                      }}
                      className="flex-1 w-full p-4 rounded-xl bg-black/40 border border-neutral-800 text-xs font-mono leading-relaxed outline-none focus:border-amber-500 transition-colors resize-none"
                    />
                  </div>

                  <div className="flex flex-col space-y-1.5">
                    <span className="text-[11px] font-mono text-neutral-500">ルビ・傍点レンダリング結果:</span>
                    <div
                      className="flex-1 p-5 rounded-xl bg-neutral-900/40 border border-neutral-800 text-sm font-noto-serif leading-loose overflow-y-auto"
                      dangerouslySetInnerHTML={{ __html: renderRubyHtml(manuscriptText) }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Todo Plot HUD with 120fps Dragging */}
          {activeDemoTab === 'plot' && (
            <div className="relative h-[420px] rounded-2xl bg-black/30 border border-neutral-800 overflow-hidden p-4">
              <div className="absolute top-3 left-4 text-xs opacity-50 flex items-center gap-1.5">
                <GripHorizontal className="w-3.5 h-3.5" />
                <span>筋書きHUDのヘッダーを掴んで画面内をドラッグしてください（120fps吸い付き追従）</span>
              </div>

              {/* Draggable HUD Window */}
              <div
                ref={hudRef}
                style={{ transform: `translate3d(${hudPos.x}px, ${hudPos.y}px, 0)` }}
                className="absolute top-0 left-0 w-[360px] rounded-2xl border shadow-2xl backdrop-blur-2xl overflow-hidden select-none touch-none bg-[#1c1b18]/95 border-amber-500/30 text-neutral-200"
              >
                {/* Header / Drag Handle */}
                <div
                  onPointerDown={handleHudPointerDown}
                  onPointerMove={handleHudPointerMove}
                  onPointerUp={handleHudPointerUp}
                  className="px-4 py-2.5 border-b border-neutral-800 bg-white/5 flex items-center justify-between cursor-grab active:cursor-grabbing"
                >
                  <div className="flex items-center gap-2 pointer-events-none">
                    <Compass className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-bold">筋書き羅針盤 HUD</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                    <Check className="w-3 h-3" /> 同期中
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="p-3 border-b border-neutral-800 space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-amber-400 font-semibold flex items-center gap-1">
                      <CheckSquare className="w-3.5 h-3.5" />
                      プロット達成率
                    </span>
                    <span className="font-bold">
                      {completedCount} / {todos.length} ({progressPercent}%)
                    </span>
                  </div>
                  <div className="w-full bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-amber-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Todo List Items */}
                <div className="p-2 space-y-1.5 max-h-56 overflow-y-auto">
                  {todos.map((todo) => (
                    <div
                      key={todo.id}
                      onClick={() => {
                        onInteract();
                        setTodos(
                          todos.map((t) => (t.id === todo.id ? { ...t, completed: !t.completed } : t))
                        );
                      }}
                      className={`p-2 rounded-xl border flex items-center gap-2.5 text-xs cursor-pointer transition-colors ${
                        todo.completed
                          ? 'bg-emerald-950/20 border-emerald-800/30 opacity-60'
                          : 'bg-[#22211e] border-neutral-700 hover:border-amber-500/50'
                      }`}
                    >
                      {todo.completed ? (
                        <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-neutral-500 shrink-0" />
                      )}
                      <span className={todo.completed ? 'line-through text-neutral-500' : 'font-medium'}>
                        {todo.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Multi-phase & Foreshadowing Diamond Graph */}
          {activeDemoTab === 'graph' && (
            <div className="relative h-[420px] rounded-2xl bg-black/40 border border-neutral-800 overflow-hidden flex flex-col p-4">
              {/* Phase Switcher Bar */}
              <div className="flex items-center justify-between pb-3 border-b border-neutral-800 text-xs">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-amber-500" />
                  <span className="font-semibold text-neutral-300">時系列フェーズ:</span>
                  <div className="flex rounded-lg bg-neutral-900 border border-neutral-800 p-0.5">
                    <button
                      onClick={() => {
                        setGraphPhase('ep1');
                        onInteract();
                      }}
                      className={`px-3 py-1 rounded-md transition-all ${
                        graphPhase === 'ep1'
                          ? 'bg-amber-500 text-neutral-950 font-bold'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      第1話: 雨やみ待ち
                    </button>
                    <button
                      onClick={() => {
                        setGraphPhase('ep2');
                        onInteract();
                      }}
                      className={`px-3 py-1 rounded-md transition-all ${
                        graphPhase === 'ep2'
                          ? 'bg-amber-500 text-neutral-950 font-bold'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      第2話: 楼上の死闘
                    </button>
                  </div>
                </div>

                <span className="text-[11px] opacity-60">◆ ダイヤモンド伏線ノードをドラッグできます</span>
              </div>

              {/* SVG Visual Graph Canvas */}
              <div className="flex-1 relative flex items-center justify-center">
                <svg viewBox="0 0 600 320" className="w-full h-full select-none">
                  {/* Bottom Location Stage Zone */}
                  <rect
                    x="20"
                    y="230"
                    width="560"
                    height="75"
                    rx="12"
                    fill="#1e1a14"
                    stroke="#78350f"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    opacity="0.6"
                  />
                  <text x="35" y="250" fontSize="10" fontWeight="bold" fill="#f59e0b" opacity="0.8">
                    🗺️ 舞台・場所レイヤー（下層ステージ）
                  </text>

                  {/* Location Nodes */}
                  <g transform="translate(180, 275)">
                    <circle r="18" fill="#14261d" stroke="#10b981" strokeWidth="2" />
                    <text y="3" textAnchor="middle" fontSize="10" fill="#a7f3d0">
                      羅生門下
                    </text>
                  </g>
                  <g transform="translate(420, 275)">
                    <circle r="18" fill="#14261d" stroke="#10b981" strokeWidth="2" />
                    <text y="3" textAnchor="middle" fontSize="10" fill="#a7f3d0">
                      楼上（死体置場）
                    </text>
                  </g>

                  {/* Character Nodes */}
                  <g transform={graphPhase === 'ep1' ? 'translate(140, 90)' : 'translate(200, 90)'}>
                    <circle r="22" fill="#291b0f" stroke="#d97706" strokeWidth="2.5" />
                    <text y="4" textAnchor="middle" fontSize="12" fill="#fde68a" fontWeight="bold">
                      下人
                    </text>
                    <text y="36" textAnchor="middle" fontSize="10" fill="#d97706">
                      一人称: おれ
                    </text>
                  </g>

                  <g transform={graphPhase === 'ep1' ? 'translate(460, 90)' : 'translate(400, 90)'}>
                    <circle r="22" fill="#291b0f" stroke="#d97706" strokeWidth="2.5" />
                    <text y="4" textAnchor="middle" fontSize="12" fill="#fde68a" fontWeight="bold">
                      老婆
                    </text>
                    <text y="36" textAnchor="middle" fontSize="10" fill="#d97706">
                      抜毛の正当化
                    </text>
                  </g>

                  {/* Connecting Lines through Foreshadowing Diamond */}
                  <line
                    x1={graphPhase === 'ep1' ? 140 : 200}
                    y1="90"
                    x2={plotNodePos.x}
                    y2={plotNodePos.y}
                    stroke="#f43f5e"
                    strokeWidth="2"
                    strokeDasharray="4 3"
                  />
                  <line
                    x1={plotNodePos.x}
                    y1={plotNodePos.y}
                    x2={graphPhase === 'ep1' ? 460 : 400}
                    y2="90"
                    stroke="#f43f5e"
                    strokeWidth="2"
                    strokeDasharray="4 3"
                  />

                  {/* Foreshadowing Diamond Node (Interactive Draggable) */}
                  <g
                    transform={`translate(${plotNodePos.x}, ${plotNodePos.y})`}
                    className="cursor-grab active:cursor-grabbing"
                    onPointerDown={(e) => {
                      onInteract();
                      isDraggingNodeRef.current = true;
                      (e.currentTarget as Element).setPointerCapture(e.pointerId);
                      nodeOffsetRef.current = {
                        x: e.clientX - plotNodePos.x,
                        y: e.clientY - plotNodePos.y,
                      };
                    }}
                    onPointerMove={(e) => {
                      if (!isDraggingNodeRef.current) return;
                      const nextX = Math.min(Math.max(60, e.clientX - nodeOffsetRef.current.x), 540);
                      const nextY = Math.min(Math.max(50, e.clientY - nodeOffsetRef.current.y), 200);
                      setPlotNodePos({ x: nextX, y: nextY });
                    }}
                    onPointerUp={(e) => {
                      isDraggingNodeRef.current = false;
                      try {
                        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
                      } catch {
                        // ignore
                      }
                    }}
                  >
                    <polygon
                      points="0,-24 24,0 0,24 -24,0"
                      fill="#2a1217"
                      stroke="#f43f5e"
                      strokeWidth="2.5"
                    />
                    <text y="4" textAnchor="middle" fontSize="10" fill="#fecdd3" fontWeight="bold">
                      ◆ 悪への覚醒
                    </text>
                    <text y="38" textAnchor="middle" fontSize="9" fill="#f43f5e" fontWeight="bold">
                      伏線リレーション
                    </text>
                  </g>
                </svg>
              </div>
            </div>
          )}

          {/* TAB 4: AI GraphRAG Consistency Lint & Inline Diff */}
          {activeDemoTab === 'ai' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                <span className="text-xs font-semibold opacity-75">
                  KùzuDB グラフ知識（一人称：おれ）に基づく自律推敲 ＆ Inline Diff
                </span>
                <button
                  onClick={() => {
                    setShowDiff(true);
                    onInteract();
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-neutral-950 flex items-center gap-1.5 shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI推敲を実行</span>
                </button>
              </div>

              {showDiff ? (
                <div className="space-y-3 p-4 rounded-2xl bg-black/40 border border-neutral-800 animate-in fade-in">
                  <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-950/20 text-xs flex items-center justify-between">
                    <div className="space-y-1">
                      <span className="font-bold text-rose-400">⚠️ 知識グラフ設定との一人称矛盾を検知:</span>
                      <p className="text-neutral-300">
                        設定ノート「下人」の一人称は「おれ」ですが、第3段落で「私」が使用されています。
                      </p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono">
                      GraphRAG Lint
                    </span>
                  </div>

                  {/* Inline Diff Preview */}
                  <div className="p-4 rounded-xl border border-neutral-800 bg-[#161513] text-sm font-noto-serif leading-relaxed">
                    <p className="opacity-80">
                      広い門の下には、この男のほかに誰もいない。ただ、所々丹塗の剥げた、大きな円柱に、螽斯が一匹とまっている。
                    </p>
                    <div className="mt-2 p-2 rounded-lg bg-neutral-900 border border-neutral-800 font-mono text-xs space-y-1">
                      <div className="text-rose-400 line-through">
                        - 私は、どこへ行こうか途方に暮れていた。
                      </div>
                      <div className="text-emerald-400 font-bold">
                        + おれは、どこへ行こうか途方に暮れていた。
                      </div>
                    </div>
                  </div>

                  {/* Action Accept / Reject */}
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setShowDiff(false)}
                      className="px-3 py-1.5 rounded-xl text-xs border border-neutral-700 hover:bg-neutral-800 text-neutral-400 flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>却下</span>
                    </button>
                    <button
                      onClick={() => {
                        setManuscriptText(
                          manuscriptText.replace('私は、どこへ行こうか', 'おれは、どこへ行こうか')
                        );
                        setIsDiffApplied(true);
                        setShowDiff(false);
                        onInteract();
                      }}
                      className="px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>本文へ採用（差分コミット）</span>
                    </button>
                  </div>
                </div>
              ) : isDiffApplied ? (
                <div className="p-8 text-center space-y-2 border border-dashed border-emerald-500/30 rounded-2xl bg-emerald-950/10">
                  <Check className="w-8 h-8 text-emerald-400 mx-auto" />
                  <p className="text-sm font-bold text-emerald-300">差分を本文へ反映しました！</p>
                  <p className="text-xs opacity-60">「Zen執筆・縦書き」タブで修正後の原稿を確認できます。</p>
                </div>
              ) : (
                <div className="p-12 text-center space-y-2 border border-dashed border-neutral-800 rounded-2xl opacity-60">
                  <Sparkles className="w-6 h-6 text-amber-500 mx-auto" />
                  <p className="text-sm">右上の「AI推敲を実行」ボタンを押すと、知識グラフと連動した推敲が走ります。</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
