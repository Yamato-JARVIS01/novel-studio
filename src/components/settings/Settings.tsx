import { useState } from 'react';
import { useVaultStore } from '../../store';
import { X, Settings as SettingsIcon, Key, Folder, Sparkles } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { vaultPath, setVaultPath } = useVaultStore();

  const [pathInput, setPathInput] = useState(vaultPath || '');
  const [provider, setProvider] = useState<'gemini' | 'claude' | 'openai' | 'ollama'>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gemini-1.5-pro');
  const [baseUrl, setBaseUrl] = useState('');
  const [targetPaper, setTargetPaper] = useState<'400' | '1600'>('400');

  if (!isOpen) return null;

  const handleSave = () => {
    if (pathInput.trim()) {
      setVaultPath(pathInput.trim());
    }
    // Save settings locally
    localStorage.setItem('novel_studio_provider', provider);
    localStorage.setItem('novel_studio_api_key', apiKey);
    localStorage.setItem('novel_studio_model', model);
    localStorage.setItem('novel_studio_base_url', baseUrl);
    localStorage.setItem('novel_studio_paper', targetPaper);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-[520px] bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#30363d] flex items-center justify-between bg-neutral-900/60">
          <div className="flex items-center gap-2 text-sm font-semibold text-neutral-200">
            <SettingsIcon className="w-4 h-4 text-sky-400" />
            NovelStudio 設定
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto text-xs text-neutral-300">
          {/* Storage Vault Path */}
          <div className="space-y-1.5">
            <label className="font-semibold text-neutral-200 flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-sky-400" />
              プロジェクト保存先 (Vault)
            </label>
            <input
              type="text"
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              placeholder="/Users/yourname/Documents/NovelStudioProjects"
              className="w-full bg-neutral-950 border border-neutral-700 rounded-md px-3 py-2 text-neutral-200 focus:outline-none focus:border-sky-500 font-mono text-[11px]"
            />
            <p className="text-[11px] text-neutral-500">
              iCloud Drive や Google Drive ローカル同期フォルダ、通常のフォルダを指定できます。
            </p>
          </div>

          {/* AI Engine Settings */}
          <div className="space-y-3 pt-3 border-t border-[#30363d]">
            <label className="font-semibold text-neutral-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              AI エンジン設定
            </label>

            <div className="grid grid-cols-4 gap-2">
              {(['gemini', 'claude', 'openai', 'ollama'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setProvider(p)}
                  className={`py-2 rounded border font-medium uppercase text-[10px] tracking-wider transition-colors ${
                    provider === p
                      ? 'bg-sky-950 border-sky-500 text-sky-300'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {provider !== 'ollama' ? (
              <div className="space-y-1.5">
                <label className="text-[11px] text-neutral-400 flex items-center gap-1">
                  <Key className="w-3 h-3" /> API キー
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-md px-3 py-2 text-neutral-200 focus:outline-none focus:border-sky-500 font-mono text-[11px]"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-[11px] text-neutral-400">エンドポイント URL (Base URL)</label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="http://localhost:11434/v1"
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-md px-3 py-2 text-neutral-200 focus:outline-none focus:border-sky-500 font-mono text-[11px]"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[11px] text-neutral-400">使用モデル名</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="gemini-1.5-pro / claude-3-5-sonnet / gpt-4o / llama3"
                className="w-full bg-neutral-950 border border-neutral-700 rounded-md px-3 py-2 text-neutral-200 focus:outline-none focus:border-sky-500 font-mono text-[11px]"
              />
            </div>
          </div>

          {/* Manuscript Format */}
          <div className="space-y-2 pt-3 border-t border-[#30363d]">
            <label className="font-semibold text-neutral-200">基準公募規定フォーマット</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="paper"
                  checked={targetPaper === '400'}
                  onChange={() => setTargetPaper('400')}
                  className="text-sky-500 focus:ring-0"
                />
                <span>400字詰原稿用紙 (20x20)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="paper"
                  checked={targetPaper === '1600'}
                  onChange={() => setTargetPaper('1600')}
                  className="text-sky-500 focus:ring-0"
                />
                <span>標準新人賞規定 (40x40 ページ換算)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#30363d] bg-neutral-900/60 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded text-neutral-400 hover:text-white transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium shadow-sm transition-colors"
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
