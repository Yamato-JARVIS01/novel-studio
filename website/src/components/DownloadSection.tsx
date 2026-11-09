import React from 'react';
import {
  Download,
  Apple,
  Cpu,
  Terminal,
  ExternalLink,
  ShieldCheck,
  Check,
  Github,
} from 'lucide-react';
import { LatestRelease } from '../hooks/useGitHubRelease';

interface DownloadSectionProps {
  release: LatestRelease | null;
  isAwakened: boolean;
}

export const DownloadSection: React.FC<DownloadSectionProps> = ({ release, isAwakened }) => {
  const [copiedCmd, setCopiedCmd] = React.useState(false);
  const gatekeeperCommand = 'xattr -cr /Applications/NovelStudio.app';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(gatekeeperCommand);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  return (
    <section id="download" className="py-20 px-6 max-w-5xl mx-auto">
      <div
        className={`rounded-3xl border p-8 sm:p-12 shadow-2xl relative overflow-hidden color-transition ${
          isAwakened
            ? 'bg-gradient-to-b from-[#1b1916] to-[#121110] border-amber-500/30 ring-1 ring-amber-500/20'
            : 'bg-neutral-900/60 border-neutral-800'
        }`}
      >
        <div className="text-center space-y-4 max-w-2xl mx-auto mb-10">
          <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-neutral-800 text-amber-400 border border-neutral-700">
            {release?.version || 'v0.1.0'} 最新リリース
          </span>
          <h2 className="font-shippori text-3xl sm:text-4xl font-bold tracking-tight">
            あなたのPCに、極上の創作空間を。
          </h2>
          <p className="text-sm text-neutral-400 leading-relaxed">
            完全無料・オープンソース（MIT License）。インターネット環境がなくても、
            原稿データが外部サーバへ送信されることは一切ありません。
          </p>
        </div>

        {/* Platform Downloads Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {/* macOS */}
          <a
            href={release?.macDownloadUrl || release?.htmlUrl || 'https://github.com/Yamato-JARVIS01/novel-studio/releases'}
            className="p-5 rounded-2xl border border-neutral-800 bg-black/40 hover:border-amber-500/50 hover:bg-neutral-800/50 transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xl">🍎</span>
                <span className="text-[10px] font-mono text-neutral-500">Apple Silicon / Intel</span>
              </div>
              <h3 className="font-bold text-sm text-neutral-100 group-hover:text-amber-400 transition-colors">
                macOS 用 (.dmg)
              </h3>
              <p className="text-xs text-neutral-400 mt-1">macOS 12.0 (Monterey) 以降</p>
            </div>
            <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs text-amber-400 font-semibold">
              <span>ダウンロード</span>
              <Download className="w-3.5 h-3.5" />
            </div>
          </a>

          {/* Windows */}
          <a
            href={release?.winDownloadUrl || release?.htmlUrl || 'https://github.com/Yamato-JARVIS01/novel-studio/releases'}
            className="p-5 rounded-2xl border border-neutral-800 bg-black/40 hover:border-amber-500/50 hover:bg-neutral-800/50 transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xl">🪟</span>
                <span className="text-[10px] font-mono text-neutral-500">64-bit Installer</span>
              </div>
              <h3 className="font-bold text-sm text-neutral-100 group-hover:text-amber-400 transition-colors">
                Windows 用 (.msi / .exe)
              </h3>
              <p className="text-xs text-neutral-400 mt-1">Windows 10 / 11 対応</p>
            </div>
            <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs text-amber-400 font-semibold">
              <span>ダウンロード</span>
              <Download className="w-3.5 h-3.5" />
            </div>
          </a>

          {/* Linux / Source */}
          <a
            href={release?.linuxDownloadUrl || release?.htmlUrl || 'https://github.com/Yamato-JARVIS01/novel-studio/releases'}
            className="p-5 rounded-2xl border border-neutral-800 bg-black/40 hover:border-amber-500/50 hover:bg-neutral-800/50 transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xl">🐧</span>
                <span className="text-[10px] font-mono text-neutral-500">Universal AppImage</span>
              </div>
              <h3 className="font-bold text-sm text-neutral-100 group-hover:text-amber-400 transition-colors">
                Linux 用 (.AppImage)
              </h3>
              <p className="text-xs text-neutral-400 mt-1">Ubuntu, Fedora, Arch 等</p>
            </div>
            <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs text-amber-400 font-semibold">
              <span>ダウンロード</span>
              <Download className="w-3.5 h-3.5" />
            </div>
          </a>
        </div>

        {/* macOS Security Note (Gatekeeper workaround guide) */}
        <div className="p-4 rounded-2xl bg-black/50 border border-neutral-800 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              macOS で「開発元が未確認のため開けません」と表示される場合:
            </span>
            <button
              onClick={copyToClipboard}
              className="text-[11px] text-amber-400 hover:underline flex items-center gap-1 font-mono"
            >
              {copiedCmd ? <Check className="w-3 h-3" /> : null}
              {copiedCmd ? 'コピー完了' : 'コマンドをコピー'}
            </button>
          </div>
          <p className="text-neutral-400">
            オープンソース個人ビルドのため、初回起動時にAppleの警告が出る場合があります。
            ターミナルで以下のコマンドを実行することで解除できます：
          </p>
          <div className="p-2.5 rounded-lg bg-neutral-950 font-mono text-neutral-300 flex items-center justify-between overflow-x-auto">
            <code>{gatekeeperCommand}</code>
          </div>
        </div>
      </div>
    </section>
  );
};
