> [EN](./README.md) | [ZH](./README.zh-CN.md) | [ES](./README.es.md) | [HI](./README.hi.md) | [PT](./README.pt-BR.md) | [JA](./README.ja.md)

# claude-code-tips

[![CI](https://github.com/anipotts/claude-code-tips/actions/workflows/validate.yml/badge.svg)](https://github.com/anipotts/claude-code-tips/actions/workflows/validate.yml)
[![GitHub 星标](https://img.shields.io/github/stars/anipotts/claude-code-tips?style=flat-square&labelColor=111827&color=000)](https://github.com/anipotts/claude-code-tips/stargazers)
[![最后提交](https://img.shields.io/github/last-commit/anipotts/claude-code-tips?style=flat-square&labelColor=111827&color=000)](https://github.com/anipotts/claude-code-tips/commits/main)
[![测试工具](https://img.shields.io/badge/tested%20with-Claude%20Code%20v2.1.122-000?style=flat-square&labelColor=D4A574&logo=anthropic&logoColor=white)](https://docs.anthropic.com/en/docs/claude-code)
[![许可证](https://img.shields.io/github/license/anipotts/claude-code-tips?style=flat-square&labelColor=111827&color=000)](./LICENSE)

claude code 的实战模式，经过 YC 创业公司、大型科技公司和独角兽验证。由每天用 claude code 工作的人维护。

新手？从[技巧索引](./docs/tips/)开始，或者快速浏览 [hooks](./docs/hooks.md) 和[自动化](./docs/automation.md)。

## 里面有什么

三个插件，一个市场。

- **`lore@claude-code-tips`** 每个会话都挖掘到 sqlite。查询成本、工具、错误、热点、循环，以及搜索你自己的历史记录。所有数据本地化。
- **`cc@claude-code-tips`** 跨会话感知和消息传递。加上 `time` 子系统：`/cc:time-estimate` 基于你的会话历史给出现实的 claude-code 时间估计，而不是乐观的猜测。
- **`time@claude-code-tips`** 3 档燃油表（5 小时会话、7 天周期、20 万 token 上下文）。当燃油表满时，PreToolUse hook 会推动 claude 进行更干净的切换。`/fuel state` 直接读取；`/fuel handoff` 草拟一个停止点。

```
> /cc:time-estimate "重写认证中间件并添加测试"
CC: ~22 分钟活跃时间（标准模式，Opus 4.7 高）
你的时间: ~15 分钟审查
```

## 快速开始

```bash
/plugin marketplace add anipotts/claude-code-tips   # 添加市场（仅一次）
/plugin install lore@claude-code-tips                             # 安装 lore（会话分析）
/plugin install cc@claude-code-tips                               # 安装 cc（跨会话消息）
```

然后：复制 [safety-guard.sh](./hooks/safety-guard.sh) 来阻止危险命令。读一个[技巧](./docs/tips/)。完成。

---

## 数字说话

数十个项目中有数百个会话。每月最大计划 $200。

相同的用法在有缓存的 API 上会花费 ~$12K，没有缓存会花费 ~$95K。没有自动循环。没有定时任务。每个会话都从我输入提示开始。[成本计算方式 &rarr;](./docs/cost.md)

<img src="./gifs/mine-stats.gif" width="100%" alt="mine stats showing sessions, tokens, costs, and projects" />

---

## 安装 lore 插件

```bash
/plugin marketplace add anipotts/claude-code-tips   # 添加市场（仅一次）
/plugin install lore@claude-code-tips                             # 安装 lore（会话分析）
/plugin install cc@claude-code-tips                               # 安装 cc（跨会话消息）
```

你会得到 **[lore](./plugins/lore/)** · 会话挖掘到 sqlite。成本、搜索、错误记忆、模式检测。所有数据本地存储在 `~/.claude/lore/lore.db`。

```
/lore                     今天的会话、成本、热门工具
/lore search "websocket"  跨所有对话的全文搜索
/lore mistakes            claude 重复犯的错误模式
/lore hotspots            跨会话编辑最多的文件
/lore loops               跨会话的重复模式
```

从 `lore` + `safety-guard` hook 开始。逐步添加更多。**[lore 文档 &rarr;](./plugins/lore/)**

---

## cc 插件

跨会话消息传递和 `time` 子系统。看看其他 claude code 会话在做什么，在它们之间发送消息，并获得基于你自己会话历史的现实时间估计。

```bash
/plugin install cc@claude-code-tips
```

```
/cc                             显示活跃会话
/cc send merizo "pause"         给另一个会话发送消息
/cc:time-estimate <task>        范围内的 CC 估计，使用你当前的模型 + 工作量
/cc:time-calibrate              将真实吞吐量（来自 lore.db）与规则进行比较
/cc:time-benchmark              在模型的不同工作量级别上进行引导式 A/B/C 对比
```

---

## 改变我代码方式的 3 件事

### hooks

hooks 是"claude 做我想要的"和"claude 做它想做的"之间的区别。CLAUDE.md 提供指导。hooks 提供强制执行。一个是建议，另一个是壁垒。

这个仓库有 9 个 hooks 你可以放到任何项目中。safety-guard 阻止强制推送、`rm -rf /` 和 `curl | bash`。no-squash 阻止 squash 合并。context-save 在压缩前保留状态。选择适合你工作流的。[hook 指南 &rarr;](./docs/hooks.md)

### agent teams

多个 claude 实例同时在同一代码库上工作，每个都在自己的 git worktree 中。coordinator 分配任务、收集结果、合并最佳方案。

我用这个进行并行研究、安全地尝试风险变更、并排比较方法而不接触我的工作树。[我如何使用 agent teams &rarr;](./docs/agents.md)

### prompt caching

这就是为什么 $200/月计划是 AI 编码中最划算的。claude code 将你的系统提示、工具和 CLAUDE.md 作为前缀缓存。我 91% 的输入 token 击中缓存，意味着我在 91% 的读取中支付 10% 的输入成本。

关键：保持 CLAUDE.md 短且稳定。每次编辑都会破坏前缀缓存。我的是 30 行，大约一周改一次。[完整的成本分解 &rarr;](./docs/cost.md)

---

## 技巧

简短、独立的技术。每一个都是你可以在下一个会话中使用的东西。

| 技巧 | 你学到什么 |
|-----|---------|
| [prompt caching](./docs/tips/prompt-caching.md) | 获得 97%+ 缓存命中率，削减你的账单 |
| [safety hooks](./docs/tips/safety-hooks.md) | 在 5 分钟内阻止强制推送和 rm -rf |
| [settings hierarchy](./docs/tips/settings-hierarchy.md) | 项目 vs 全局 vs 本地设置 |
| [session length](./docs/tips/session-length.md) | 为什么更短的会话更高效（含数据） |
| [ultrathink](./docs/tips/ultrathink.md) | 对复杂问题强制延伸思考 |
| [context management](./docs/tips/context-management.md) | 压缩策略、活跃工具率、保持会话紧凑 |
| [plan mode](./docs/tips/plan-mode.md) | 什么时候规划节省时间，什么时候浪费时间 |
| [fast mode](./docs/tips/fast-mode.md) | 相同模型、更快输出、权衡 |
| [plugins](./docs/tips/plugins.md) | 从零开始构建插件，什么使其值得安装 |
| [subagents](./docs/tips/subagents.md) | agent teams、worktree 隔离、什么时候并行有收益 |
| [mcp integration](./docs/tips/mcp-integration.md) | 连接 MCP 服务器，在会话中使用它们 |
| [hooks v2](./docs/tips/hooks-v2.md) | 命令 vs http vs 提示 hooks、异步模式 |

---

## hooks

复制一个、连接它、完成。每个都是独立的 bash 脚本。[完整指南 &rarr;](./docs/hooks.md)

| hook | 事件 | 它做什么 |
|---|---|---|
| [safety-guard](./hooks/safety-guard.sh) | PreToolUse | 阻止强制推送、`rm -rf /`、DROP TABLE、curl-pipe-sh |
| [no-squash](./hooks/no-squash.sh) | PreToolUse | 阻止 squash 合并 |
| [panopticon](./hooks/panopticon.sh) | PostToolUse | 将每个工具调用日志记录到 sqlite |
| [context-save](./hooks/context-save.sh) | PreCompact | 在压缩前保存上下文 |
| [notify](./hooks/notify.sh) | Notification | 路由到 macOS、Slack、ntfy |

<details>
<summary>4 个更多 hooks</summary>

| hook | 事件 | 它做什么 |
|---|---|---|
| [commit-nudge](./hooks/commit-nudge.sh) | PostToolUse | N 次编辑后提醒你提交 |
| [version-stamp](./hooks/version-stamp.sh) | SessionEnd | 自动更新"测试工具"标记 |
| [stale-branch](./hooks/stale-branch.sh) | SessionStart | 警告已消失的跟踪分支 |
| [md-lint-fix](./hooks/md-lint-fix.sh) | PostToolUse | 保存时自动修复 markdown lint |

</details>

<img src="./gifs/hook-safety.gif" width="100%" alt="safety-guard blocking a dangerous command" />

## 示例 agents

复制到 `.claude/agents/` 并用 `/agent <name>` 调用。每个教授不同的模式。[指南 &rarr;](./docs/agents.md)

| agent | 模式 | 它做什么 |
|---|---|---|
| [watch-tests](./examples/agents/watch-tests.md) | daemon | 监视文件、运行测试、提议修复 |
| [try-worktree](./examples/agents/try-worktree.md) | worktree | 在隔离的 worktrees 中尝试风险变更 |
| [arch-review](./examples/agents/arch-review.md) | quick review | 快速架构异味测试 |
| [write-pr](./examples/agents/write-pr.md) | git integration | 从你的 diff 生成 PR 描述 |

## 我使用的命令

| 命令 | 它做什么 |
|---|---|
| `/lore` | 使用数据 · 成本、会话、搜索、模式 |
| `/ship` | 在一个命令中 stage、commit、push、打开 PR |
| `/improve` | 从 git 历史提议 CLAUDE.md 更新 |

加上 [2 个示例命令](./examples/commands/) 你可以复制：`/sweep`、`/quicktest`。

---

## 我的个人看法

| | 什么 |
|---|---|
| [成本现实](./docs/cost.md) | claude code 实际成本、prompt caching 数学 |
| [我犯的错误](./docs/mistakes.md) | 什么烧了我，所以你可以跳过它 |
| [自动化](./docs/automation.md) | 维护这个仓库的 12 个 CI 管道 |
| [会话工作流](./docs/session-workflow.md) | 我如何日常使用 claude code |
| [worktrees](./docs/worktrees.md) | 使用桌面应用的并行探索 |

## vs 替代品

外交性的、数据驱动的、无 FUD。每个声明都引用了来源。

[vs cursor](./docs/comparisons/cursor.md) &middot; [vs codex](./docs/comparisons/codex.md) &middot; [vs gemini](./docs/comparisons/gemini.md) &middot; [vs antigravity](./docs/comparisons/antigravity.md) &middot; [价格](./docs/comparisons/pricing.md)

---

## 示例

- [CLAUDE.md 模板](./examples/claude-md/) · TypeScript、Python、Rust、Next.js 的启动配置
- [示例 agents](./examples/agents/) · 4 个 agents，每个教授不同的模式
- [示例命令](./examples/commands/) · 2 个你可以复制到任何项目的命令
- [handoff 插件](./examples/plugins/handoff/) · PreCompact 上下文保留
- [broadcast 插件](./examples/plugins/broadcast/) · git 事件上的异步通知

---

## 这个仓库如何工作

这个仓库运行在自己的模式上。

- **12 个 CI 工作流** · 文档审计、竞争情报、社区摘要、新鲜度检查、陈旧清理、dependabot、发布、插件烟雾测试、PR 质量门、验证、claude responder、上游监视
- **11 个 hooks** 在每个会话上运行
- **<$1/月** CI 成本 · AI 驱动的工作流使用 haiku
- **0 手动维护** · 所有不需要品味的东西都是自动化的

[自动化详情 &rarr;](./docs/automation.md)

---

## 我从这些模式构建的工具

这些都来自每天在 claude code 中生活。每个都解决了我一直遇到的特定问题。

- **[lore](./plugins/lore/)** · 会话挖掘到 sqlite。成本、搜索、错误记忆、模式检测
- **[claudemon](https://github.com/anipotts/claudemon)** · 跨项目和机器的实时会话监控
- **[cc](./plugins/cc/)** · 多会话感知。看看其他会话在做什么，在它们之间发送消息
- **[imessage-mcp](https://github.com/anipotts/imessage-mcp)** · iMessage 历史的只读 MCP 服务器。26 个工具，零网络请求

## 更多来自我

- [anipotts.com/thoughts](https://anipotts.com/thoughts) · 长篇形式
- [buttondown.com/anipotts](https://buttondown.com/anipotts) · 新闻通讯
- [@anipottsbuilds](https://instagram.com/anipottsbuilds) · 短篇形式

---

MIT &middot; 由 [anipotts](https://anipotts.com) 构建

<!-- translated from README.md @ 62df0ee -->
