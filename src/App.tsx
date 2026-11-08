import { useState } from 'react';
import { Sidebar } from './components/sidebar/Sidebar';
import { Editor } from './components/editor/Editor';
import { Inspector } from './components/inspector/Inspector';
import { SettingsModal } from './components/settings/Settings';
import { WorldStudioModal } from './components/world/WorldStudioModal';
import { Settings as SettingsIcon, Feather, Share2 } from 'lucide-react';
import { useVaultStore, useEditorStore } from './store';

export default function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isWorldStudioOpen, setIsWorldStudioOpen] = useState(false);
  const { vaultPath } = useVaultStore();
  const { theme } = useEditorStore();

  const isSepia = theme === 'cream-sepia';

  return (
    <div
      className={`flex flex-col h-screen w-screen overflow-hidden transition-colors ${
        isSepia ? 'bg-[#fbf9f5] text-[#2a2622]' : 'bg-[#1a1917] text-[#e8e4de]'
      }`}
    >
      {/* Literary Studio Header */}
      <header
        className={`h-11 border-b flex items-center justify-between px-4 select-none z-30 shrink-0 transition-colors ${
          isSepia
            ? 'bg-[#f6f2ea]/90 border-amber-900/10 backdrop-blur-md'
            : 'bg-[#181816]/90 border-[#2c2a27] backdrop-blur-md'
        }`}
      >
        <div className="flex items-center space-x-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-amber-600 to-amber-500 flex items-center justify-center text-white shadow-xs">
              <Feather className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-sm tracking-wide bg-gradient-to-r from-amber-600 to-amber-700 dark:from-amber-400 dark:to-amber-200 bg-clip-text text-transparent">
              NovelStudio
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
              文芸スタジオ
            </span>
          </div>

          <span className="opacity-20">|</span>

          <span className="text-xs font-medium opacity-60 truncate max-w-sm">
            {vaultPath ? `作品本棚: ${vaultPath.split('/').pop()}` : '本棚未選択'}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* World Graph Studio Button */}
          <button
            onClick={() => setIsWorldStudioOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              isSepia
                ? 'bg-amber-600/10 hover:bg-amber-600/20 text-amber-900 border-amber-600/30'
                : 'bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 border-amber-400/30'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>世界観・相関図</span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 font-mono">
              GraphRAG
            </span>
          </button>

          {/* Settings Trigger */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              isSepia
                ? 'bg-white hover:bg-amber-50 border-amber-200 text-neutral-700 shadow-2xs'
                : 'bg-[#22211f] hover:bg-[#2c2a27] border-[#383531] text-neutral-300'
            }`}
          >
            <SettingsIcon className="w-3.5 h-3.5" />
            <span>環境設定</span>
          </button>
        </div>
      </header>

      {/* 3-Pane Literary Studio Layout */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Pane: Episodes Bookshelf */}
        <Sidebar />

        {/* Center Pane: Writing Desk */}
        <Editor onOpenSettings={() => setIsSettingsOpen(true)} />

        {/* Right Pane: Manuscript & Scene Inspector */}
        <Inspector />
      </main>

      {/* World Graph Studio Modal */}
      <WorldStudioModal isOpen={isWorldStudioOpen} onClose={() => setIsWorldStudioOpen(false)} />

      {/* Settings Modal */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
