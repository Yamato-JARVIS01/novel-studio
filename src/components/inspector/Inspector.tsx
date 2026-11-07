import { useState } from 'react';
import { useEditorStore } from '../../store';
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
    setTargetCharCount,
  } = useEditorStore();

  const [activeTab, setActiveTab] = useState<'metrics' | 'scene' | 'hints'>('metrics');
  const isSepia = theme === 'cream-sepia';

  const progressPercent = Math.min(
    100,
    Math.round((metrics.chars_without_whitespace / (targetCharCount || 1)) * 100)
  );

  return (
    <aside
      className={`w-80 h-full flex flex-col select-none border-l transition-colors ${
        isSepia
          ? 'bg-[#f6f2ea] border-amber-900/10 text-neutral-800'
          : 'bg-[#181816] border-[#2c2a27] text-neutral-200'
      }`}
    >
      {/* Tab Switcher */}
      <div className={`flex border-b text-xs ${
        isSepia ? 'border-amber-900/10 bg-amber-50/50' : 'border-[#2c2a27] bg-[#1c1b19]'
      }`}>
        <button
          onClick={() => setActiveTab('metrics')}
          className={`flex-1 py-3 font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-all ${
            activeTab === 'metrics'
              ? isSepia
                ? 'border-amber-700 text-amber-900 bg-amber-100/50'
                : 'border-amber-400 text-amber-300 bg-[#252321]'
              : 'border-transparent opacity-60 hover:opacity-100'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          原稿用紙・統計
        </button>
        <button
          onClick={() => setActiveTab('scene')}
          className={`flex-1 py-3 font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-all ${
            activeTab === 'scene'
              ? isSepia
                ? 'border-amber-700 text-amber-900 bg-amber-100/50'
                : 'border-amber-400 text-amber-300 bg-[#252321]'
              : 'border-transparent opacity-60 hover:opacity-100'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          シーン情報
        </button>
        <button
          onClick={() => setActiveTab('hints')}
          className={`flex-1 py-3 font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-all relative ${
            activeTab === 'hints'
              ? isSepia
                ? 'border-amber-700 text-amber-900 bg-amber-100/50'
                : 'border-amber-400 text-amber-300 bg-[#252321]'
              : 'border-transparent opacity-60 hover:opacity-100'
          }`}
        >
          <Lightbulb className="w-3.5 h-3.5" />
          推敲のヒント
          {lintIssues.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold">
              {lintIssues.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'metrics' && (
          <div className="space-y-4">
            {/* Target Progress Bar */}
            <div className={`p-4 rounded-2xl border ${
              isSepia ? 'bg-white border-amber-200/80 shadow-xs' : 'bg-[#201f1d] border-[#33312d]'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold flex items-center gap-1.5 opacity-80">
                  <Target className="w-3.5 h-3.5 text-amber-500" />
                  執筆進捗
                </span>
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                  {progressPercent}%
                </span>
              </div>

              {/* Progress bar line */}
              <div className="w-full h-2 rounded-full bg-neutral-500/20 overflow-hidden mb-2">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="flex justify-between items-center text-[11px] opacity-70">
                <span>{metrics.chars_without_whitespace.toLocaleString()} 字</span>
                <div className="flex items-center gap-1">
                  <span>目標:</span>
                  <select
                    value={targetCharCount}
                    onChange={(e) => setTargetCharCount(Number(e.target.value))}
                    className={`rounded px-1.5 py-0.5 text-[11px] font-medium border ${
                      isSepia ? 'bg-amber-50 border-amber-200' : 'bg-[#292724] border-[#3d3a35]'
                    }`}
                  >
                    <option value={2000}>2,000 字（短編/掌編）</option>
                    <option value={5000}>5,000 字（1エピソード）</option>
                    <option value={10000}>10,000 字（短編）</option>
                    <option value={20000}>20,000 字（中編）</option>
                    <option value={100000}>100,000 字（長編公募）</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Manuscript Cards */}
            <div className={`p-4 rounded-2xl border space-y-3 ${
              isSepia ? 'bg-white border-amber-200/80 shadow-xs' : 'bg-[#201f1d] border-[#33312d]'
            }`}>
              <span className="text-[11px] font-bold tracking-wider opacity-60 uppercase block">
                原稿用紙換算枚数
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div className={`p-3 rounded-xl border ${
                  isSepia ? 'bg-amber-50/60 border-amber-200/60' : 'bg-[#272522] border-[#3a3733]'
                }`}>
                  <div className="text-[10px] opacity-70">400字詰原稿用紙</div>
                  <div className="text-xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
                    {metrics.genko_20x20_pages.toFixed(1)} <span className="text-xs font-normal opacity-70">枚</span>
                  </div>
                </div>
                <div className={`p-3 rounded-xl border ${
                  isSepia ? 'bg-amber-50/60 border-amber-200/60' : 'bg-[#272522] border-[#3a3733]'
                }`}>
                  <div className="text-[10px] opacity-70">公募規定 (40×40)</div>
                  <div className="text-xl font-extrabold text-amber-700 dark:text-amber-300 mt-1">
                    {metrics.genko_40x40_pages.toFixed(1)} <span className="text-xs font-normal opacity-70">枚</span>
                  </div>
                </div>
              </div>
            </div>

            {/* General Stats */}
            <div className={`p-4 rounded-2xl border space-y-2.5 text-xs ${
              isSepia ? 'bg-white border-amber-200/80 shadow-xs' : 'bg-[#201f1d] border-[#33312d]'
            }`}>
              <span className="text-[11px] font-bold tracking-wider opacity-60 uppercase block">
                文字と時間のめやす
              </span>
              <div className="flex justify-between items-center opacity-85">
                <span className="opacity-70">純文字数（空白除外）</span>
                <span className="font-mono font-bold">{metrics.chars_without_whitespace.toLocaleString()} 字</span>
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

        {activeTab === 'scene' && (
          <div className="space-y-4 text-xs">
            {/* Status Switcher */}
            <div className={`p-4 rounded-2xl border ${
              isSepia ? 'bg-white border-amber-200/80' : 'bg-[#201f1d] border-[#33312d]'
            }`}>
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
                        ? 'bg-amber-600 text-white shadow-sm'
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

            {/* Editable Scene Form (Invisible Frontmatter) */}
            <div className={`p-4 rounded-2xl border space-y-3.5 ${
              isSepia ? 'bg-white border-amber-200/80' : 'bg-[#201f1d] border-[#33312d]'
            }`}>
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
                  placeholder="例: 主人公、アリス、三人称客観..."
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
                  placeholder="例: 1日目の夕暮れ、秋の夜半..."
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
                  placeholder="例: 羅生門の下、王都の裏路地..."
                  className={`w-full border rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                    isSepia
                      ? 'bg-amber-50/40 border-amber-200 text-neutral-900'
                      : 'bg-[#151412] border-[#383531] text-neutral-100'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold opacity-70 block">あらすじ・プロット構想メモ</label>
                <textarea
                  rows={4}
                  value={frontmatter?.synopsis || ''}
                  onChange={(e) => updateFrontmatterField({ synopsis: e.target.value })}
                  placeholder="このエピソードの目的や伏線、執筆メモを入力..."
                  className={`w-full border rounded-xl p-2.5 leading-relaxed text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                    isSepia
                      ? 'bg-amber-50/40 border-amber-200 text-neutral-900'
                      : 'bg-[#151412] border-[#383531] text-neutral-100'
                  }`}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'hints' && (
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between pb-1">
              <span className="font-bold opacity-80">読みやすさのヒント: {lintIssues.length}件</span>
              <span className="text-[11px] opacity-50">文芸組版基準</span>
            </div>

            {lintIssues.length === 0 ? (
              <div className={`p-8 text-center rounded-2xl border leading-relaxed ${
                isSepia ? 'bg-white border-amber-200/80 text-neutral-600' : 'bg-[#201f1d] border-[#33312d] text-neutral-400'
              }`}>
                <Sparkles className="w-6 h-6 mx-auto mb-2 text-amber-500 opacity-80" />
                気になる箇所は見つかりませんでした。<br />
                美しい日本語組版が保たれています。
              </div>
            ) : (
              lintIssues.map((issue, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-2xl border transition-colors ${
                    isSepia
                      ? 'bg-white border-amber-200/80 hover:border-amber-400'
                      : 'bg-[#201f1d] border-[#33312d] hover:border-[#4d4943]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-[11px] font-bold text-amber-600 dark:text-amber-400">
                      {issue.line}行目
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                      💡 アドバイス
                    </span>
                  </div>
                  <p className="leading-relaxed mb-2 font-medium">{issue.message}</p>
                  {issue.suggestion && (
                    <div className={`p-2 rounded-xl text-[11px] ${
                      isSepia ? 'bg-amber-50 border border-amber-200/60' : 'bg-[#272522] border border-[#3d3a35]'
                    }`}>
                      <span className="text-amber-600 dark:text-amber-400 mr-1.5 font-bold">参考:</span>
                      <code className="font-mono text-emerald-600 dark:text-emerald-400">{issue.suggestion}</code>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
