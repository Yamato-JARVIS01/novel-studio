import { useState, useEffect } from 'react';
import { useVaultStore, useEditorStore, useSyncStore, useAiServiceStore } from '../../store';
import {
  X,
  Settings as SettingsIcon,
  Key,
  Sparkles,
  Cloud,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Terminal,
  Activity,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { vaultPath, setVaultPath } = useVaultStore();
  const { theme } = useEditorStore();
  const {
    config: syncConfig,
    cloudDetections,
    loadConfig: loadSyncConfig,
    loadCloudDetections,
    connectCloud,
    connectGh,
    saveConfig: saveSyncConfig,
    isLoading: isSyncConnecting,
  } = useSyncStore();

  const {
    services: aiServices,
    isTesting: isAiTesting,
    testResult: aiTestResult,
    detectServices,
    testConnection,
  } = useAiServiceStore();

  const isSepia = theme === 'cream-sepia';

  const [pathInput, setPathInput] = useState(vaultPath || '');
  const [provider, setProvider] = useState<'gemini' | 'claude' | 'openai' | 'ollama'>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gemini-1.5-pro');
  const [baseUrl, setBaseUrl] = useState('');
  const [targetPaper, setTargetPaper] = useState<'400' | '1600'>('400');

  // Advanced manual settings
  const [showAdvancedCloud, setShowAdvancedCloud] = useState(false);
  const [githubRemoteUrl, setGithubRemoteUrl] = useState('');
  const [githubPat, setGithubPat] = useState('');
  const [mirrorFolderPath, setMirrorFolderPath] = useState('');

  // Status banners
  const [cloudConnectFeedback, setCloudConnectFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPathInput(vaultPath || '');
      setProvider((localStorage.getItem('novel_studio_provider') as any) || 'gemini');
      setApiKey(localStorage.getItem('novel_studio_api_key') || '');
      setModel(localStorage.getItem('novel_studio_model') || 'gemini-1.5-pro');
      setBaseUrl(localStorage.getItem('novel_studio_base_url') || '');
      setTargetPaper((localStorage.getItem('novel_studio_paper') as any) || '400');

      if (vaultPath) {
        loadSyncConfig(vaultPath);
        loadCloudDetections(vaultPath);
      } else {
        loadCloudDetections();
      }

      detectServices();
    }
  }, [isOpen, vaultPath, loadSyncConfig, loadCloudDetections, detectServices]);

  useEffect(() => {
    if (syncConfig) {
      setGithubRemoteUrl(syncConfig.github_remote_url || '');
      setGithubPat(syncConfig.github_pat || '');
      setMirrorFolderPath(syncConfig.mirror_folder_path || '');
    }
  }, [syncConfig]);

  if (!isOpen) return null;

  const handleCloudConnect = async (type: 'icloud' | 'google_drive' | 'local') => {
    if (!vaultPath) {
      alert('先に小説を開くか作成してください。');
      return;
    }
    await connectCloud(vaultPath, type);
    const names = {
      icloud: '🍎 iCloud Drive',
      google_drive: '📁 Google Drive',
      local: '💻 このMac内（書類フォルダ）',
    };
    setCloudConnectFeedback(`${names[type]} への自動保護を有効化しました！`);
    setTimeout(() => setCloudConnectFeedback(null), 4000);
  };

  const handleGhConnect = async () => {
    if (!vaultPath) {
      alert('先に小説を開くか作成してください。');
      return;
    }
    await connectGh(vaultPath);
    setCloudConnectFeedback('GitHub CLI の認証情報を連携しました！');
    setTimeout(() => setCloudConnectFeedback(null), 4000);
  };

  const handleTestAi = async () => {
    await testConnection({
      provider,
      model,
      api_key: apiKey || undefined,
      base_url: baseUrl || undefined,
    });
  };

  const handleUseEnvKey = (key: string) => {
    setApiKey(key);
  };

  const handleConnectOllama = () => {
    setProvider('ollama');
    setBaseUrl('http://localhost:11434/v1');
    if (aiServices?.ollama_models && aiServices.ollama_models.length > 0) {
      setModel(aiServices.ollama_models[0]);
    } else {
      setModel('llama3');
    }
  };

  const handleSave = async () => {
    if (pathInput.trim()) {
      setVaultPath(pathInput.trim());
    }
    localStorage.setItem('novel_studio_provider', provider);
    localStorage.setItem('novel_studio_api_key', apiKey);
    localStorage.setItem('novel_studio_model', model);
    localStorage.setItem('novel_studio_base_url', baseUrl);
    localStorage.setItem('novel_studio_paper', targetPaper);

    if (vaultPath) {
      await saveSyncConfig(vaultPath, {
        auto_sync_enabled: true,
        github_remote_url: githubRemoteUrl.trim() || undefined,
        github_pat: githubPat.trim() || undefined,
        mirror_folder_path: mirrorFolderPath.trim() || undefined,
      });
    }

    onClose();
  };

  // Determine which cloud card is actively protecting
  const activeMirror = cloudDetections?.active_mirror_type;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 sm:p-6">
      <div
        className={`w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-colors ${
          isSepia
            ? 'bg-[#fbf9f5] border-amber-200 text-neutral-800'
            : 'bg-[#1a1917] border-[#363430] text-neutral-100'
        }`}
      >
        {/* Header */}
        <div
          className={`px-6 py-4 border-b flex items-center justify-between ${
            isSepia ? 'border-amber-200 bg-amber-50/60' : 'border-[#2d2b27] bg-[#161513]'
          }`}
        >
          <div className="flex items-center gap-2.5 text-sm font-bold text-amber-600 dark:text-amber-400">
            <SettingsIcon className="w-4 h-4" />
            <span>NovelStudio 環境設定（クラウド & AI自動接続）</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg opacity-60 hover:opacity-100 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto text-xs">
          {/* Feedback banner */}
          {cloudConnectFeedback && (
            <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{cloudConnectFeedback}</span>
            </div>
          )}

          {/* 1. Cloud Drive Direct One-Click Connect (Phase 13 Core Specification) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-bold flex items-center gap-2 text-xs opacity-90">
                <Cloud className="w-4 h-4 text-emerald-500" />
                <span>ワンクリック クラウド自動保護（フォルダ指定不要）</span>
              </label>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold">
                執筆と同時に自動バックアップ
              </span>
            </div>

            <p className="text-[11px] opacity-70 leading-relaxed">
              お使いのクラウドサービスを選ぶだけで、原稿の保存や設定の更新のたびに二重化バックアップが自動実行されます。
            </p>

            {/* 3 Large Visual Card Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {/* Card 1: iCloud Drive */}
              <div
                onClick={() => handleCloudConnect('icloud')}
                className={`p-3.5 rounded-2xl border flex flex-col justify-between cursor-pointer transition-all duration-200 shadow-2xs hover:shadow-md hover:-translate-y-0.5 ${
                  activeMirror === 'icloud'
                    ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/30'
                    : isSepia
                    ? 'bg-white hover:bg-amber-50/80 border-amber-200'
                    : 'bg-[#21201d] hover:bg-[#282623] border-[#363430]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xl">🍎</span>
                    {activeMirror === 'icloud' ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500 text-white flex items-center gap-0.5">
                        <Check className="w-3 h-3" />
                        保護中
                      </span>
                    ) : cloudDetections?.icloud_available ? (
                      <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                        利用可能
                      </span>
                    ) : (
                      <span className="text-[10px] opacity-40">未検出</span>
                    )}
                  </div>
                  <h4 className="font-bold text-xs mb-1">iCloud Drive で保護</h4>
                  <p className="text-[10px] opacity-65 leading-relaxed">
                    MacとiPhone/iPad間で原稿を安全に自動同期します
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-black/5 dark:border-white/5 text-[9px] font-mono opacity-50 truncate">
                  ~/Library/Mobile Documents/com~apple~CloudDocs/NovelStudio_Backup
                </div>
              </div>

              {/* Card 2: Google Drive */}
              <div
                onClick={() =>
                  cloudDetections?.google_drive_available
                    ? handleCloudConnect('google_drive')
                    : alert('Google Drive アプリが検出されませんでした。')
                }
                className={`p-3.5 rounded-2xl border flex flex-col justify-between cursor-pointer transition-all duration-200 shadow-2xs hover:shadow-md hover:-translate-y-0.5 ${
                  activeMirror === 'google_drive'
                    ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/30'
                    : !cloudDetections?.google_drive_available
                    ? 'opacity-60 cursor-not-allowed'
                    : isSepia
                    ? 'bg-white hover:bg-amber-50/80 border-amber-200'
                    : 'bg-[#21201d] hover:bg-[#282623] border-[#363430]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xl">📁</span>
                    {activeMirror === 'google_drive' ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500 text-white flex items-center gap-0.5">
                        <Check className="w-3 h-3" />
                        保護中
                      </span>
                    ) : cloudDetections?.google_drive_available ? (
                      <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                        検出済み
                      </span>
                    ) : (
                      <span className="text-[10px] opacity-40">未検出</span>
                    )}
                  </div>
                  <h4 className="font-bold text-xs mb-1">Google Drive で保護</h4>
                  <p className="text-[10px] opacity-65 leading-relaxed">
                    Googleクラウドストレージへリアルタイム自動同期します
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-black/5 dark:border-white/5 text-[9px] font-mono opacity-50 truncate">
                  {cloudDetections?.google_drive_path || 'Google Drive 未検出'}
                </div>
              </div>

              {/* Card 3: Local Mac Documents */}
              <div
                onClick={() => handleCloudConnect('local')}
                className={`p-3.5 rounded-2xl border flex flex-col justify-between cursor-pointer transition-all duration-200 shadow-2xs hover:shadow-md hover:-translate-y-0.5 ${
                  activeMirror === 'local'
                    ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/30'
                    : isSepia
                    ? 'bg-white hover:bg-amber-50/80 border-amber-200'
                    : 'bg-[#21201d] hover:bg-[#282623] border-[#363430]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xl">💻</span>
                    {activeMirror === 'local' ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500 text-white flex items-center gap-0.5">
                        <Check className="w-3 h-3" />
                        保護中
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                        常に可能
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-xs mb-1">このMac内（書類）で保護</h4>
                  <p className="text-[10px] opacity-65 leading-relaxed">
                    書類フォルダ配下へ二重化バックアップを自動維持します
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-black/5 dark:border-white/5 text-[9px] font-mono opacity-50 truncate">
                  ~/Documents/NovelStudio_Backup
                </div>
              </div>
            </div>

            {/* GitHub One-Click Auto Detection & PAT Helper */}
            <div
              className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                isSepia ? 'bg-amber-100/40 border-amber-200' : 'bg-[#181715] border-[#2c2a27]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Terminal className="w-4 h-4 text-amber-500 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[11px]">GitHub クラウド正本連携</span>
                    {cloudDetections?.gh_cli_available && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-600 font-bold">
                        GitHub CLI 検出 (@{cloudDetections.gh_username})
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] opacity-60">
                    GitHubに保存すれば、世界中どこからでも作品履歴を閲覧・復元できます
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {cloudDetections?.gh_cli_available ? (
                  <button
                    onClick={handleGhConnect}
                    disabled={isSyncConnecting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-2xs transition-all cursor-pointer"
                  >
                    <Check className="w-3 h-3" />
                    <span>CLIでワンクリック接続</span>
                  </button>
                ) : (
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo&description=NovelStudio"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-medium opacity-75 hover:opacity-100 hover:border-amber-500 transition-all"
                  >
                    <span>トークン発行ページ</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            </div>

            {/* Advanced Cloud Accordion */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowAdvancedCloud(!showAdvancedCloud)}
                className="flex items-center gap-1 text-[11px] opacity-60 hover:opacity-100 transition-opacity"
              >
                {showAdvancedCloud ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                <span>⚙️ 高度な同期設定（手動パス指定・リポジトリURL・PAT入力）</span>
              </button>

              {showAdvancedCloud && (
                <div className="space-y-3 pt-3 pl-3 border-l-2 border-amber-500/30 mt-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold opacity-75">
                      ミラー同期先フォルダ（カスタム絶対パス）
                    </label>
                    <input
                      type="text"
                      value={mirrorFolderPath}
                      onChange={(e) => setMirrorFolderPath(e.target.value)}
                      placeholder="/Users/名前/カスタム同期先"
                      className={`w-full border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                        isSepia
                          ? 'bg-white border-amber-200 text-neutral-900'
                          : 'bg-[#141311] border-[#383531] text-neutral-100'
                      }`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold opacity-75">GitHub リポジトリ URL</label>
                      <input
                        type="text"
                        value={githubRemoteUrl}
                        onChange={(e) => setGithubRemoteUrl(e.target.value)}
                        placeholder="https://github.com/user/novel.git"
                        className={`w-full border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                          isSepia
                            ? 'bg-white border-amber-200 text-neutral-900'
                            : 'bg-[#141311] border-[#383531] text-neutral-100'
                        }`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold opacity-75">Personal Access Token (PAT)</label>
                      <input
                        type="password"
                        value={githubPat}
                        onChange={(e) => setGithubPat(e.target.value)}
                        placeholder="ghp_xxxxxxxxxxxx"
                        className={`w-full border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                          isSepia
                            ? 'bg-white border-amber-200 text-neutral-900'
                            : 'bg-[#141311] border-[#383531] text-neutral-100'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 2. AI推敲アシスタントの接続 (Phase 13 AI Auto Detection & 1-Click Connect) */}
          <div className="space-y-3 pt-3 border-t border-black/5 dark:border-white/5">
            <div className="flex items-center justify-between">
              <label className="font-bold flex items-center gap-2 text-xs opacity-90">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>AI推敲アシスタントの接続 (GraphRAG 文脈自動注入)</span>
              </label>
              <button
                type="button"
                onClick={handleTestAi}
                disabled={isAiTesting}
                className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg border border-amber-500/30 text-amber-600 dark:text-amber-400 font-semibold hover:bg-amber-500/10 transition-all cursor-pointer"
              >
                <Activity className={`w-3 h-3 ${isAiTesting ? 'animate-spin' : ''}`} />
                <span>{isAiTesting ? '接続テスト中...' : 'AI接続テスト'}</span>
              </button>
            </div>

            {/* Test result message */}
            {aiTestResult && (
              <div
                className={`p-2.5 rounded-xl text-[11px] font-medium border leading-relaxed ${
                  aiTestResult.startsWith('✅')
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    : 'bg-red-500/15 border-red-500/30 text-red-600 dark:text-red-400'
                }`}
              >
                {aiTestResult}
              </div>
            )}

            {/* Local AI Detection Banner (Ollama) */}
            {aiServices?.ollama_running && (
              <div
                className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                  isSepia ? 'bg-emerald-50/70 border-emerald-200' : 'bg-emerald-950/20 border-emerald-800/40'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <div>
                    <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      ローカルAI（Ollama）が稼働中です
                    </h4>
                    <p className="text-[10px] opacity-70">
                      検出モデル: {aiServices.ollama_models.join(', ') || 'デフォルト'}（完全オフライン・通信費ゼロ）
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleConnectOllama}
                  className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs transition-all cursor-pointer"
                >
                  ローカルAIに接続
                </button>
              </div>
            )}

            {/* Detected Env API Key Notification */}
            {aiServices?.has_gemini_env && provider === 'gemini' && !apiKey && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px]">
                <span className="opacity-80">⚡ 環境変数 GEMINI_API_KEY を検出しました</span>
                <button
                  type="button"
                  onClick={() => handleUseEnvKey(aiServices.gemini_env_key || '')}
                  className="font-bold text-amber-600 dark:text-amber-400 hover:underline"
                >
                  このキーを設定
                </button>
              </div>
            )}

            {/* Provider Selector */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'gemini', label: 'Gemini (推奨)' },
                { id: 'claude', label: 'Claude' },
                { id: 'openai', label: 'OpenAI' },
                { id: 'ollama', label: 'ローカル (Ollama)' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProvider(p.id as any)}
                  className={`py-2 px-1 rounded-xl border text-[11px] font-bold transition-all ${
                    provider === p.id
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : isSepia
                      ? 'bg-white border-amber-200 text-neutral-600 hover:bg-amber-50'
                      : 'bg-[#21201d] border-[#363430] text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* API Key or Local URL Input */}
            {provider !== 'ollama' ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <label className="opacity-80 flex items-center gap-1 font-semibold">
                    <Key className="w-3 h-3 text-amber-500" />
                    <span>API キー</span>
                  </label>
                  {provider === 'gemini' && (
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="text-amber-600 dark:text-amber-400 font-medium hover:underline flex items-center gap-0.5"
                    >
                      <span>Google AI Studio で無料APIキーを取得（ワンクリック）</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="APIキーを貼り付け..."
                  className={`w-full border rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                    isSepia
                      ? 'bg-white border-amber-200 text-neutral-900'
                      : 'bg-[#141311] border-[#363430] text-neutral-100'
                  }`}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-[11px] opacity-80 font-semibold">
                  ローカルURL（Ollama / LM Studio）
                </label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="http://localhost:11434/v1"
                  className={`w-full border rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                    isSepia
                      ? 'bg-white border-amber-200 text-neutral-900'
                      : 'bg-[#141311] border-[#363430] text-neutral-100'
                  }`}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[11px] opacity-75">モデル指定（任意）</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="gemini-1.5-pro / claude-3-5-sonnet / gpt-4o / llama3"
                className={`w-full border rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                  isSepia
                    ? 'bg-white border-amber-200 text-neutral-900'
                    : 'bg-[#141311] border-[#363430] text-neutral-100'
                }`}
              />
            </div>
          </div>

          {/* 3. Paper Format */}
          <div className="space-y-2 pt-3 border-t border-black/5 dark:border-white/5">
            <label className="font-bold opacity-90 block">原稿用紙換算フォーマット</label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-center gap-2 p-3 rounded-2xl border cursor-pointer transition-colors ${
                  targetPaper === '400'
                    ? 'border-amber-600 bg-amber-500/10 font-bold'
                    : isSepia
                    ? 'bg-white border-amber-200 opacity-70'
                    : 'bg-[#21201d] border-[#363430] opacity-70'
                }`}
              >
                <input
                  type="radio"
                  name="paper"
                  checked={targetPaper === '400'}
                  onChange={() => setTargetPaper('400')}
                  className="accent-amber-600"
                />
                <span>400字詰原稿用紙 (20×20)</span>
              </label>

              <label
                className={`flex items-center gap-2 p-3 rounded-2xl border cursor-pointer transition-colors ${
                  targetPaper === '1600'
                    ? 'border-amber-600 bg-amber-500/10 font-bold'
                    : isSepia
                    ? 'bg-white border-amber-200 opacity-70'
                    : 'bg-[#21201d] border-[#363430] opacity-70'
                }`}
              >
                <input
                  type="radio"
                  name="paper"
                  checked={targetPaper === '1600'}
                  onChange={() => setTargetPaper('1600')}
                  className="accent-amber-600"
                />
                <span>公募標準規定 (40×40 頁換算)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className={`px-6 py-4 border-t flex items-center justify-end gap-2.5 ${
            isSepia ? 'border-amber-200 bg-amber-50/50' : 'border-[#2d2b27] bg-[#161513]'
          }`}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs opacity-70 hover:opacity-100 transition-opacity"
          >
            閉じる
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-md transition-all cursor-pointer"
          >
            保存して適用
          </button>
        </div>
      </div>
    </div>
  );
}

export function Settings() {
  return null;
}
