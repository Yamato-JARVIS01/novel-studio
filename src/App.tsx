import { useState } from 'react';
import { Sidebar } from './components/sidebar/Sidebar';
import { Editor } from './components/editor/Editor';
import { Inspector } from './components/inspector/Inspector';
import { SettingsModal } from './components/settings/Settings';
import { WorldStudioModal } from './components/world/WorldStudioModal';
import { ExportModal } from './components/export/ExportModal';
import { Settings as SettingsIcon, Share2, BookOpen, FileDown } from 'lucide-react';
import { useVaultStore, useEditorStore, useExportStore } from './store';

export default function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isWorldStudioOpen, setIsWorldStudioOpen] = useState(false);
  const [hoverTop, setHoverTop] = useState(false);
  const [hoverLeft, setHoverLeft] = useState(false);
  const [hoverRight, setHoverRight] = useState(false);

  const { vaultPath, activeFilePath } = useVaultStore();
  const { theme, isZenFocus, isTyping, isInspectorPinned } = useEditorStore();
  const { isOpen: isExportOpen, openExportModal, closeExportModal } = useExportStore();

  const isSepia = theme === 'cream-sepia';

  // Zen focus auto-fadeout conditions
  const shouldHideHeader = (isZenFocus || isTyping) && !hoverTop;
  const shouldHideSidebar = (isZenFocus || isTyping) && !hoverLeft;
  const shouldHideInspector = (isZenFocus || isTyping) && !hoverRight && !isInspectorPinned;

  return (
    <div
      className={`flex flex-col h-screen w-screen overflow-hidden transition-colors relative ${
        isSepia ? 'bg-[#fbf9f5] text-[#2a2622]' : 'bg-[#1a1917] text-[#e8e4de]'
      }`}
    >
      {/* Invisible Edge Hover Detection Zones for Zen Focus UI */}
      {(isZenFocus || isTyping) && (
        <>
          <div
            onMouseEnter={() => setHoverTop(true)}
            onMouseLeave={() => setHoverTop(false)}
            className="fixed top-0 left-0 right-0 h-3 z-50 pointer-events-auto"
          />
          <div
            onMouseEnter={() => setHoverLeft(true)}
            onMouseLeave={() => setHoverLeft(false)}
            className="fixed top-0 left-0 bottom-0 w-3 z-50 pointer-events-auto"
          />
          <div
            onMouseEnter={() => setHoverRight(true)}
            onMouseLeave={() => setHoverRight(false)}
            className="fixed top-0 right-0 bottom-0 w-3 z-50 pointer-events-auto"
          />
        </>
      )}

      {/* Literary Studio Header (Logo removed for pure Zen immersion) */}
      <header
        onMouseEnter={() => setHoverTop(true)}
        onMouseLeave={() => setHoverTop(false)}
        className={`h-11 border-b flex items-center justify-between px-4 select-none z-30 shrink-0 transition-all duration-300 ${
          shouldHideHeader
            ? '-mt-11 opacity-0 pointer-events-none'
            : 'opacity-100 pointer-events-auto'
        } ${
          isSepia
            ? 'bg-[#f6f2ea]/90 border-amber-900/10 backdrop-blur-md'
            : 'bg-[#181816]/90 border-[#2c2a27] backdrop-blur-md'
        }`}
      >
        {/* Work & Episode Breadcrumb */}
        <div className="flex items-center space-x-2.5 text-xs">
          <BookOpen className="w-3.5 h-3.5 text-amber-600/80 dark:text-amber-400/80" />
          <span className="font-semibold opacity-75 truncate max-w-sm">
            {vaultPath ? vaultPath.split('/').pop() : '本棚未選択'}
          </span>
          {activeFilePath && (
            <>
              <span className="opacity-30">/</span>
              <span className="font-medium text-amber-700 dark:text-amber-300 truncate max-w-xs">
                {activeFilePath.split('/').pop()?.replace(/\.md$|\.txt$/, '')}
              </span>
            </>
          )}
        </div>

        {/* Action Controls */}
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

          {/* Export Studio Button */}
          <button
            onClick={() => openExportModal()}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              isSepia
                ? 'bg-amber-600/10 hover:bg-amber-600/20 text-amber-900 border-amber-600/30'
                : 'bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 border-amber-400/30'
            }`}
            title="公募提出用原稿や各種Web小説サイト向け記法に一括エクスポート"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>原稿出力</span>
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

      {/* 3-Pane Literary Studio Layout with Smooth Zen Transitions */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* Left Pane: Episodes Bookshelf */}
        <div
          onMouseEnter={() => setHoverLeft(true)}
          onMouseLeave={() => setHoverLeft(false)}
          className={`h-full transition-all duration-300 flex shrink-0 ${
            shouldHideSidebar
              ? '-ml-64 opacity-0 pointer-events-none'
              : 'opacity-100 pointer-events-auto'
          }`}
        >
          <Sidebar />
        </div>

        {/* Center Pane: Writing Desk */}
        <Editor onOpenSettings={() => setIsSettingsOpen(true)} />

        {/* Right Pane: Manuscript & Scene Inspector */}
        <div
          onMouseEnter={() => setHoverRight(true)}
          onMouseLeave={() => setHoverRight(false)}
          className={`h-full transition-all duration-300 flex shrink-0 ${
            shouldHideInspector
              ? '-mr-80 opacity-0 pointer-events-none'
              : 'opacity-100 pointer-events-auto'
          }`}
        >
          <Inspector />
        </div>
      </main>

      {/* World Graph Studio Modal */}
      <WorldStudioModal isOpen={isWorldStudioOpen} onClose={() => setIsWorldStudioOpen(false)} />

      {/* Settings Modal */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* Export Studio Modal */}
      <ExportModal isOpen={isExportOpen} onClose={closeExportModal} />
    </div>
  );
}
