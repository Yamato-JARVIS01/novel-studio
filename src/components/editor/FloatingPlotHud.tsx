import { useState, useEffect } from 'react';
import { useVaultStore, useEditorStore, useWorldGraphStore, useAiStore } from '../../store';
import {
  Compass,
  X,
  Minimize2,
  Maximize2,
  FileText,
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
} from 'lucide-react';

interface FloatingPlotHudProps {
  isOpen: boolean;
  onClose: () => void;
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
  const [isMinimized, setIsMinimized] = useState(false);
  const [localPlot, setLocalPlot] = useState(overallPlot);
  const [localSynopsis, setLocalSynopsis] = useState(frontmatter?.synopsis || '');
  const [isSavedNotice, setIsSavedNotice] = useState(false);

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

  useEffect(() => {
    setLocalSynopsis(frontmatter?.synopsis || '');
  }, [frontmatter?.synopsis]);

  if (!isOpen) return null;

  const handleSaveOverall = async () => {
    if (!vaultPath) return;
    await saveOverallPlotText(vaultPath, localPlot);
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 2000);
  };

  const handleSaveSynopsis = () => {
    updateFrontmatterField({ synopsis: localSynopsis });
    useEditorStore.getState().save();
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 2000);
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

  // Append generated beats to synopsis
  const handleAppendBeatsToSynopsis = () => {
    if (!generatedBeats) return;
    const newSynopsis = localSynopsis
      ? `${localSynopsis}\n\n【起承転結ビート構成】\n${generatedBeats}`
      : `【起承転結ビート構成】\n${generatedBeats}`;
    setLocalSynopsis(newSynopsis);
    updateFrontmatterField({ synopsis: newSynopsis });
    useEditorStore.getState().save();
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 2000);
  };

  // Phase 9: Expand scene draft into shadow branch & Inline Diff
  const handleExpandDraft = async () => {
    if (!vaultPath || !activeFilePath) return;
    await expandDraft(vaultPath, activeFilePath, overallPlot, localSynopsis, draftInstruction);
  };

  // Minimized Floating Pill
  if (isMinimized) {
    return (
      <div className="absolute top-14 right-6 z-40 animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={() => setIsMinimized(false)}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-full border shadow-xl backdrop-blur-xl transition-all cursor-pointer ${
            isSepia
              ? 'bg-[#fbf9f5]/85 border-amber-900/20 text-amber-950 hover:bg-amber-100/90'
              : 'bg-[#1e1d1a]/85 border-amber-500/30 text-amber-300 hover:bg-[#282723]/95 shadow-amber-950/40'
          }`}
          title="筋書きHUDを展開"
        >
          <Compass className="w-4 h-4 animate-spin-slow text-amber-500" />
          <span className="text-xs font-bold tracking-wide">筋書きHUD</span>
          <Maximize2 className="w-3 h-3 opacity-60" />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute top-14 right-6 z-40 w-[420px] max-w-[calc(100vw-3rem)] animate-in fade-in slide-in-from-top-3 duration-200">
      <div
        className={`rounded-2xl border shadow-2xl backdrop-blur-2xl overflow-hidden flex flex-col transition-all ${
          isSepia
            ? 'bg-[#fcfbf9]/85 border-amber-900/15 text-neutral-800 shadow-amber-950/10'
            : 'bg-[#1b1a17]/90 border-amber-500/25 text-neutral-200 shadow-black/70 ring-1 ring-white/5'
        }`}
      >
        {/* HUD Window Header */}
        <div
          className={`px-4 py-2.5 flex items-center justify-between border-b select-none ${
            isSepia ? 'border-amber-900/10 bg-amber-500/5' : 'border-neutral-800/80 bg-white/5'
          }`}
        >
          <div className="flex items-center gap-2">
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
              <div className="text-[10px] opacity-60">プロット直結執筆支援</div>
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
            <FileText className="w-3 h-3" />
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
        <div className="p-3 max-h-[440px] overflow-y-auto space-y-3 text-xs leading-relaxed">
          {/* Tab 1: Episode Specific Plot */}
          {activeTab === 'episode' && (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold opacity-70">
                    本話の狙い・あらすじ（Synopsis）
                  </label>
                  <button
                    onClick={() => setActiveTab('assistant')}
                    className="text-[10px] text-amber-500 hover:underline flex items-center gap-1"
                  >
                    <Wand2 className="w-3 h-3" />
                    <span>AIでビート展開</span>
                  </button>
                </div>
                <textarea
                  value={localSynopsis}
                  onChange={(e) => setLocalSynopsis(e.target.value)}
                  placeholder="このエピソードで下人が直面する葛藤、転換点、結末など..."
                  rows={5}
                  className={`w-full p-2.5 rounded-xl text-xs resize-none outline-none border transition-all ${
                    isSepia
                      ? 'bg-white/90 border-amber-900/20 focus:border-amber-600 text-neutral-900'
                      : 'bg-[#131210]/90 border-neutral-700/80 focus:border-amber-400 text-neutral-100'
                  }`}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[10px] opacity-50">フロントマターに即時反映</span>
                <button
                  onClick={handleSaveSynopsis}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-xs transition-all"
                >
                  <Save className="w-3 h-3" />
                  <span>話筋書きを反映</span>
                </button>
              </div>

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
                        <span>話筋書きに挿入反映</span>
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
