> [EN](./README.md) | [ZH](./README.zh-CN.md) | [ES](./README.es.md) | [HI](./README.hi.md) | [PT](./README.pt-BR.md) | [JA](./README.ja.md)

# claude-code-tips

[![CI](https://github.com/anipotts/claude-code-tips/actions/workflows/validate.yml/badge.svg)](https://github.com/anipotts/claude-code-tips/actions/workflows/validate.yml)
[![GitHub stars](https://img.shields.io/github/stars/anipotts/claude-code-tips?style=flat-square&labelColor=111827&color=000)](https://github.com/anipotts/claude-code-tips/stargazers)
[![last commit](https://img.shields.io/github/last-commit/anipotts/claude-code-tips?style=flat-square&labelColor=111827&color=000)](https://github.com/anipotts/claude-code-tips/commits/main)
[![tested with](https://img.shields.io/badge/tested%20with-Claude%20Code%20v2.1.122-000?style=flat-square&labelColor=D4A574&logo=anthropic&logoColor=white)](https://docs.anthropic.com/en/docs/claude-code)
[![license](https://img.shields.io/github/license/anipotts/claude-code-tips?style=flat-square&labelColor=111827&color=000)](./LICENSE)

YCスタートアップから大手テック企業、ユニコーン企業まで、実戦で鍛えられたClaudeコードのパターン集。Claude Codeを仕事にしている人間が保守している。

初めての人は[tips索引](./docs/tips/)から始めるか、[hooks](./docs/hooks.md)と[automation](./docs/automation.md)を読み流すといい。

## 中身

3つのプラグイン、1つのマーケットプレイス。

- **`lore@claude-code-tips`** 全セッションをsqliteに蓄積。費用、ツール、エラー、ホットスポット、ループ、全文検索をお前の履歴から引き出す。全部ローカル。
- **`cc@claude-code-tips`** セッション横断の認識とメッセージング。加えて`time`サブシステム：`/cc:time-estimate`は楽観的な推測ではなく、お前のセッション履歴に基づいたリアルなClaudeコード時間を返す。
- **`time@claude-code-tips`** 3メートルのフューエルゲージ（5時間セッション、7日週間、200kコンテキスト）。メータが満杯に近づくと、PreTurnフックがClaudeをより明快なハンドオフに導く。`/fuel state`で直接読み込める。`/fuel handoff`で停止ポイントのドラフトを作る。

```
> /cc:time-estimate "rewrite auth middleware and add tests"
CC: ~22 min active (standard mode, Opus 4.7 high)
your time: ~15 min review
```

## クイックスタート

```bash
/plugin marketplace add anipotts/claude-code-tips   # マーケットプレイスを追加（1回だけ）
/plugin install lore@claude-code-tips                             # loreをインストール（セッション分析）
/plugin install cc@claude-code-tips                               # ccをインストール（クロスセッションメッセージング）
```

その後：[safety-guard.sh](./hooks/safety-guard.sh)をコピーして危険なコマンドをブロック。[tips](./docs/tips/)を読む。完了。

---

## 数字で見る

数十のプロジェクトをまたいで、数百のセッション。月額最大$200プラン。

同じ使用量はAPIだとキャッシング込みで~$12K、なしで~$95K。自動ループなし。cronジョブなし。全セッションはお前がプロンプトを入力することから始まる。[費用の計算方法 &rarr;](./docs/cost.md)

<img src="./gifs/mine-stats.gif" width="100%" alt="mine stats showing sessions, tokens, costs, and projects" />

---

## loreプラグインをインストール

```bash
/plugin marketplace add anipotts/claude-code-tips   # マーケットプレイスを追加（1回だけ）
/plugin install lore@claude-code-tips                             # loreをインストール（セッション分析）
/plugin install cc@claude-code-tips                               # ccをインストール（クロスセッションメッセージング）
```

**[lore](./plugins/lore/)**が手に入る。セッション採掘からsqlite。費用、検索、エラーメモリ、パターン検出。全データは`~/.claude/lore/lore.db`でローカルに残る。

```
/lore                     今日のセッション、費用、トップツール
/lore search "websocket"  全会話をまたいだ全文検索
/lore mistakes            Claudeが繰り返し犯すエラーパターン
/lore hotspots            セッション横断で最も編集されたファイル
/lore loops               セッション横断の繰り返しパターン
```

`lore`と`safety-guard` hookから始める。進むにつれて増やす。**[lore docs &rarr;](./plugins/lore/)**

---

## ccプラグイン

クロスセッションメッセージングと`time`サブシステム。ほかのClaudeコードセッションが何をしているか確認、セッション間でメッセージを送信、お前のセッション履歴に基づいたリアルな時間推定を得る。

```bash
/plugin install cc@claude-code-tips
```

```
/cc                             アクティブなセッションを表示
/cc send merizo "pause"         別のセッションにメッセージを送る
/cc:time-estimate <task>        範囲付きCC推定、現在のモデル＋努力を使う
/cc:time-calibrate              実スループット（lore.dbから）と規則の差分
/cc:time-benchmark              モデル上の努力レベル間でA/B/Cを比較
```

---

## コーディングを変えた3つのこと

### hooks

hookは「Claudeが俺の望むことをする」と「Claudeが気まぐれにやることをする」の違い。CLAUDE.mdはガイダンス。hookは執行。一方は提案で、もう一方は壁だ。

このリポジトリは9つのhookを持つ。任意のプロジェクトにドロップできる。safety-guardは強制プッシュ、`rm -rf /`、`curl | bash`をブロック。no-squashはスカッシュマージをブロック。context-saveは圧縮前に状態を保存。お前のワークフローに合ったやつを選ぶ。[hook ガイド &rarr;](./docs/hooks.md)

### エージェントチーム

複数のClaudeインスタンスが同じコードベースで同時に動く。各々が独自のgit worktreeにいる。コーディネーターはタスクを割り当て、結果を集める、最良のアプローチをマージする。

並列調査、危険な変更を安全に試す、ワーキングツリーに触れずにアプローチを比較するために使う。[エージェントチームの使い方 &rarr;](./docs/agents.md)

### prompt caching

月額$200プランがAIコーディングの最高の取引である理由。Claude Codeはシステムプロンプト、ツール、CLAUDE.mdを接頭辞としてキャッシュ。俺の入力トークンの91%はキャッシュヒット。つまり、読み取りの91%で入力費用の10%を払う。

重要：CLAUDE.mdを短く安定に保つ。編集するたびに接頭辞キャッシュが壊れる。俺のは30行で、週に1回くらいしか変わらない。[全費用計算 &rarr;](./docs/cost.md)

---

## コツ

短くて単独で動く技術。各々は次のセッションで使えるもの。

| コツ | 学べること |
|-----|-----------|
| [prompt caching](./docs/tips/prompt-caching.md) | 97%以上のキャッシュヒット率を得て、請求を大幅削減 |
| [safety hooks](./docs/tips/safety-hooks.md) | 強制プッシュとrm -rfを5分でブロック |
| [settings hierarchy](./docs/tips/settings-hierarchy.md) | プロジェクト vs グローバル vs ローカル設定 |
| [session length](./docs/tips/session-length.md) | より短いセッションがなぜより効率的か（データ付き） |
| [ultrathink](./docs/tips/ultrathink.md) | 複雑な問題に拡張思考を強制 |
| [context management](./docs/tips/context-management.md) | 圧縮戦略、アクティブツールレート、セッションを整然に保つ |
| [plan mode](./docs/tips/plan-mode.md) | 計画が時間を節約する時vs無駄にする時 |
| [fast mode](./docs/tips/fast-mode.md) | 同じモデル、より高速な出力、トレードオフ |
| [plugins](./docs/tips/plugins.md) | ゼロからプラグインを作る、インストールする価値があるとは |
| [subagents](./docs/tips/subagents.md) | エージェントチーム、worktree分離、並列が報いる時 |
| [mcp integration](./docs/tips/mcp-integration.md) | MCP サーバを配線、セッション内で使う |
| [hooks v2](./docs/tips/hooks-v2.md) | コマンド vs http vs プロンプト hook、非同期パターン |

---

## hooks

1つコピーして、配線して、完了。各々はスタンドアロンのbashスクリプト。[全ガイド &rarr;](./docs/hooks.md)

| hook | イベント | やること |
|---|---|---|
| [safety-guard](./hooks/safety-guard.sh) | PreToolUse | 強制プッシュ、`rm -rf /`、DROP TABLE、curl-pipe-shをブロック |
| [no-squash](./hooks/no-squash.sh) | PreToolUse | スカッシュマージをブロック |
| [panopticon](./hooks/panopticon.sh) | PostToolUse | すべてのツール呼び出しをsqliteにログ |
| [context-save](./hooks/context-save.sh) | PreCompact | 圧縮前にコンテキストを保存 |
| [notify](./hooks/notify.sh) | Notification | macOS、Slack、ntfyにルーティング |

<details>
<summary>4つのhookもっと</summary>

| hook | イベント | やること |
|---|---|---|
| [commit-nudge](./hooks/commit-nudge.sh) | PostToolUse | N個の編集後にコミットを思い出させる |
| [version-stamp](./hooks/version-stamp.sh) | SessionEnd | 「テスト済み」スタンプを自動更新 |
| [stale-branch](./hooks/stale-branch.sh) | SessionStart | トラッキングブランチの消失について警告 |
| [md-lint-fix](./hooks/md-lint-fix.sh) | PostToolUse | 保存時にマークダウンリントを自動修正 |

</details>

<img src="./gifs/hook-safety.gif" width="100%" alt="safety-guard blocking a dangerous command" />

## エージェント例

`.claude/agents/`にコピーして、`/agent <name>`で呼び出す。各々は異なるパターンを教える。[ガイド &rarr;](./docs/agents.md)

| エージェント | パターン | やること |
|---|---|---|
| [watch-tests](./examples/agents/watch-tests.md) | daemon | ファイルを監視、テストを実行、修正を提案 |
| [try-worktree](./examples/agents/try-worktree.md) | worktree | 分離されたworktreeで危険な変更を試す |
| [arch-review](./examples/agents/arch-review.md) | 高速レビュー | アーキテクチャの悪い匂いの高速テスト |
| [write-pr](./examples/agents/write-pr.md) | git統合 | 差分からのPR説明 |

## 使うコマンド

| コマンド | やること |
|---|---|
| `/lore` | 使用データ · 費用、セッション、検索、パターン |
| `/ship` | ステージ、コミット、プッシュ、PRを1コマンドで開く |
| `/improve` | git履歴からのCLAUDE.md更新を提案 |

加えて[2つのコマンド例](./examples/commands/)をコピーできる：`/sweep`、`/quicktest`。

---

## 俺の個人的な見方

| | 何 |
|---|---|
| [費用の実態](./docs/cost.md) | Claude Codeが実際いくらかかるか、prompt caching計算 |
| [した失敗](./docs/mistakes.md) | 俺を焼いたこと。お前がスキップできるように |
| [automation](./docs/automation.md) | このリポジトリを保守する12のCIパイプライン |
| [セッションワークフロー](./docs/session-workflow.md) | 日々Claude Codeとどう働くか |
| [worktrees](./docs/worktrees.md) | デスクトップアプリとの並列探索 |

## vs 代替品

外交的、データドリブン、FUDなし。すべてのクレームはソースを引用する。

[vs cursor](./docs/comparisons/cursor.md) &middot; [vs codex](./docs/comparisons/codex.md) &middot; [vs gemini](./docs/comparisons/gemini.md) &middot; [vs antigravity](./docs/comparisons/antigravity.md) &middot; [費用](./docs/comparisons/pricing.md)

---

## 例

- [CLAUDE.md テンプレート](./examples/claude-md/) · TypeScript、Python、Rust、Next.jsのスターター設定
- [エージェント例](./examples/agents/) · 4つのエージェント、各々は異なるパターンを教える
- [コマンド例](./examples/commands/) · 任意のプロジェクトにコピーできる2つのコマンド
- [handoff プラグイン](./examples/plugins/handoff/) · PreCompact コンテキスト保存
- [broadcast プラグイン](./examples/plugins/broadcast/) · git イベントの非同期通知

---

## このリポジトリの仕組み

このリポジトリは独自のパターンで動く。

- **12のCIワークフロー** · docs監査、競争インテリジェンス、コミュニティダイジェスト、鮮度チェック、古いものの削除、dependabot、リリース、プラグインスモークテスト、PR品質ゲート、検証、Claude応答、上流監視
- **11のhook** すべてのセッションで実行
- **<$1/月** CI費用 · AI駆動ワークフローはhaikuを使う
- **0の手動保守** · 味覚が必要でないすべてのものは自動化

[自動化の詳細 &rarr;](./docs/automation.md)

---

## これらのパターンから作ったツール

これらは毎日Claude Codeに住むことから出てきた。各々は俺がずっと引っかかっていた特定の問題を解く。

- **[lore](./plugins/lore/)** · セッション採掘からsqlite。費用、検索、エラーメモリ、パターン検出
- **[claudemon](https://github.com/anipotts/claudemon)** · プロジェクトとマシン横断のリアルタイムセッション監視
- **[cc](./plugins/cc/)** · マルチセッション認識。ほかのセッションが何をしているか確認、セッション間でメッセージを送る
- **[imessage-mcp](https://github.com/anipotts/imessage-mcp)** · iMessageの履歴読み取り専用のMCPサーバ。26のツール、ゼロのネットワークリクエスト

## 俺からもっと

- [anipotts.com/thoughts](https://anipotts.com/thoughts) · 長文
- [buttondown.com/anipotts](https://buttondown.com/anipotts) · ニュースレター
- [@anipottsbuilds](https://instagram.com/anipottsbuilds) · 短文

---

MIT &middot; [anipotts](https://anipotts.com)が作成

<!-- translated from README.md @ 62df0ee -->
