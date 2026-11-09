import React from 'react';
import {
  Download,
  Github,
  Sparkles,
  ArrowDown,
  Feather,
  Laptop,
  CheckCircle2,
  Terminal,
} from 'lucide-react';
import { LatestRelease } from '../hooks/useGitHubRelease';

interface HeroSectionProps {
  isAwakened: boolean;
  release: LatestRelease | null;
  onExploreDemo: () => void;
  onToggleAwaken: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  isAwakened,
  release,
  onExploreDemo,
  onToggleAwaken,
}) => {
  return (
    <section className="relative min-h-[92vh] flex flex-col justify-center items-center px-6 pt-24 pb-16 overflow-hidden">
      {/* Background Gradients & Grid */}
      <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />
      <div
        className={`absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[140px] pointer-events-none color-transition ${
          isAwakened
            ? 'bg-gradient-to-tr from-amber-600/25 via-amber-500/15 to-rose-600/20 opacity-100'
            : 'bg-white/5 opacity-50'
        }`}
      />

      {/* Top Banner Tag */}
      <div className="z-10 mb-8 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-neutral-700/60 bg-neutral-900/60 backdrop-blur-md text-xs tracking-wide">
        <Feather className={`w-3.5 h-3.5 color-transition ${isAwakened ? 'text-amber-400' : 'text-neutral-400'}`} />
        <span className="font-medium text-neutral-300">
          次世代ローカルファースト小説執筆スタジオ
        </span>
        <span className="opacity-30">|</span>
        <span className={`font-mono text-[11px] font-bold color-transition ${isAwakened ? 'text-amber-400' : 'text-neutral-300'}`}>
          {release?.version || 'v0.1.0'}
        </span>
      </div>

      {/* Main Catchphrase (Japanese High-end Typography) */}
      <div className="z-10 text-center max-w-4xl space-y-6">
        <h1 className="font-shippori text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.18] select-none">
          思考の速度で、
          <br />
          <span
            className={`color-transition ${
              isAwakened
                ? 'bg-gradient-to-r from-amber-200 via-amber-400 to-amber-100 bg-clip-text text-transparent'
                : 'text-neutral-100'
            }`}
          >
            物語を紡ぐ。
          </span>
        </h1>

        <p className="font-noto-serif text-base sm:text-xl text-neutral-400 max-w-2xl mx-auto leading-relaxed">
          散らばる設定も、絡み合う伏線も、すべてひとつの書斎に。
          <br className="hidden sm:inline" />
          KùzuDBグラフ相関 × 自律GraphRAG × 縦書き組版を備えた作家専用IDE。
        </p>
      </div>

      {/* Action Buttons */}
      <div className="z-10 mt-10 flex flex-wrap items-center justify-center gap-4">
        {/* Primary Download (macOS / Auto-detected) */}
        <a
          href={release?.macDownloadUrl || release?.htmlUrl || 'https://github.com/Yamato-JARVIS01/novel-studio/releases'}
          className={`px-7 py-3.5 rounded-2xl font-semibold text-sm flex items-center gap-2.5 shadow-xl transition-all color-transition ${
            isAwakened
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 shadow-amber-950/40 hover:scale-[1.02]'
              : 'bg-white hover:bg-neutral-200 text-black shadow-white/10 hover:scale-[1.02]'
          }`}
        >
          <Download className="w-4 h-4" />
          <span>NovelStudio を無料ダウンロード</span>
          <span className="text-[11px] opacity-75 font-mono ml-1">(macOS)</span>
        </a>

        {/* Explore Live Demo Anchor */}
        <button
          onClick={onExploreDemo}
          className="px-6 py-3.5 rounded-2xl font-semibold text-sm border border-neutral-700 bg-neutral-900/60 hover:bg-neutral-800 text-neutral-200 flex items-center gap-2 transition-all hover:border-neutral-500"
        >
          <Laptop className="w-4 h-4 text-neutral-400" />
          <span>ブラウザで体験（ライブデモ）</span>
        </button>

        {/* GitHub Source Code */}
        <a
          href="https://github.com/Yamato-JARVIS01/novel-studio"
          target="_blank"
          rel="noopener noreferrer"
          className="p-3.5 rounded-2xl border border-neutral-800 bg-neutral-900/40 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
          title="GitHub リポジトリ"
        >
          <Github className="w-5 h-5" />
        </a>
      </div>

      {/* Color Awakening Switch Hint */}
      <div className="z-10 mt-6 flex items-center gap-2 text-xs text-neutral-500">
        <button
          onClick={onToggleAwaken}
          className={`underline decoration-dotted underline-offset-4 hover:opacity-100 transition-opacity flex items-center gap-1.5 ${
            isAwakened ? 'text-amber-400' : 'text-neutral-400'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isAwakened ? '✨ 色彩を覚醒中（クリックでモノクロに戻す）' : '白黒の世界に色彩を取り戻す（クリック）'}</span>
        </button>
      </div>

      {/* Down Scroll Prompt */}
      <div className="z-10 mt-16 animate-bounce">
        <button
          onClick={onExploreDemo}
          className="p-2 rounded-full border border-neutral-800 text-neutral-500 hover:text-neutral-200 hover:border-neutral-600 transition-all"
          title="スタジオ体験へスクロール"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      </div>
    </section>
  );
};
