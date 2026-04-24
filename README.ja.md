> [EN](./README.md) | [ZH](./README.zh-CN.md) | [ES](./README.es.md) | [HI](./README.hi.md) | [PT](./README.pt-BR.md) | [JA](./README.ja.md)

# claude-code-tips

[![CI](https://github.com/anipotts/claude-code-tips/actions/workflows/validate.yml/badge.svg)](https://github.com/anipotts/claude-code-tips/actions/workflows/validate.yml)
[![GitHub stars](https://img.shields.io/github/stars/anipotts/claude-code-tips?style=flat-square&labelColor=111827&color=000)](https://github.com/anipotts/claude-code-tips/stargazers)
[![last commit](https://img.shields.io/github/last-commit/anipotts/claude-code-tips?style=flat-square&labelColor=111827&color=000)](https://github.com/anipotts/claude-code-tips/commits/main)
[![tested with](https://img.shields.io/badge/tested%20with-Claude%20Code%20v2.1.94-000?style=flat-square&labelColor=D4A574&logo=anthropic&logoColor=white)](https://docs.anthropic.com/en/docs/claude-code)
[![license](https://img.shields.io/github/license/anipotts/claude-code-tips?style=flat-square&labelColor=111827&color=000)](./LICENSE)

YC スタートアップから大手テック企業、ユニコーン企業まで、実戦で鍛えられた Claude Code のパターン集。Claude Code を仕事にしてる人間が保守している。

初めてなら[tips インデックス](./docs/tips/)から始めるか、[hooks](./docs/hooks.md)と[automation](./docs/automation.md)をざっと見ておくといい。

## 中身

3つのプラグイン、1つのマーケットプレイス。

- **`mine@cc`** セッションごとに sqlite に採掘して記録。コスト、ツール、エラー、ホットスポット、ループを問い合わせたり、自分の履歴全体を全文検索できる。すべてローカル。
- **`cc@cc`** セッション間での認識とメッセージング。さらに`time`サブシステム付き。`/cc:time-estimate`で Claude Code の現実的な時間を出す。楽観的な予測じゃなくて、あなたのセッション履歴に基づいてる。
- **`fuel@cc`** 3段階フューエルゲージ（5時間セッション、7日間週次、200k コンテキスト）。メーターが満杯に近づくとプリターンフックで Claude をきれいなハンドオフへ導く。`/fuel state`で直接読み込める。`/fuel handoff`で停止ポイントを作成。

```
> /cc:time-estimate "auth ミドルウェアを書き直してテストを追加"
CC: ~22 分有効稼働（標準モード、Opus 4.7 high）
あなたの時間: ~15 分レビュー
```

## クイックスタート

```bash
/plugin marketplace add anipotts/claude-code-tips   # マーケットプレイスを追加（初回のみ）
/plugin install mine@cc                             # mine をインストール（セッション分析）
/plugin install cc@cc                               # cc をインストール（クロスセッションメッセージング）
```

その後：[safety-guard.sh](./hooks/safety-guard.sh)をコピーして危険なコマンドをブロック。[tip](./docs/tips/)を読む。終わり。

---

## 数字

数十プロジェクトにまたがる数百セッション。月額最大プラン $200。

同じ使い方を API でやると、キャッシング使ってざっと $12K、キャッシングなしで $95K かかる。自律ループなし。cron ジョブなし。すべてのセッションはプロンプトを打つところから始まる。[コスト計算の仕組み &rarr;](./docs/cost.md)

<img src="./gifs/mine-stats.gif" width="100%" alt="mine stats showing sessions, tokens, costs, and projects" />

---

## mine プラグインをインストール

```bash
/plugin marketplace add anipotts/claude-code-tips   # マーケットプレイスを追加（初回のみ）
/plugin install mine@cc                             # mine をインストール（セッション分析）
/plugin install cc@cc                               # cc をインストール（クロスセッションメッセージング）
```

**[mine](./plugins/mine/)**を手に入れる・セッションマイニングを sqlite へ。コスト、検索、エラーメモリ、パターン検出。すべてのデータは`~/.claude/mine.db`のローカルに残る。

```
/mine                     今日のセッション、コスト、よく使うツール
/mine search "websocket"  すべての会話を全文検索
/mine mistakes            Claude が繰り返すエラーパターン
/mine hotspots            セッション横断で最も編集されたファイル
/mine loops               セッション横断で繰り返されるパターン
```

`mine` + `safety-guard` フックから始めて、慣れたら追加していく。**[mine ドキュメント &rarr;](./plugins/mine/)**

---

## cc プラグイン

クロスセッションメッセージングと`time`サブシステム。他の Claude Code セッションが何をしてるか見て、メッセージを送り、あなた自身のセッション履歴に基づいた現実的な時間推定を得る。

```bash
/plugin install cc@cc
```

```
/cc                             アクティブセッションを表示
/cc send merizo "pause"         別のセッションにメッセージを送る
/cc:time-estimate <task>        範囲付き CC 推定、あなたの現在のモデル＋努力を使う
/cc:time-calibrate              実際のスループット（mine.db から）をルールと比較
/cc:time-benchmark              あなたのモデルで努力レベル A/B/C をガイド付きで測定
```

---

## 僕のコーディング方法を変えた3つのこと

### hooks

hooks があるかないかで「Claude が僕の思い通りにする」と「Claude が気分でやる」の差が出る。CLAUDE.md はガイダンス。hooks は強制。一方は提案、もう一方は壁だ。

このリポジトリには 9つの hooks があって、どのプロジェクトにでも落とし込める。safety-guard はフォースプッシュ、`rm -rf /`、`curl | bash`をブロック。no-squash はスクワッシュマージをブロック。context-save は圧縮前の状態を保存。あなたのワークフローに合わせて選べ。[hook ガイド &rarr;](./docs/hooks.md)

### エージェントチーム

複数の Claude インスタンスが同時に同じコードベースで動く。それぞれ独自の git worktree にいる。コーディネーターがタスクを割り当てて、結果を集めて、最良のアプローチをマージする。

並列リサーチに、リスクのある変更を安全に試すのに、ワーキングツリーを触らずにアプローチを並べて比較するのに使ってる。[エージェントチームの使い方 &rarr;](./docs/agents.md)

### prompt caching

これが $200/月プランが AI コーディング最強のディールな理由。Claude Code はあなたのシステムプロンプト、ツール、CLAUDE.md をプレフィックスとしてキャッシュする。僕のインプットトークンの 91% がキャッシュ命中してる。つまり読み込みの 91% のインプットコストを 10% で済ましてる。

コツ：CLAUDE.md は短く、安定に保つ。編集のたびにプレフィックスキャッシュが壊れる。僕のは 30行で、週1回くらいしか変わらない。[コスト内訳の詳細 &rarr;](./docs/cost.md)

---

## Tips

短く、単独で使える技法。次のセッションで使える何かがそれぞれ詰まってる。

| Tip | 学べること |
|-----|-----------|
| [prompt caching](./docs/tips/prompt-caching.md) | キャッシュヒット率 97%+、請求を大幅削減 |
| [safety hooks](./docs/tips/safety-hooks.md) | フォースプッシュと rm -rf を 5分でブロック |
| [settings hierarchy](./docs/tips/settings-hierarchy.md) | プロジェクト vs グローバル vs ローカル設定 |
| [session length](./docs/tips/session-length.md) | より短いセッションがより効率的な理由（データ付き） |
| [ultrathink](./docs/tips/ultrathink.md) | 複雑な問題に拡張思考を強制 |
| [context management](./docs/tips/context-management.md) | 圧縮戦略、アクティブツール率、セッションを締める |
| [plan mode](./docs/tips/plan-mode.md) | 計画が時間を節約するときと無駄にするとき |
| [fast mode](./docs/tips/fast-mode.md) | 同じモデル、より速い出力、トレードオフ |
| [plugins](./docs/tips/plugins.md) | ゼロからプラグインを構築、何がインストール価値あるか |
| [subagents](./docs/tips/subagents.md) | エージェントチーム、worktree 隔離、並列がいつペイするか |
| [mcp integration](./docs/tips/mcp-integration.md) | MCP サーバーをつなぐ、セッション内で使う |
| [hooks v2](./docs/tips/hooks-v2.md) | command vs http vs prompt hooks、非同期パターン |

---

## Hooks

1つコピーして、つなぐ。終わり。それぞれスタンドアロン bash スクリプト。[完全ガイド &rarr;](./docs/hooks.md)

| hook | イベント | 何をするか |
|---|---|---|
| [safety-guard](./hooks/safety-guard.sh) | PreToolUse | フォースプッシュ、`rm -rf /`、DROP TABLE、curl-pipe-sh をブロック |
| [no-squash](./hooks/no-squash.sh) | PreToolUse | スクワッシュマージをブロック |
| [panopticon](./hooks/panopticon.sh) | PostToolUse | すべてのツール呼び出しを sqlite にログ |
| [context-save](./hooks/context-save.sh) | PreCompact | 圧縮前にコンテキスト保存 |
| [notify](./hooks/notify.sh) | Notification | macOS、Slack、ntfy にルーティング |

<details>
<summary>あと4つの hooks</summary>

| hook | イベント | 何をするか |
|---|---|---|
| [commit-nudge](./hooks/commit-nudge.sh) | PostToolUse | N回編集後にコミットするよう促す |
| [version-stamp](./hooks/version-stamp.sh) | SessionEnd | "tested with" スタンプを自動更新 |
| [stale-branch](./hooks/stale-branch.sh) | SessionStart | 消えたトラッキングブランチについて警告 |
| [md-lint-fix](./hooks/md-lint-fix.sh) | PostToolUse | 保存時に markdown lint を自動修正 |

</details>

<img src="./gifs/hook-safety.gif" width="100%" alt="safety-guard blocking a dangerous command" />

## エージェント例

`.claude/agents/`にコピーして`/agent <name>`で呼び出す。それぞれ異なるパターンを教える。[ガイド &rarr;](./docs/agents.md)

| エージェント | パターン | 何をするか |
|---|---|---|
| [watch-tests](./examples/agents/watch-tests.md) | daemon | ファイルを監視、テスト実行、修正提案 |
| [try-worktree](./examples/agents/try-worktree.md) | worktree | リスクのある変更を隔離 worktree で試す |
| [arch-review](./examples/agents/arch-review.md) | quick review | 高速なアーキテクチャ臭さ検査 |
| [write-pr](./examples/agents/write-pr.md) | git integration | diff から PR 説明を生成 |

## 使ってるコマンド

| コマンド | 何をするか |
|---|---|
| `/mine` | 使用データ・コスト、セッション、検索、パターン |
| `/ship` | stage、commit、push、PR open を1コマンドで |
| `/improve` | git 履歴から CLAUDE.md 更新を提案 |

さらに[2つのコマンド例](./examples/commands/)がコピーできる：`/sweep`、`/quicktest`。

---

## 個人的な見解

| | 内容 |
|---|---|
| [cost reality](./docs/cost.md) | Claude Code は実際いくらかかるか、prompt caching 計算 |
| [mistakes i made](./docs/mistakes.md) | 僕が燃やしたもの。あなたは避けられる |
| [automation](./docs/automation.md) | このリポジトリを保つ 12個の CI パイプライン |
| [session workflow](./docs/session-workflow.md) | 日々 Claude Code でどう働いてるか |
| [worktrees](./docs/worktrees.md) | デスクトップアプリで並列探索 |

## vs 他の選択肢

外交的で、データドリブン。FUD なし。すべての主張は出典を引き合いに出してる。

[vs cursor](./docs/comparisons/cursor.md) &middot; [vs codex](./docs/comparisons/codex.md) &middot; [vs gemini](./docs/comparisons/gemini.md) &middot; [vs antigravity](./docs/comparisons/antigravity.md) &middot; [料金](./docs/comparisons/pricing.md)

---

## 例

- [CLAUDE.md テンプレート](./examples/claude-md/) · TypeScript、Python、Rust、Next.js のスターター設定
- [エージェント例](./examples/agents/) · 4つのエージェント、それぞれ異なるパターンを教える
- [コマンド例](./examples/commands/) · どのプロジェクトにもコピーできる 2つのコマンド
- [handoff プラグイン](./examples/plugins/handoff/) · PreCompact コンテキスト保存
- [broadcast プラグイン](./examples/plugins/broadcast/) · git イベント時の非同期通知

---

## このリポジトリの仕組み

このリポジトリは独自のパターンで動く。

- **12個の CI ワークフロー** · docs 監査、競争インテル、コミュニティダイジェスト、鮮度チェック、古いもの削除、dependabot、リリース、プラグイン smoke テスト、PR 品質ゲート、検証、Claude レスポンダー、アップストリーム監視
- **11個の hooks** がすべてのセッションで動く
- **$1/月未満** CI コスト · AI 駆動ワークフローは haiku を使う
- **0 手動保守** · 趣味を必要としないものはすべて自動化

[自動化の詳細 &rarr;](./docs/automation.md)

---

## こうしたパターンから生まれたツール

毎日 Claude Code にいて、何度も同じ問題に直面するのから出てきた。それぞれ特定の問題を解く。

- **[mine](./plugins/mine/)** · セッションマイニングを sqlite へ。コスト、検索、エラーメモリ、パターン検出
- **[claudemon](https://github.com/anipotts/claudemon)** · プロジェクトとマシン横断でリアルタイムセッション監視
- **[cc](./plugins/cc/)** · マルチセッション認識。他のセッションが何してるか見て、メッセージを送る
- **[imessage-mcp](https://github.com/anipotts/imessage-mcp)** · iMessage 履歴の読み取り専用 MCP サーバー。26ツール、ゼロネットワークリクエスト

## 僕からの他のもの

- [anipotts.com/thoughts](https://anipotts.com/thoughts) · ロングフォーム
- [buttondown.com/anipotts](https://buttondown.com/anipotts) · ニュースレター
- [@anipottsbuilds](https://instagram.com/anipottsbuilds) · ショートフォーム

---

MIT &middot; [anipotts](https://anipotts.com)による

<!-- translated from README.md @ 925abe7 -->
