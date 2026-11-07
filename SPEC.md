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
- [ ] **Phase 3: Rust Backend - ストレージ & Gitエンジン (`storage`)**
  - `git2` クレートを用いた裏ブランチ作成・自動Commit・Diff抽出ロジックを実装し、Tauri IPCコマンドとして登録する。
- [ ] **Phase 4: Frontend - 3ペインUI & CodeMirror 6 統合**
  - Sidebar（Vaultツリー）、Editor（CodeMirror 6 + Inline Diff）、Inspector（原稿用紙換算・リンター結果リアルタイム表示）をZustandで繋ぐ。
- [ ] **Phase 5: AI Engine 統合 (`ai`)**
  - OpenAI互換 / Gemini / Claude のストリーミング通信クライアントと推敲Diff生成パイプラインを接続し、設定ウィザードUIと繋ぐ。
