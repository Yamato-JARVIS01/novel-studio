import React, { useState, useEffect, useRef } from 'react';
import { HeroSection } from './components/HeroSection';
import { LiveDemoSection } from './components/LiveDemoSection';
import { FeaturesSection } from './components/FeaturesSection';
import { DownloadSection } from './components/DownloadSection';
import { Footer } from './components/Footer';
import { useGitHubRelease } from './hooks/useGitHubRelease';
import { Feather, Download, Github, Sparkles } from 'lucide-react';

export default function App() {
  const [isAwakened, setIsAwakened] = useState(false);
  const { release, isLoading } = useGitHubRelease();
  const demoRef = useRef<HTMLDivElement | null>(null);

  // IntersectionObserver to awaken colors when user scrolls into demo
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsAwakened(true);
        }
      },
      { threshold: 0.2 }
    );

    if (demoRef.current) {
      observer.observe(demoRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleScrollToDemo = () => {
    demoRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleScrollToDownload = () => {
    document.getElementById('download')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div
      className={`min-h-screen text-[#e4e4e4] color-transition ${
        isAwakened
          ? 'bg-[#0f0e0d] selection:bg-amber-500/40 selection:text-amber-100'
          : 'bg-[#0a0a0a] selection:bg-white/20 selection:text-white'
      }`}
    >
      {/* Top Fixed Navigation Bar */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-xl color-transition ${
          isAwakened
            ? 'bg-[#141311]/80 border-amber-900/20'
            : 'bg-black/60 border-neutral-900'
        }`}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm color-transition ${
                isAwakened ? 'bg-amber-500 text-neutral-950' : 'bg-white text-black'
              }`}
            >
              <Feather className="w-4 h-4" />
            </div>
            <span className="font-shippori font-bold text-base tracking-wide text-white">
              NovelStudio
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={handleScrollToDemo}
              className="text-xs font-medium text-neutral-400 hover:text-white transition-colors hidden sm:inline"
            >
              ライブ体験
            </button>
            <button
              onClick={handleScrollToDownload}
              className="text-xs font-medium text-neutral-400 hover:text-white transition-colors hidden sm:inline"
            >
              ダウンロード
            </button>

            {/* Awaken Toggle Button */}
            <button
              onClick={() => setIsAwakened(!isAwakened)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 ${
                isAwakened
                  ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                  : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white'
              }`}
              title="モノクロ / 色彩覚醒トグル"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{isAwakened ? '色彩覚醒中' : '色彩の覚醒'}</span>
            </button>

            {/* Quick Download Header Button */}
            <a
              href={release?.macDownloadUrl || release?.htmlUrl || 'https://github.com/Yamato-JARVIS01/novel-studio/releases'}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all color-transition ${
                isAwakened
                  ? 'bg-amber-500 hover:bg-amber-400 text-neutral-950 shadow-amber-950/40'
                  : 'bg-white hover:bg-neutral-200 text-black'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>ダウンロード</span>
            </a>

            {/* GitHub Star */}
            <a
              href="https://github.com/Yamato-JARVIS01/novel-studio"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl border border-neutral-800 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
              title="GitHub Star"
            >
              <Github className="w-4 h-4" />
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <HeroSection
        isAwakened={isAwakened}
        release={release}
        onExploreDemo={handleScrollToDemo}
        onToggleAwaken={() => setIsAwakened(!isAwakened)}
      />

      {/* Live Demo Section */}
      <div ref={demoRef}>
        <LiveDemoSection
          isAwakened={isAwakened}
          onInteract={() => setIsAwakened(true)}
        />
      </div>

      {/* Features Section */}
      <FeaturesSection isAwakened={isAwakened} />

      {/* Download Section */}
      <DownloadSection release={release} isAwakened={isAwakened} />

      {/* Footer */}
      <Footer />
    </div>
  );
}
