import { useState } from 'react';
import { useEditorStore } from '../../store';
import { SceneStatus } from '../../lib/tauri-commands';
import {
  FileSpreadsheet,
  AlertTriangle,
  Clock,
  BookOpen,
  User,
  Calendar,
  MapPin,
  Sparkles,
} from 'lucide-react';

export function Inspector() {
  const { metrics, lintIssues, frontmatter, changeStatus } = useEditorStore();
  const [activeTab, setActiveTab] = useState<'metrics' | 'scene' | 'linter'>('metrics');

  return (
    <aside className="w-80 h-full bg-[#161b22] border-l border-[#30363d] flex flex-col select-none">
      {/* Tabs */}
      <div className="flex border-b border-[#30363d] bg-neutral-900/40 text-xs">
        <button
          onClick={() => setActiveTab('metrics')}
          className={`flex-1 py-2.5 font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
            activeTab === 'metrics'
              ? 'border-sky-400 text-sky-400 bg-sky-950/20'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          換算・統計
        </button>
        <button
          onClick={() => setActiveTab('scene')}
          className={`flex-1 py-2.5 font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
            activeTab === 'scene'
              ? 'border-sky-400 text-sky-400 bg-sky-950/20'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          シーン情報
        </button>
        <button
          onClick={() => setActiveTab('linter')}
          className={`flex-1 py-2.5 font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors relative ${
            activeTab === 'linter'
              ? 'border-sky-400 text-sky-400 bg-sky-950/20'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          組版チェック
          {lintIssues.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-950 text-amber-400 border border-amber-800/50">
              {lintIssues.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'metrics' && (
          <div className="space-y-4">
            {/* Primary Grid Conversion Card */}
            <div className="p-3.5 bg-neutral-900/80 border border-[#30363d] rounded-lg">
              <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block mb-2">
                公募原稿用紙換算
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-neutral-950/80 p-2.5 rounded border border-neutral-800">
                  <div className="text-[10px] text-neutral-400">400字詰 (20x20)</div>
                  <div className="text-xl font-bold text-sky-400 mt-0.5">
                    {metrics.genko_20x20_pages.toFixed(1)} <span className="text-xs font-normal text-neutral-400">枚</span>
                  </div>
                </div>
                <div className="bg-neutral-950/80 p-2.5 rounded border border-neutral-800">
                  <div className="text-[10px] text-neutral-400">公募規定 (40x40)</div>
                  <div className="text-xl font-bold text-indigo-400 mt-0.5">
                    {metrics.genko_40x40_pages.toFixed(1)} <span className="text-xs font-normal text-neutral-400">枚</span>
                  </div>
                </div>
              </div>
            </div>

            {/* General Character Stats */}
            <div className="p-3.5 bg-neutral-900/80 border border-[#30363d] rounded-lg space-y-2.5 text-xs">
              <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block">
                テキスト統計
              </span>
              <div className="flex justify-between items-center text-neutral-300">
                <span className="text-neutral-400">総文字数（空白込）</span>
                <span className="font-mono font-medium text-neutral-100">{metrics.total_chars.toLocaleString()} 字</span>
              </div>
              <div className="flex justify-between items-center text-neutral-300">
                <span className="text-neutral-400">純文字数（空白除）</span>
                <span className="font-mono font-medium text-neutral-100">{metrics.chars_without_whitespace.toLocaleString()} 字</span>
              </div>
              <div className="flex justify-between items-center text-neutral-300">
                <span className="text-neutral-400">総行数</span>
                <span className="font-mono font-medium text-neutral-100">{metrics.total_lines} 行</span>
              </div>
              <div className="flex justify-between items-center text-neutral-300 pt-1 border-t border-neutral-800">
                <span className="text-neutral-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-neutral-400" />
                  推定読了時間
                </span>
                <span className="font-medium text-neutral-200">約 {metrics.estimated_reading_time_min} 分</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'scene' && (
          <div className="space-y-4 text-xs">
            {/* Status Selector */}
            <div className="p-3 bg-neutral-900/80 border border-[#30363d] rounded-lg">
              <label className="text-[11px] text-neutral-400 font-semibold block mb-2">シーンステータス</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['draft', 'ready', 'reviewed'] as SceneStatus[]).map((st) => (
                  <button
                    key={st}
                    onClick={() => changeStatus(st)}
                    className={`py-1.5 text-xs font-medium rounded transition-colors capitalize ${
                      frontmatter?.status === st
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Frontmatter Info Readout */}
            <div className="p-3 bg-neutral-900/80 border border-[#30363d] rounded-lg space-y-3">
              <div>
                <span className="text-[11px] text-neutral-400 block mb-1">タイトル</span>
                <div className="text-neutral-200 font-medium">{frontmatter?.title || '（未設定）'}</div>
              </div>
              <div>
                <span className="text-[11px] text-neutral-400 flex items-center gap-1 mb-1">
                  <User className="w-3 h-3" /> 視点人物 (POV)
                </span>
                <div className="text-neutral-200">{frontmatter?.pov || '（未設定）'}</div>
              </div>
              <div>
                <span className="text-[11px] text-neutral-400 flex items-center gap-1 mb-1">
                  <Calendar className="w-3 h-3" /> 時系列 / 日時
                </span>
                <div className="text-neutral-200">{frontmatter?.timeline || '（未設定）'}</div>
              </div>
              <div>
                <span className="text-[11px] text-neutral-400 flex items-center gap-1 mb-1">
                  <MapPin className="w-3 h-3" /> 場所
                </span>
                <div className="text-neutral-200">{frontmatter?.location || '（未設定）'}</div>
              </div>
              {frontmatter?.synopsis && (
                <div>
                  <span className="text-[11px] text-neutral-400 block mb-1">あらすじ / プロットメモ</span>
                  <p className="text-neutral-300 bg-neutral-950 p-2 rounded border border-neutral-800 leading-relaxed">
                    {frontmatter.synopsis}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'linter' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-neutral-400 pb-1">
              <span>検出された課題: {lintIssues.length}件</span>
              <span className="text-[11px] text-neutral-500">日本語出版組版基準</span>
            </div>

            {lintIssues.length === 0 ? (
              <div className="p-6 text-center text-xs text-neutral-500 bg-neutral-900/40 rounded-lg border border-[#30363d]">
                <Sparkles className="w-5 h-5 mx-auto mb-2 text-emerald-400/80" />
                組版エラーは検出されませんでした。<br />美しい日本語組版が維持されています。
              </div>
            ) : (
              lintIssues.map((issue, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-neutral-900 border border-neutral-800 rounded-lg text-xs hover:border-neutral-700 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-1 font-mono text-[11px] text-sky-400">
                      {issue.line}行目 : {issue.column}列
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                        issue.severity === 'warning'
                          ? 'bg-amber-950/80 text-amber-400 border border-amber-800/40'
                          : 'bg-neutral-800 text-neutral-400'
                      }`}
                    >
                      {issue.id}
                    </span>
                  </div>
                  <p className="text-neutral-200 mb-1.5 leading-relaxed">{issue.message}</p>
                  {issue.suggestion && (
                    <div className="bg-neutral-950 p-1.5 rounded border border-neutral-800 text-[11px] text-neutral-400">
                      <span className="text-sky-400 mr-1">提案:</span>
                      <code className="text-emerald-300 font-mono">{issue.suggestion}</code>
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
