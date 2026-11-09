import React from 'react';
import {
  Share2,
  Compass,
  BookOpen,
  History,
  DownloadCloud,
  Zap,
  Sparkles,
  GitBranch,
} from 'lucide-react';

interface FeaturesSectionProps {
  isAwakened: boolean;
}

export const FeaturesSection: React.FC<FeaturesSectionProps> = ({ isAwakened }) => {
  const features = [
    {
      icon: <Share2 className="w-5 h-5 text-amber-400" />,
      title: 'KùzuDB 埋め込みグラフDB & GraphRAG',
      desc: '設定ノートから人物相関・世界観ルールをグラフ構造化。本文執筆時に出現した設定を自動照合し、一人称ブレや関係性の矛盾をリアルタイム検出。',
      tag: 'GraphRAG',
    },
    {
      icon: <Compass className="w-5 h-5 text-amber-400" />,
      title: 'GPU Direct 120fps Todo筋書き羅針盤',
      desc: '画面内を完全吸い付きで移動するフローティングHUD。起承転結ビートをチェックリストで管理し、執筆達成率をリアルタイム可視化。',
      tag: 'Plot HUD',
    },
    {
      icon: <GitBranch className="w-5 h-5 text-rose-400" />,
      title: '時系列フェーズ & 色分け伏線ダイヤモンド',
      desc: '話数ごとの相関変化をマルチページで管理。舞台・場所ゾーンの下層配置と、色付きダイヤモンドで表現される伏線リレーション。',
      tag: 'Visual Graph',
    },
    {
      icon: <BookOpen className="w-5 h-5 text-cyan-400" />,
      title: '公募規定・Web小説一括エクスポートスタジオ',
      desc: 'ルビ・傍点をカクヨム・なろう・青空文庫形式へ一括変換。400字詰原稿用紙換算枚数つきの縦書き組版PDF印刷HTMLもワンクリック生成。',
      tag: 'Export Studio',
    },
    {
      icon: <History className="w-5 h-5 text-emerald-400" />,
      title: '完全自律Git & タイムマシン秒単位復元',
      desc: '外部クラウドに依存しない完全ローカルGit履歴。文字を削りすぎても、タイムマシンUIで過去の執筆スナップショットを瞬時に救出。',
      tag: 'Time Machine',
    },
    {
      icon: <Zap className="w-5 h-5 text-yellow-400" />,
      title: 'Rust / Tauri 2.0 超軽量ネイティブ駆動',
      desc: 'Electron比メモリ消費90%削減。数万字〜数十万字の長編原稿でもCPU負荷ゼロ、MacBookのバッテリーを消耗しない真のポータブル書斎。',
      tag: 'High Performance',
    },
  ];

  return (
    <section className="py-20 px-6 max-w-6xl mx-auto">
      <div className="text-center space-y-4 mb-14">
        <h2 className="font-shippori text-3xl sm:text-4xl font-bold tracking-tight">
          物語の構築に必要なすべてを、ひとつの画面に
        </h2>
        <p className="text-neutral-400 text-sm sm:text-base max-w-xl mx-auto">
          ただのテキストエディタでも、ただの相関図ツールでもない。
          長編小説を書き抜く作家のために設計されたフルスタック創作スタジオ。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feat, idx) => (
          <div
            key={idx}
            className={`p-6 rounded-3xl border transition-all hover:scale-[1.01] color-transition flex flex-col justify-between ${
              isAwakened
                ? 'bg-[#181715]/80 border-neutral-800 hover:border-amber-500/40 shadow-lg hover:shadow-amber-950/20'
                : 'bg-neutral-900/40 border-neutral-800 hover:border-neutral-600 shadow-md'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
                    isAwakened
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-white/5 border-white/10'
                  }`}
                >
                  {feat.icon}
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400">
                  {feat.tag}
                </span>
              </div>
              <h3 className="text-base font-bold mb-2 tracking-wide text-neutral-100">
                {feat.title}
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                {feat.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
