> [EN](./README.md) | [ZH](./README.zh-CN.md) | [ES](./README.es.md) | [HI](./README.hi.md) | [PT](./README.pt-BR.md) | [JA](./README.ja.md)

# claude-code-tips

[![CI](https://github.com/anipotts/claude-code-tips/actions/workflows/validate.yml/badge.svg)](https://github.com/anipotts/claude-code-tips/actions/workflows/validate.yml)
[![GitHub stars](https://img.shields.io/github/stars/anipotts/claude-code-tips?style=flat-square&labelColor=111827&color=000)](https://github.com/anipotts/claude-code-tips/stargazers)
[![last commit](https://img.shields.io/github/last-commit/anipotts/claude-code-tips?style=flat-square&labelColor=111827&color=000)](https://github.com/anipotts/claude-code-tips/commits/main)
[![tested with](https://img.shields.io/badge/tested%20with-Claude%20Code%20v2.1.94-000?style=flat-square&labelColor=D4A574&logo=anthropic&logoColor=white)](https://docs.anthropic.com/en/docs/claude-code)
[![license](https://img.shields.io/github/license/anipotts/claude-code-tips?style=flat-square&labelColor=111827&color=000)](./LICENSE)

Claude Code 的实战模式，在 YC 创业公司、大型科技公司和独角兽企业中经过验证。由日常工作中使用 Claude Code 的人维护。

新手？从[技巧索引](./docs/tips/)开始，或者快速浏览 [hooks](./docs/hooks.md) 和[自动化](./docs/automation.md)。

## 里面有什么

三个插件，一个商城。

- **`mine@cc`** 每个会话都挖掘到 sqlite。查询成本、工具、错误、热点、循环，以及跨整个历史记录的全文搜索。完全本地化。
- **`cc@cc`** 跨会话感知和消息传递。加上一个 `time` 子系统：`/cc:time-estimate` 根据你的会话历史给出真实的 Claude Code 时间，不是乐观的猜测。
- **`fuel@cc`** 3 档燃料指示器（5 小时会话，7 天周期，20 万上下文）。在表盘填满时，预操作 hook 推动 Claude 进行更清晰的交接。`/fuel state` 直接读取；`/fuel handoff` 草拟停止点。

```
> /cc:time-estimate "重写认证中间件并添加测试"
CC: ~22 分钟活跃（标准模式，Opus 4.7 高）
你的时间: ~15 分钟审查
```

## 快速开始

```bash
/plugin marketplace add anipotts/claude-code-tips   # 添加商城（仅一次）
/plugin install mine@cc                             # 安装 mine（会话分析）
/plugin install cc@cc                               # 安装 cc（跨会话消息传递）
```

然后：复制 [safety-guard.sh](./hooks/safety-guard.sh) 来阻止危险命令。读一个[技巧](./docs/tips/)。完成。

---

## 数据

数百个会话遍布数十个项目。最高$200/月套餐。

同样的使用在 API 上使用缓存成本约$12K，不使用缓存约$95K。没有自主循环。没有 cron 作业。每个会话都以我输入提示开始。[成本数学如何工作 &rarr;](./docs/cost.md)

<img src="./gifs/mine-stats.gif" width="100%" alt="mine 统计显示会话、代币、成本和项目" />

---

## 安装 mine 插件

```bash
/plugin marketplace add anipotts/claude-code-tips   # 添加商城（仅一次）
/plugin install mine@cc                             # 安装 mine（会话分析）
/plugin install cc@cc                               # 安装 cc（跨会话消息传递）
```

你获得 **[mine](./plugins/mine/)** · 会话挖掘到 sqlite。成本、搜索、错误记忆、模式检测。所有数据保存在本地 `~/.claude/mine.db`。

```
/mine                     今天的会话、成本、热门工具
/mine search "websocket"  跨所有对话的全文搜索
/mine mistakes            Claude 重复犯的错误模式
/mine hotspots            跨会话中最常编辑的文件
/mine loops               跨会话重复的模式
```

从 `mine` 和 `safety-guard` hook 开始。随着进行添加更多。**[mine 文档 &rarr;](./plugins/mine/)**

---

## cc 插件

跨会话消息传递和 `time` 子系统。看看其他 Claude Code 会话在做什么，在它们之间发送消息，并获得基于你自己会话历史的真实时间估计。

```bash
/plugin install cc@cc
```

```
/cc                             显示活跃会话
/cc send merizo "pause"         向另一个会话发送消息
/cc:time-estimate <task>        范围化 CC 估计，使用你的当前模型 + 工作量
/cc:time-calibrate              对照规则比较实际吞吐量（来自 mine.db）
/cc:time-benchmark              在你的模型上跨工作量级别进行引导式 A/B/C
```

---

## 改变我编码方式的 3 件事

### hooks

hooks 是"Claude 做我想要的"和"Claude 随意做"之间的区别。CLAUDE.md 给出指导。hooks 给出强制执行。一个是建议，另一个是墙。

这个仓库有 9 个 hooks，你可以放入任何项目。safety-guard 阻止强制推送、`rm -rf /` 和 `curl | bash`。no-squash 阻止压缩合并。context-save 在压缩前保留状态。选择适合你工作流的。[hook 指南 &rarr;](./docs/hooks.md)

### 代理团队

多个 Claude 实例同时在同一个代码库上工作，每个在其自己的 git worktree 中。协调器分配任务，收集结果，合并最佳方法。

我用这个进行并行研究、安全地尝试风险变更，以及不触及我的工作树就可以并排比较方法。[我如何使用代理团队 &rarr;](./docs/agents.md)

### prompt caching

这就是为什么$200/月套餐是 AI 编码中最划算的。Claude Code 缓存你的系统提示、工具和 CLAUDE.md 作为前缀。我 91% 的输入代币命中缓存，意味着我在 91% 的读取上只需支付 10% 的输入成本。

关键：保持你的 CLAUDE.md 简短稳定。每次编辑都会破坏前缀缓存。我的是 30 行，大约每周改变一次。[完整的成本分解 &rarr;](./docs/cost.md)

---

## 技巧

短小、独立的技术。每一个都是你可以在下一个会话中使用的东西。

| 技巧 | 你学到什么 |
|-----|---------|
| [prompt caching](./docs/tips/prompt-caching.md) | 获得 97%+ 缓存命中率，削减账单 |
| [safety hooks](./docs/tips/safety-hooks.md) | 在 5 分钟内阻止强制推送和 rm -rf |
| [settings hierarchy](./docs/tips/settings-hierarchy.md) | 项目 vs 全局 vs 本地设置 |
| [session length](./docs/tips/session-length.md) | 为什么更短的会话更高效（带数据） |
| [ultrathink](./docs/tips/ultrathink.md) | 为复杂问题强制扩展思考 |
| [context management](./docs/tips/context-management.md) | 压缩策略、活跃工具率、保持会话紧凑 |
| [plan mode](./docs/tips/plan-mode.md) | 何时规划节省时间 vs 浪费时间 |
| [fast mode](./docs/tips/fast-mode.md) | 相同模型、更快输出、权衡 |
| [plugins](./docs/tips/plugins.md) | 从头构建插件，什么使其值得安装 |
| [subagents](./docs/tips/subagents.md) | 代理团队、worktree 隔离、何时并行值得 |
| [mcp integration](./docs/tips/mcp-integration.md) | 接入 MCP 服务器，在会话内使用它们 |
| [hooks v2](./docs/tips/hooks-v2.md) | 命令 vs http vs 提示 hooks、异步模式 |

---

## hooks

复制一个，接入，完成。每个都是独立的 bash 脚本。[完整指南 &rarr;](./docs/hooks.md)

| hook | 事件 | 它做什么 |
|---|---|---|
| [safety-guard](./hooks/safety-guard.sh) | PreToolUse | 阻止强制推送、`rm -rf /`、DROP TABLE、curl-pipe-sh |
| [no-squash](./hooks/no-squash.sh) | PreToolUse | 阻止压缩合并 |
| [panopticon](./hooks/panopticon.sh) | PostToolUse | 将每个工具调用记录到 sqlite |
| [context-save](./hooks/context-save.sh) | PreCompact | 在压缩前保存上下文 |
| [notify](./hooks/notify.sh) | Notification | 路由到 macOS、Slack、ntfy |

<details>
<summary>另外 4 个 hooks</summary>

| hook | 事件 | 它做什么 |
|---|---|---|
| [commit-nudge](./hooks/commit-nudge.sh) | PostToolUse | 在 N 个编辑后提醒你提交 |
| [version-stamp](./hooks/version-stamp.sh) | SessionEnd | 自动更新"测试版本"戳记 |
| [stale-branch](./hooks/stale-branch.sh) | SessionStart | 警告跟踪分支已消失 |
| [md-lint-fix](./hooks/md-lint-fix.sh) | PostToolUse | 保存时自动修复 markdown lint |

</details>

<img src="./gifs/hook-safety.gif" width="100%" alt="safety-guard 阻止危险命令" />

## 示例代理

复制到 `.claude/agents/` 并用 `/agent <name>` 调用。每个教授不同的模式。[指南 &rarr;](./docs/agents.md)

| 代理 | 模式 | 它做什么 |
|---|---|---|
| [watch-tests](./examples/agents/watch-tests.md) | 守护进程 | 监视文件、运行测试、提出修复 |
| [try-worktree](./examples/agents/try-worktree.md) | worktree | 在隔离的 worktree 中尝试风险变更 |
| [arch-review](./examples/agents/arch-review.md) | 快速审查 | 快速架构气味测试 |
| [write-pr](./examples/agents/write-pr.md) | git 集成 | 从你的 diff 生成 PR 描述 |

## 我使用的命令

| 命令 | 它做什么 |
|---|---|
| `/mine` | 使用数据 · 成本、会话、搜索、模式 |
| `/ship` | 在一个命令中暂存、提交、推送、打开 PR |
| `/improve` | 从 git 历史提出 CLAUDE.md 更新 |

加上你可以复制的[2 个示例命令](./examples/commands/)：`/sweep`、`/quicktest`。

---

## 我的个人观点

| | 什么 |
|---|---|
| [成本现实](./docs/cost.md) | Claude Code 实际成本，prompt caching 数学 |
| [我犯的错误](./docs/mistakes.md) | 烧过我的东西，所以你可以跳过 |
| [自动化](./docs/automation.md) | 维护这个仓库的 12 个 CI 流程 |
| [会话工作流](./docs/session-workflow.md) | 我如何每天与 Claude Code 一起工作 |
| [worktrees](./docs/worktrees.md) | 使用桌面应用进行并行探索 |

## vs 替代品

外交、数据驱动、无 FUD。每个主张都引用一个来源。

[vs cursor](./docs/comparisons/cursor.md) &middot; [vs codex](./docs/comparisons/codex.md) &middot; [vs gemini](./docs/comparisons/gemini.md) &middot; [vs antigravity](./docs/comparisons/antigravity.md) &middot; [定价](./docs/comparisons/pricing.md)

---

## 示例

- [CLAUDE.md 模板](./examples/claude-md/) · TypeScript、Python、Rust、Next.js 的启动配置
- [示例代理](./examples/agents/) · 4 个代理，每个教授不同的模式
- [示例命令](./examples/commands/) · 2 个你可以复制到任何项目的命令
- [handoff 插件](./examples/plugins/handoff/) · PreCompact 上下文保留
- [broadcast 插件](./examples/plugins/broadcast/) · git 事件上的异步通知

---

## 这个仓库如何工作

这个仓库运行在自己的模式上。

- **12 个 CI 流程** · 文档审计、竞争情报、社区摘要、新鲜度检查、过期清理、dependabot、发布、插件烟测、PR 质量门控、验证、Claude 响应器、上游监视器
- **11 个 hooks** 在每个会话上运行
- **<$1/月** CI 成本 · AI 驱动的工作流使用 haiku
- **0 手动维护** · 所有不需要品味的东西都是自动化的

[自动化详情 &rarr;](./docs/automation.md)

---

## 我从这些模式构建的工具

这些都来自于每天生活在 Claude Code 中。每一个解决我一直遇到的特定问题。

- **[mine](./plugins/mine/)** · 会话挖掘到 sqlite。成本、搜索、错误记忆、模式检测
- **[claudemon](https://github.com/anipotts/claudemon)** · 跨项目和机器的实时会话监控
- **[cc](./plugins/cc/)** · 多会话感知。看看其他会话在做什么，在它们之间发送消息
- **[imessage-mcp](https://github.com/anipotts/imessage-mcp)** · iMessage 历史的只读 MCP 服务器。26 个工具，零网络请求

## 我的更多内容

- [anipotts.com/thoughts](https://anipotts.com/thoughts) · 长篇
- [buttondown.com/anipotts](https://buttondown.com/anipotts) · 通讯
- [@anipottsbuilds](https://instagram.com/anipottsbuilds) · 短篇

---

MIT &middot; 由 [anipotts](https://anipotts.com) 构建

<!-- translated from README.md @ 925abe7 -->
