import { useState } from 'react';
import { useEditorStore, useWorldGraphStore } from '../../store';
import { SceneStatus } from '../../lib/tauri-commands';
import {
  FileSpreadsheet,
  Clock,
  BookOpen,
  User,
  Calendar,
  MapPin,
  Sparkles,
  Target,
  Lightbulb,
  Share2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';

export function Inspector() {
  const {
    metrics,
    lintIssues,
    frontmatter,
    targetCharCount,
    theme,
    changeStatus,
    updateFrontmatterField,
  } = useEditorStore();

  const { sceneAnalysis, graphData } = useWorldGraphStore();

  const [activeTab, setActiveTab] = useState<'metrics' | 'world' | 'scene' | 'hints'>('world');
  const isSepia = theme === 'cream-sepia';

  const progressPercent = Math.min(
    100,
    Math.round((metrics.chars_without_whitespace / (targetCharCount || 1)) * 100)
  );

  const activeNodes = sceneAnalysis?.active_nodes || [];
  const activeEdges = sceneAnalysis?.active_edges || [];
  const consistencyHints = sceneAnalysis?.consistency_hints || [];

  return (
    <aside
      className={`w-80 h-full flex flex-col select-none border-l transition-colors ${
        isSepia
          ? 'bg-[#f6f2ea] border-amber-900/10 text-neutral-800'
          : 'bg-[#181816] border-[#2c2a27] text-neutral-200'
      }`}
    >
      {/* Tab Switcher */}
      <div
        className={`flex border-b text-[11px] ${
          isSepia ? 'border-amber-900/10 bg-amber-50/50' : 'border-[#2c2a27] bg-[#1c1b19]'
        }`}
      >
        <button
          onClick={() => setActiveTab('world')}
          className={`flex-1 py-2.5 font-semibold flex items-center justify-center gap-1 border-b-2 transition-all relative ${
            activeTab === 'world'
              ? isSepia
                ? 'border-amber-700 text-amber-900 bg-amber-100/50'
                : 'border-amber-400 text-amber-300 bg-[#252321]'
              : 'border-transparent opacity-60 hover:opacity-100'
          }`}
        >
          <Target className="w-3.5 h-3.5 text-amber-500" />
          <span>登場設定</span>
          {activeNodes.length > 0 && (
            <span className="ml-0.5 px-1 rounded-full text-[9px] bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold">
              {activeNodes.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('hints')}
          className={`flex-1 py-2.5 font-semibold flex items-center justify-center gap-1 border-b-2 transition-all relative ${
            activeTab === 'hints'
              ? isSepia
                ? 'border-amber-700 text-amber-900 bg-amber-100/50'
                : 'border-amber-400 text-amber-300 bg-[#252321]'
              : 'border-transparent opacity-60 hover:opacity-100'
          }`}
        >
          <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
          <span>推敲/矛盾</span>
          {(lintIssues.length > 0 || consistencyHints.length > 0) && (
            <span className="ml-0.5 px-1 rounded-full text-[9px] bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold">
              {lintIssues.length + consistencyHints.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('metrics')}
          className={`flex-1 py-2.5 font-semibold flex items-center justify-center gap-1 border-b-2 transition-all ${
            activeTab === 'metrics'
              ? isSepia
                ? 'border-amber-700 text-amber-900 bg-amber-100/50'
                : 'border-amber-400 text-amber-300 bg-[#252321]'
              : 'border-transparent opacity-60 hover:opacity-100'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>統計</span>
        </button>

        <button
          onClick={() => setActiveTab('scene')}
          className={`flex-1 py-2.5 font-semibold flex items-center justify-center gap-1 border-b-2 transition-all ${
            activeTab === 'scene'
              ? isSepia
                ? 'border-amber-700 text-amber-900 bg-amber-100/50'
                : 'border-amber-400 text-amber-300 bg-[#252321]'
              : 'border-transparent opacity-60 hover:opacity-100'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>シーン</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* TAB: World Graph Context (Phase 7 Realtime Inspector) */}
        {activeTab === 'world' && (
          <div className="space-y-3.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[11px] uppercase tracking-wider opacity-60 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-amber-500" />
                現在のシーンに登場中の設定
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                GraphRAG 抽出
              </span>
            </div>

            {activeNodes.length === 0 ? (
              <div className={`p-4 rounded-2xl border text-center opacity-60 ${
                isSepia ? 'bg-white border-amber-200/80' : 'bg-[#201f1d] border-[#33312d]'
              }`}>
                <p className="mb-2">現在執筆中の本文に一致する設定（キャラ・用語・場所）はまだ検出されていません。</p>
                <p className="text-[11px]">ヘッダーの「世界観」から登録すると、本文中に出現した際ここへ自動表示されます。</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeNodes.map((node) => {
                  const typeLabel =
                    node.node_type === 'character'
                      ? '👤 人物'
                      : node.node_type === 'plot'
                      ? '📌 プロット'
                      : node.node_type === 'location'
                      ? '🗺️ 場所'
                      : '🏛️ 用語';

                  return (
                    <div
                      key={node.id}
                      className={`p-3.5 rounded-2xl border space-y-2 transition-all ${
                        isSepia ? 'bg-white border-amber-200/80 shadow-2xs' : 'bg-[#201f1d] border-[#33312d] shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs tracking-wide">{node.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 font-medium">
                          {typeLabel}
                        </span>
                      </div>

                      {node.summary && (
                        <p className="text-[11px] opacity-75 leading-relaxed">{node.summary}</p>
                      )}

                      {/* Character Attributes: First-person pronoun, Tone, etc. */}
                      {node.attributes && Object.keys(node.attributes).length > 0 && (
                        <div
                          className={`p-2 rounded-xl border text-[10px] space-y-1 ${
                            isSepia ? 'bg-amber-50/70 border-amber-200/60' : 'bg-[#181816] border-[#2c2a27]'
                          }`}
                        >
                          {Object.entries(node.attributes).map(([k, v]) => (
                            <div key={k} className="flex justify-between items-center">
                              <span className="opacity-50 font-medium">{k}:</span>
                              <span className="font-bold text-amber-700 dark:text-amber-300">{v}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Active Edges in this scene */}
            {activeEdges.length > 0 && (
              <div className="pt-2">
                <span className="font-bold text-[11px] uppercase tracking-wider opacity-60 block mb-2 flex items-center gap-1.5">
                  <Share2 className="w-3.5 h-3.5 text-amber-500" />
                  シーン内の相関関係
                </span>
                <div className="space-y-1.5">
                  {activeEdges.map((e) => {
                    const src = graphData.nodes.find((n) => n.id === e.source_id)?.name || '不明';
                    const tgt = graphData.nodes.find((n) => n.id === e.target_id)?.name || '不明';
                    return (
                      <div
                        key={e.id}
                        className={`p-2 rounded-xl border text-[11px] flex items-center justify-between ${
                          isSepia ? 'bg-white border-amber-200/80' : 'bg-[#201f1d] border-[#33312d]'
                        }`}
                      >
                        <div className="flex items-center gap-1 font-medium">
                          <span>{src}</span>
                          <ArrowRight className="w-3 h-3 text-amber-500" />
                          <span>{tgt}</span>
                        </div>
                        <span className="font-bold text-amber-600 dark:text-amber-400">
                          {e.relation_type}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: Hints & Consistency Check */}
        {activeTab === 'hints' && (
          <div className="space-y-4 text-xs">
            {/* World Graph Consistency Hints */}
            {consistencyHints.length > 0 && (
              <div className="space-y-2">
                <span className="font-bold text-[11px] uppercase tracking-wider opacity-70 flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  世界観・設定矛盾チェック（AI自律検知）
                </span>
                <div className="space-y-2">
                  {consistencyHints.map((hint, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border text-[11px] leading-relaxed flex items-start gap-2 ${
                        isSepia
                          ? 'bg-amber-50 border-amber-300 text-amber-950'
                          : 'bg-amber-950/30 border-amber-800/50 text-amber-200'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span>{hint}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Japanese Proofreading Linter */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-[11px] uppercase tracking-wider opacity-70">
                  日本語組版・校正チェック
                </span>
                <span className="text-[10px] opacity-60">{lintIssues.length} 件の改善点</span>
              </div>

              {lintIssues.length === 0 ? (
                <div
                  className={`p-4 rounded-2xl border text-center opacity-70 ${
                    isSepia ? 'bg-white border-amber-200/80' : 'bg-[#201f1d] border-[#33312d]'
                  }`}
                >
                  <p className="font-medium text-emerald-600 dark:text-emerald-400 mb-1">
                    ✨ 指摘事項はありません
                  </p>
                  <p className="text-[11px] opacity-60">
                    字下げや約物、記号ルールが綺麗に保たれています。
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {lintIssues.map((issue) => (
                    <div
                      key={issue.id}
                      className={`p-3 rounded-xl border space-y-1 ${
                        isSepia ? 'bg-white border-amber-200/80 shadow-2xs' : 'bg-[#201f1d] border-[#33312d]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-amber-700 dark:text-amber-400">
                          {issue.line}行目: {issue.message}
                        </span>
                        <span className="text-[10px] opacity-50 font-mono">
                          {issue.matched_text}
                        </span>
                      </div>
                      {issue.suggestion && (
                        <div className="text-[11px] opacity-75 bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/15">
                          💡 修正案: {issue.suggestion}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: Manuscript Metrics */}
        {activeTab === 'metrics' && (
          <div className="space-y-4">
            {/* Target Progress Bar */}
            <div
              className={`p-4 rounded-2xl border ${
                isSepia ? 'bg-white border-amber-200/80 shadow-2xs' : 'bg-[#201f1d] border-[#33312d]'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-amber-500" /> 目標進捗
                </span>
                <span className="font-bold text-amber-600 dark:text-amber-400">
                  {progressPercent}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden mb-2">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] opacity-60">
                <span>{metrics.chars_without_whitespace.toLocaleString()} 字</span>
                <span>目標: {targetCharCount.toLocaleString()} 字</span>
              </div>
            </div>

            {/* Genko Paper Conversion */}
            <div
              className={`p-4 rounded-2xl border space-y-3 ${
                isSepia ? 'bg-white border-amber-200/80 shadow-2xs' : 'bg-[#201f1d] border-[#33312d]'
              }`}
            >
              <h3 className="text-xs font-bold uppercase tracking-wider opacity-60 flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-amber-500" /> 原稿用紙換算
              </h3>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className={`p-3 rounded-xl border ${
                  isSepia ? 'bg-amber-50/70 border-amber-200/70' : 'bg-[#181816] border-[#2c2a27]'
                }`}>
                  <div className="text-[10px] opacity-60 mb-0.5">20×20 (400字詰)</div>
                  <div className="text-lg font-bold font-mono text-amber-700 dark:text-amber-300">
                    {metrics.genko_20x20_pages} <span className="text-xs font-normal">枚</span>
                  </div>
                </div>
                <div className={`p-3 rounded-xl border ${
                  isSepia ? 'bg-amber-50/70 border-amber-200/70' : 'bg-[#181816] border-[#2c2a27]'
                }`}>
                  <div className="text-[10px] opacity-60 mb-0.5">40×40 (小説文庫)</div>
                  <div className="text-lg font-bold font-mono text-amber-700 dark:text-amber-300">
                    {metrics.genko_40x40_pages} <span className="text-xs font-normal">枚</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Character & Reading Time Stats */}
            <div
              className={`p-4 rounded-2xl border space-y-2.5 text-xs ${
                isSepia ? 'bg-white border-amber-200/80 shadow-2xs' : 'bg-[#201f1d] border-[#33312d]'
              }`}
            >
              <div className="flex justify-between items-center opacity-85">
                <span className="opacity-70">文字数（空白除外）</span>
                <span className="font-mono font-bold">
                  {metrics.chars_without_whitespace.toLocaleString()} 字
                </span>
              </div>
              <div className="flex justify-between items-center opacity-85">
                <span className="opacity-70">総文字数（空白含む）</span>
                <span className="font-mono">{metrics.total_chars.toLocaleString()} 字</span>
              </div>
              <div className="flex justify-between items-center opacity-85">
                <span className="opacity-70">総行数</span>
                <span className="font-mono">{metrics.total_lines} 行</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-neutral-500/15">
                <span className="opacity-70 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  読者の読了目安
                </span>
                <span className="font-bold text-amber-600 dark:text-amber-400">
                  約 {metrics.estimated_reading_time_min} 分
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Scene Information */}
        {activeTab === 'scene' && (
          <div className="space-y-4 text-xs">
            {/* Status Switcher */}
            <div
              className={`p-4 rounded-2xl border ${
                isSepia ? 'bg-white border-amber-200/80' : 'bg-[#201f1d] border-[#33312d]'
              }`}
            >
              <label className="text-[11px] font-bold opacity-70 block mb-2.5">執筆ステータス</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'draft', label: '✏️ 執筆中' },
                  { key: 'ready', label: '👀 推敲待ち' },
                  { key: 'reviewed', label: '✅ 完成' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => changeStatus(item.key as SceneStatus)}
                    className={`py-2 text-[11px] font-bold rounded-xl transition-all ${
                      frontmatter?.status === item.key
                        ? 'bg-amber-600 text-white shadow-xs'
                        : isSepia
                        ? 'bg-amber-50/70 border border-amber-200 text-neutral-600 hover:bg-amber-100'
                        : 'bg-[#292724] border border-[#3d3a35] text-neutral-300 hover:bg-[#322f2b]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Editable Scene Form */}
            <div
              className={`p-4 rounded-2xl border space-y-3.5 ${
                isSepia ? 'bg-white border-amber-200/80' : 'bg-[#201f1d] border-[#33312d]'
              }`}
            >
              <div className="space-y-1">
                <label className="text-[11px] font-semibold opacity-70 block">エピソード名（タイトル）</label>
                <input
                  type="text"
                  value={frontmatter?.title || ''}
                  onChange={(e) => updateFrontmatterField({ title: e.target.value })}
                  placeholder="タイトルを入力..."
                  className={`w-full border rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                    isSepia
                      ? 'bg-amber-50/40 border-amber-200 text-neutral-900'
                      : 'bg-[#151412] border-[#383531] text-neutral-100'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold opacity-70 flex items-center gap-1">
                  <User className="w-3 h-3 text-amber-500" /> 視点人物 (POV)
                </label>
                <input
                  type="text"
                  value={frontmatter?.pov || ''}
                  onChange={(e) => updateFrontmatterField({ pov: e.target.value })}
                  placeholder="例: 下人, アリス..."
                  className={`w-full border rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                    isSepia
                      ? 'bg-amber-50/40 border-amber-200 text-neutral-900'
                      : 'bg-[#151412] border-[#383531] text-neutral-100'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold opacity-70 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-amber-500" /> 作中の時系列・日時
                </label>
                <input
                  type="text"
                  value={frontmatter?.timeline || ''}
                  onChange={(e) => updateFrontmatterField({ timeline: e.target.value })}
                  placeholder="例: ある日の暮れ方..."
                  className={`w-full border rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                    isSepia
                      ? 'bg-amber-50/40 border-amber-200 text-neutral-900'
                      : 'bg-[#151412] border-[#383531] text-neutral-100'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold opacity-70 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-amber-500" /> 場所・舞台
                </label>
                <input
                  type="text"
                  value={frontmatter?.location || ''}
                  onChange={(e) => updateFrontmatterField({ location: e.target.value })}
                  placeholder="例: 羅生門の下..."
                  className={`w-full border rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                    isSepia
                      ? 'bg-amber-50/40 border-amber-200 text-neutral-900'
                      : 'bg-[#151412] border-[#383531] text-neutral-100'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold opacity-70 block">あらすじ・シーン概要</label>
                <textarea
                  value={frontmatter?.synopsis || ''}
                  onChange={(e) => updateFrontmatterField({ synopsis: e.target.value })}
                  rows={3}
                  placeholder="このシーンで起きる出来事..."
                  className={`w-full border rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none leading-relaxed ${
                    isSepia
                      ? 'bg-amber-50/40 border-amber-200 text-neutral-900'
                      : 'bg-[#151412] border-[#383531] text-neutral-100'
                  }`}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
