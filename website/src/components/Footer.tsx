import React from 'react';
import { Feather, Github, Heart, ArrowUp } from 'lucide-react';

export const Footer: React.FC = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="border-t border-neutral-900 bg-[#090909] py-12 px-6 text-xs text-neutral-500">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2 text-neutral-300 font-bold">
          <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <Feather className="w-3.5 h-3.5" />
          </div>
          <span className="font-shippori text-sm">NovelStudio</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono ml-1">
            Open Source
          </span>
        </div>

        <p className="text-center sm:text-left">
          Crafted with <Heart className="w-3 h-3 text-rose-500 inline mx-0.5" /> for novelists and world builders.
          Released under the MIT License.
        </p>

        <div className="flex items-center gap-4">
          <a
            href="https://github.com/Yamato-JARVIS01/novel-studio"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-neutral-300 transition-colors flex items-center gap-1"
          >
            <Github className="w-4 h-4" />
            <span>GitHub</span>
          </a>

          <button
            onClick={scrollToTop}
            className="p-2 rounded-xl border border-neutral-800 hover:border-neutral-600 hover:text-neutral-200 transition-all"
            title="ページトップへ戻る"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </footer>
  );
};
