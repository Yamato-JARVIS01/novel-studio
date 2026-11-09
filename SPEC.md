# Project Specification: "NovelStudio" (Tauri v2 Native AI Studio for Novelists)

## 1. プロダクトビジョンと設計原則
1. **Zero-Latency Typing（打鍵速度最優先）**：10万字超の長編ファイルでも入力遅延ゼロを実現する。UIスレッド（WebView）で重い処理は一切行わず、AST解析・文字数換算・ファイル保存・AI通信・Git操作はすべてRustバックエンド（`tokio` 非同期ランタイム）で処理する。
2. **Invisible Git & Cloud Sync（意識させない同期と履歴管理）**：エンジニアはGitHub直結、一般作家はiCloud Drive / Google Driveのローカル同期フォルダを選ぶだけで使える「Storage Adapter」を搭載する。Gitのブランチ作成やDiff生成は裏側でRustの `git2` クレートが自動処理し、ユーザーには「AIからの推敲提案（採用／却下ボタン）」としてのみ見せる。
3. **Pluggable AI Engine（ワンクリックAI接続）**：Gemini / Claude / OpenAI のクラウドAPI、およびローカルLLM（Ollama / LM Studio等のOpenAI互換エンドポイント）をGUIのドロップダウンとキー入力だけで切り替え可能にする。

## 2. 技術スタック
### Frontend (TypeScript / Ultra-Modern UI)
- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui + Framer Motion（ダークモード基調、グラスモーフィズム、滑らかなパネル開閉）
- **Editor Core**: **CodeMirror 6**（Monacoより圧倒的に軽量でIME日本語入力の親和性が高く、行単位のInline Diff表示やカスタムデコレーションが高速）
- **State Management**: Zustand（軽量・高速な状態管理）

### Backend (Rust / Tauri v2 Core)
- **Framework**: Tauri v2
- **Async Runtime**: `tokio`
- **File Watcher & I/O**: `notify`（Obsidian等の外部変更も即座に検知）、`serde_yaml`（Frontmatter高速パース）
- **Git Engine**: `git2` (`features = ["vendored-libgit2", "vendored-openssl"]` を指定しOS非依存でビルド完結させる) + `octocrab` (GitHub OAuth / PR自動作成API)
- **HTTP / AI Client**: `reqwest` + `eventsource-stream`（AI出力の高速ストリーミング受信）
- **Security**: `keyring`（OS標準のKeychain / Credential ManagerにAPIキーやGitHubトークンを安全に保存）

## 3. ディレクトリ構造
    novel-studio/
    ├── src/                          # [Frontend] TypeScript + React
    │   ├── components/
    │   │   ├── editor/               # CodeMirror 6 ラッパー & Inline Diff Merge UI
    │   │   ├── sidebar/              # Vaultツリー & シーン状態（Draft/Ready/Reviewed）バッジ
    │   │   ├── inspector/            # 右パネル：兵站・時系列・文字数換算・AI監査レポート表示
    │   │   └── settings/             # 1分セットアップウィザード（保存先・AI API・公募規定選択）
    │   ├── store/                    # Zustand (EditorState, VaultState, AIJobState)
    │   └── lib/tauri-commands.ts     # Rust IPC (invoke / Channel) の型安全ラッパー
    ├── src-tauri/                    # [Backend] Rust
    │   ├── Cargo.toml
    │   └── src/
    │       ├── main.rs / lib.rs      # Tauri初期化・IPCコマンド登録
    │       ├── editor_engine/
    │       │   ├── frontmatter.rs    # YAML Frontmatter分離・ステータス更新
    │       │   └── jp_linter.rs      # 超高速日本語組版リンター＆公募原稿用紙換算（40x40等）
    │       ├── storage/
    │       │   ├── mod.rs            # Storage Trait (LocalFolder / iCloud / GoogleDrive / GitHub)
    │       │   └── git_manager.rs    # libgit2による裏ブランチ作成・自動Commit・GitHub PR送信
    │       └── ai/
    │           ├── provider.rs       # OpenAI互換 / Gemini / Claude 統合クライアント
    │           └── pipeline.rs       # 夜間・バックグラウンド実行（論理監査＋表現推敲Diff生成）

## 4. 自律実装ロードマップ（AIエージェントへの指示）
各Phaseを順番に実装し、必ず `cargo check` およびフロントエンドのビルド（`npm run build`）がエラーなく通ることを確認してから、`git add . && git commit && git push -u origin main` を行って次のPhaseへ進むこと。

- [x] **Phase 1: プロジェクト初期化 & Tauri v2 スキャフォールド**
  - Vite + React + TypeScript + Tailwind CSS + Tauri v2 の初期構成を作成し、最小構成でコンパイルが通ることを確認して初回Pushする。
- [x] **Phase 2: Rust Backend - エディタエンジン (`editor_engine`)**
  - `frontmatter.rs`（YAMLパース）と `jp_linter.rs`（40x40原稿用紙換算・日本語組版チェック）を実装し、テストを通す。
- [x] **Phase 3: Rust Backend - ストレージ & Gitエンジン (`storage`)**
  - `git2` クレートを用いた裏ブランチ作成・自動Commit・Diff抽出ロジックを実装し、Tauri IPCコマンドとして登録する。
- [x] **Phase 4: Frontend - 3ペインUI & CodeMirror 6 統合**
  - Sidebar（Vaultツリー）、Editor（CodeMirror 6 + Inline Diff）、Inspector（原稿用紙換算・リンター結果リアルタイム表示）をZustandで繋ぐ。
- [x] **Phase 5: AI Engine 統合 (`ai`)**
  - OpenAI互換 / Gemini / Claude のストリーミング通信クライアントと推敲Diff生成パイプラインを接続し、設定ウィザードUIと繋ぐ。
- [x] **Phase 6: 文芸スタジオUI/UX全面刷新 & オンボーディング**
  - エンジニア用語の完全排除（Invisible Git・安心の自動バックアップ表示）、ウェルカムオンボーディング画面（ワンクリックサンプル作成）、和紙セピア・ウォームダーク調のCodeMirror 6空間、エピソード直感追加、進捗プログレスバー、AI推敲ガイド親切化を実装。
- [x] **Phase 6 Polish: 執筆没頭のための組版・折り返し・Invisible Frontmatter徹底**
  - CodeMirror 6 の `EditorView.lineWrapping` による自動行折り返しの徹底、エディタからの YAML Frontmatter 完全隠蔽（本文のみ表示＋右パネルフォーム連携で自動結合保存）、文庫本風「📖 縦書き組版プレビュー」モードを実装。
- [x] **Phase 7: 世界観グラフDB (WorldGraph & GraphRAG) ＆ ゼロタッチ・クラウド同期**
  - Petgraphによる世界観・人物相関ナレッジグラフエンジン、GraphRAG文脈自動注入プロンプト、設定ノート・プロットマークダウンの双方向同期、GitHubクラウドミラー自動バックアップを実装。
- [x] **Phase 8: ルビ記法レンダリング & タイムマシン（過去復元）& エピソードGUI並び替え**
  - CodeMirror 6カスタムルビ拡張装飾、Gitコミット履歴からのワンクリック過去スナップショット閲覧・復元、ドラッグ＆ドロップおよび上下ボタンによるエピソード直感並び替えを実装。
- [x] **Phase 9: 原稿からの自律設定逆抽出 ＆ 筋書きからのシーン展開支援**
  - 原稿から未登録の固有名詞・登場人物・世界観用語・相関関係を逆抽出してノートとグラフDBに還元する `sync_manuscript_to_world` パイプラインを実装。
  - フローティング筋書きHUD直結のシーンビート提案（起承転結ブレイクダウン）および本文への加筆・推敲下書き展開（シャドウブランチ＆Inline Diff連携）を実装。
- [x] **Phase 10: 公募規定・Web小説一括エクスポートエンジン ＆ ビルド軽量化**
  - `ExportEngine` による公募提出用統合原稿（扉ページ・400字詰/20x20/40x40換算）、印刷・PDF用縦書き組版HTML、各種Web小説サイト記法（カクヨム/なろう/青空文庫/プレーン）の一括変換・プレビュー・保存・クリップボードコピーを実装。
  - `Cargo.toml` の `profile.dev` / `profile.test` の debuginfo 最適化によるビルドキャッシュ肥大化防止を設定。
- [x] **Phase 11: 執筆没入UIリファイン & プロットHUD & 世界観グラフ拡張**
  - ヘッダー・サイドバーのZen没入自動フェードアウト、GPU最適化フローティング筋書きHUD、人物画像設定、長文ノート同期、相関関係の双方向可視化を実装。
- [x] **Phase 12: OSS公開基盤・MITライセンス & プロダクトドキュメント整備**
  - MIT LICENSEの策定、README.mdの刷新、GitHub Actionsによるマルチプラットフォーム自動リリースワークフローを構築。
- [x] **Phase 13: フォルダ作成不要の「GUI作品本棚マネージャー」& 非エンジニア向け「ワンクリックGitHub・クラウド・AI自動接続」**
  - **作品本棚マネージャー (`BookShelfModal`)**: 標準書斎ルート（`~/Documents/NovelStudio/`）の全自動管理、GUI執筆開始ウィザード（タイトル・用紙規定・あらすじ入力からGit/世界観/第1話エピソードを一瞬で自動初期化）、美しいブックカード形式での複数作品ワンクリック切替・整理・安全削除（`.trash` 退避）。
  - **ワンクリック Cloud Drive 直結**: 設定画面のパス手入力を廃止し、「🍎 iCloud Drive」「📁 Google Drive」「💻 このMac内（書類フォルダ）」の3大ビジュアルカードでワンクリック即時二重化保護。
  - **ワンクリック GitHub & AI 自動接続**: `gh` CLI の自動検出・ワンクリックアカウント連携、ローカルAI（Ollama / LM Studio）稼働自動検知＆ワンクリック接続、無料APIキー取得導線、リアルタイムAI接続テスト機能を実装。
