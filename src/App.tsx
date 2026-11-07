import { useState } from 'react';
import { Sidebar } from './components/sidebar/Sidebar';
import { Editor } from './components/editor/Editor';
import { Inspector } from './components/inspector/Inspector';
import { SettingsModal } from './components/settings/Settings';
import { Settings as SettingsIcon } from 'lucide-react';
import { useVaultStore } from './store';

export default function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { vaultPath } = useVaultStore();

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0d1117] text-neutral-100 overflow-hidden">
      {/* Top Main Navigation Header */}
      <header className="h-10 border-b border-[#30363d] flex items-center justify-between px-4 bg-[#161b22]/90 backdrop-blur select-none z-30 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-wide bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
              NovelStudio
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-sky-950 text-sky-400 border border-sky-800/40">
              Native v0.1.0
            </span>
          </div>

          <span className="text-neutral-700">|</span>

          <span className="text-xs text-neutral-400 font-medium truncate max-w-sm">
            {vaultPath ? `Vault: ${vaultPath.split('/').pop()}` : 'No Vault Open'}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Settings Trigger */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs bg-neutral-900 border border-neutral-700 hover:border-neutral-600 text-neutral-300 hover:text-white transition-colors"
          >
            <SettingsIcon className="w-3.5 h-3.5" />
            <span>設定</span>
          </button>
        </div>
      </header>

      {/* 3-Pane Layout */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Pane: Sidebar */}
        <Sidebar />

        {/* Center Pane: Editor */}
        <Editor />

        {/* Right Pane: Inspector */}
        <Inspector />
      </main>

      {/* Settings Modal */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
