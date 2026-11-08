import { useState, useEffect } from 'react';
import { useVaultStore, useEditorStore, useSyncStore } from '../../store';
import { X, Settings as SettingsIcon, Key, Folder, Sparkles, Cloud } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { vaultPath, setVaultPath } = useVaultStore();
  const { theme } = useEditorStore();
  const { config: syncConfig, saveConfig: saveSyncConfig } = useSyncStore();
  const isSepia = theme === 'cream-sepia';

  const [pathInput, setPathInput] = useState(vaultPath || '');
  const [provider, setProvider] = useState<'gemini' | 'claude' | 'openai' | 'ollama'>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gemini-1.5-pro');
  const [baseUrl, setBaseUrl] = useState('');
  const [targetPaper, setTargetPaper] = useState<'400' | '1600'>('400');

  // Cloud Sync fields
  const [githubRemoteUrl, setGithubRemoteUrl] = useState('');
  const [githubPat, setGithubPat] = useState('');
  const [mirrorFolderPath, setMirrorFolderPath] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPathInput(vaultPath || '');
      setProvider((localStorage.getItem('novel_studio_provider') as any) || 'gemini');
      setApiKey(localStorage.getItem('novel_studio_api_key') || '');
      setModel(localStorage.getItem('novel_studio_model') || 'gemini-1.5-pro');
      setBaseUrl(localStorage.getItem('novel_studio_base_url') || '');
      setTargetPaper((localStorage.getItem('novel_studio_paper') as any) || '400');

      if (syncConfig) {
        setGithubRemoteUrl(syncConfig.github_remote_url || '');
        setGithubPat(syncConfig.github_pat || '');
        setMirrorFolderPath(syncConfig.mirror_folder_path || '');
      }
    }
  }, [isOpen, vaultPath, syncConfig]);

  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div
        className={`w-full max-w-xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors ${
          isSepia
            ? 'bg-[#fbf9f5] border-amber-200 text-neutral-800'
            : 'bg-[#1e1d1b] border-[#35332f] text-neutral-100'
        }`}
      >
        {/* Header */}
        <div
          className={`px-6 py-4 border-b flex items-center justify-between ${
            isSepia ? 'border-amber-200 bg-amber-50/50' : 'border-[#302e2a] bg-[#191816]'
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-bold text-amber-600 dark:text-amber-400">
            <SettingsIcon className="w-4 h-4" />
            <span>NovelStudio 環境設定</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg opacity-60 hover:opacity-100 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5 overflow-y-auto text-xs">
          {/* Storage Vault Path */}
          <div className="space-y-1.5">
            <label className="font-bold flex items-center gap-1.5 opacity-90">
              <Folder className="w-3.5 h-3.5 text-amber-500" />
              作品の保存先フォルダ（本棚）
            </label>
            <input
              type="text"
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              placeholder="/Users/あなたの名前/Documents/MyNovels"
              className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                isSepia
                  ? 'bg-white border-amber-200 text-neutral-900'
                  : 'bg-[#151412] border-[#383531] text-neutral-100'
              }`}
            />
          </div>

          {/* Cloud Auto-Sync Settings (Phase 7 Zero-Touch Cloud Sync) */}
          <div
            className={`p-4 rounded-2xl border space-y-3 ${
              isSepia ? 'bg-amber-50/50 border-amber-200/80' : 'bg-[#181715] border-[#2f2d29]'
            }`}
          >
            <div className="flex items-center justify-between">
              <label className="font-bold flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <Cloud className="w-4 h-4" />
                <span>☁️ 全自動クラウド同期（ゼロタッチ・バックアップ）</span>
              </label>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 font-bold">
                自動保存・自動プッシュ連動
              </span>
            </div>

            <p className="text-[11px] opacity-70 leading-relaxed">
              エピソード作成・保存・並び替え・世界観更新のたびに、裏側で自動的にGitコミット＆クラウド同期が実行されます。
            </p>

            {/* Mirror Folder (Google Drive / iCloud) */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold opacity-75">
                Google Drive / iCloud 同期フォルダのパス（自動ミラー同期）
              </label>
              <input
                type="text"
                value={mirrorFolderPath}
                onChange={(e) => setMirrorFolderPath(e.target.value)}
                placeholder="/Users/名前/Google Drive/マイドライブ/小説バックアップ"
                className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                  isSepia
                    ? 'bg-white border-amber-200 text-neutral-900'
                    : 'bg-[#121110] border-[#383531] text-neutral-100'
                }`}
              />
            </div>

            {/* GitHub Remote */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold opacity-75">GitHub リポジトリ URL（任意）</label>
                <input
                  type="text"
                  value={githubRemoteUrl}
                  onChange={(e) => setGithubRemoteUrl(e.target.value)}
                  placeholder="https://github.com/user/novel.git"
                  className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                    isSepia
                      ? 'bg-white border-amber-200 text-neutral-900'
                      : 'bg-[#121110] border-[#383531] text-neutral-100'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold opacity-75">GitHub Access Token (PAT)</label>
                <input
                  type="password"
                  value={githubPat}
                  onChange={(e) => setGithubPat(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxx"
                  className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                    isSepia
                      ? 'bg-white border-amber-200 text-neutral-900'
                      : 'bg-[#121110] border-[#383531] text-neutral-100'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* AI Settings */}
          <div className="space-y-3 pt-2">
            <label className="font-bold flex items-center gap-1.5 opacity-90">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              AI推敲アシスタントの接続 (GraphRAG 自動注入)
            </label>

            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'gemini', label: 'Gemini' },
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
                      : 'bg-[#272522] border-[#383531] text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {provider !== 'ollama' ? (
              <div className="space-y-1.5">
                <label className="text-[11px] opacity-75 flex items-center gap-1">
                  <Key className="w-3 h-3 text-amber-500" /> API キー
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="APIキーを貼り付け..."
                  className={`w-full border rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                    isSepia
                      ? 'bg-white border-amber-200 text-neutral-900'
                      : 'bg-[#151412] border-[#383531] text-neutral-100'
                  }`}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-[11px] opacity-75">ローカルURL（Ollama / LM Studio）</label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="http://localhost:11434/v1"
                  className={`w-full border rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                    isSepia
                  ? 'bg-white border-amber-200 text-neutral-900'
                  : 'bg-[#151412] border-[#383531] text-neutral-100'
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
                placeholder="gemini-1.5-pro / claude-3-5-sonnet / gpt-4o"
                className={`w-full border rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                  isSepia
                    ? 'bg-white border-amber-200 text-neutral-900'
                    : 'bg-[#151412] border-[#383531] text-neutral-100'
                }`}
              />
            </div>
          </div>

          {/* Paper Format */}
          <div className="space-y-2 pt-2 border-t border-neutral-500/15">
            <label className="font-bold opacity-90 block">基準とする原稿用紙フォーマット</label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-colors ${
                  targetPaper === '400'
                    ? 'border-amber-600 bg-amber-500/10 font-bold'
                    : isSepia
                    ? 'bg-white border-amber-200 opacity-70'
                    : 'bg-[#252321] border-[#383531] opacity-70'
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
                className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-colors ${
                  targetPaper === '1600'
                    ? 'border-amber-600 bg-amber-500/10 font-bold'
                    : isSepia
                    ? 'bg-white border-amber-200 opacity-70'
                    : 'bg-[#252321] border-[#383531] opacity-70'
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
            isSepia ? 'border-amber-200 bg-amber-50/50' : 'border-[#302e2a] bg-[#191816]'
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
            className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-md transition-all"
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
