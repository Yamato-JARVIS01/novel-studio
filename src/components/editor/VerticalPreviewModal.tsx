import { useEffect } from 'react';
import { useEditorStore } from '../../store';
import { X, BookOpen, Clock, FileSpreadsheet } from 'lucide-react';

export function VerticalPreviewModal() {
  const { isVerticalPreviewOpen, toggleVerticalPreview, body, frontmatter, metrics, theme } =
    useEditorStore();

  const isSepia = theme === 'cream-sepia';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVerticalPreviewOpen) {
        toggleVerticalPreview();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVerticalPreviewOpen, toggleVerticalPreview]);

  if (!isVerticalPreviewOpen) return null;

  // Split lines and format paragraphs for literary vertical layout
  const paragraphs = body.split('\n');

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-md animate-fade-in">
      {/* Top Bar */}
      <header
        className={`h-12 px-6 flex items-center justify-between border-b select-none z-10 ${
          isSepia
            ? 'bg-[#f4efe6] border-amber-900/10 text-neutral-800'
            : 'bg-[#181816] border-[#2c2a27] text-neutral-200'
        }`}
      >
        <div className="flex items-center gap-3">
          <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span className="font-bold text-sm tracking-wider">
            {frontmatter?.title || '縦書き組版プレビュー'}
          </span>
          <span className="text-[11px] opacity-50 border-l pl-3 border-neutral-500/20">
            文庫本スタイル（右開き・右から左へスクロール）
          </span>
        </div>

        <div className="flex items-center gap-5 text-xs opacity-75">
          <span className="flex items-center gap-1.5 font-mono">
            <FileSpreadsheet className="w-3.5 h-3.5 text-amber-500" />
            原稿用紙 {metrics.genko_20x20_pages.toFixed(1)} 枚（{metrics.chars_without_whitespace.toLocaleString()} 字）
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            読了目安 約 {metrics.estimated_reading_time_min} 分
          </span>
          <button
            onClick={toggleVerticalPreview}
            className="p-1.5 rounded-lg hover:bg-neutral-500/10 opacity-70 hover:opacity-100 transition-opacity ml-2"
            title="プレビューを閉じる (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Vertical Book Reader Area */}
      <div
        className={`flex-1 overflow-x-auto overflow-y-hidden p-8 flex flex-row-reverse items-center justify-start select-text ${
          isSepia ? 'bg-[#fbf9f5]' : 'bg-[#1a1917]'
        }`}
        style={{
          direction: 'rtl',
        }}
      >
        <div
          className={`h-[82vh] max-h-[900px] px-16 py-12 rounded-2xl shadow-2xl border transition-colors flex flex-col justify-between ${
            isSepia
              ? 'bg-[#f8f5ee] border-amber-900/10 text-[#25221e] shadow-amber-900/10'
              : 'bg-[#1f1e1c] border-[#302e2a] text-[#e8e4de] shadow-black/60'
          }`}
          style={{
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            fontFamily: '"Source Han Serif", "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif',
            letterSpacing: '0.08em',
            lineHeight: '2.4',
            direction: 'ltr',
          }}
        >
          {/* Header Title in Vertical layout */}
          {frontmatter?.title && (
            <div className="mb-10 text-xl font-bold tracking-widest opacity-90 pb-4 border-l border-neutral-500/20">
              {frontmatter.title}
            </div>
          )}

          {/* Book Content Paragraphs */}
          <div className="text-base select-text leading-loose">
            {paragraphs.map((para, index) => {
              if (!para.trim()) {
                return <div key={index} className="h-6" />;
              }
              return (
                <p key={index} className="my-1.5 break-all">
                  {para}
                </p>
              );
            })}
          </div>

          {/* Footer note in vertical layout */}
          <div className="mt-8 text-[11px] opacity-40 tracking-wider">
            NovelStudio 文庫組版プレビュー
          </div>
        </div>
      </div>
    </div>
  );
}
