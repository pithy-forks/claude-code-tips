> [EN](./README.md) | [ZH](./README.zh-CN.md) | [ES](./README.es.md) | [HI](./README.hi.md) | [PT](./README.pt-BR.md) | [JA](./README.ja.md)

# claude-code-tips

[![CI](https://github.com/anipotts/claude-code-tips/actions/workflows/validate.yml/badge.svg)](https://github.com/anipotts/claude-code-tips/actions/workflows/validate.yml)
[![GitHub stars](https://img.shields.io/github/stars/anipotts/claude-code-tips?style=flat-square&labelColor=111827&color=000)](https://github.com/anipotts/claude-code-tips/stargazers)
[![last commit](https://img.shields.io/github/last-commit/anipotts/claude-code-tips?style=flat-square&labelColor=111827&color=000)](https://github.com/anipotts/claude-code-tips/commits/main)
[![tested with](https://img.shields.io/badge/tested%20with-Claude%20Code%20v2.1.122-000?style=flat-square&labelColor=D4A574&logo=anthropic&logoColor=white)](https://docs.anthropic.com/en/docs/claude-code)
[![license](https://img.shields.io/github/license/anipotts/claude-code-tips?style=flat-square&labelColor=111827&color=000)](./LICENSE)

padrões de claude code testados em battle, usados em startups da YC, empresas de tecnologia públicas e unicórnios. mantido por alguém que usa claude code como profissão.

novo por aqui? comece pelo [índice de dicas](./docs/tips/) ou dê uma olhada em [hooks](./docs/hooks.md) e [automação](./docs/automation.md).

## o que tem dentro

três plugins, um marketplace.

- **`lore@cc`** cada sessão minerada em sqlite. consulte custos, ferramentas, erros, hotspots, loops e busca full-text em todo o seu histórico. tudo local.
- **`cc@cc`** consciência entre sessões e mensagens. além de um subsistema `time`: `/cc:time-estimate` fornece tempo realista de claude-code baseado no seu histórico de sessões, não em palpites otimistas.
- **`time@cc`** medidor de combustível de 3 metros (sessão de 5 horas, semanal de 7 dias, contexto de 200k). hook pré-turno incentiva claude para handoffs mais limpos conforme os medidores enchem. `/fuel state` lê-os diretamente; `/fuel handoff` redige um ponto de parada.

```
> /cc:time-estimate "rewrite auth middleware and add tests"
CC: ~22 min active (standard mode, Opus 4.7 high)
your time: ~15 min review
```

## início rápido

```bash
/plugin marketplace add anipotts/claude-code-tips   # add marketplace (one time)
/plugin install lore@cc                             # install lore (session analytics)
/plugin install cc@cc                               # install cc (cross-session messaging)
```

depois: copie [safety-guard.sh](./hooks/safety-guard.sh) para bloquear comandos perigosos. leia uma [dica](./docs/tips/). pronto.

---

## os números

centenas de sessões em dúzias de projetos. máximo $200/mês no plano.

o mesmo uso custaria ~$12K na API com caching, ~$95K sem. sem loops autônomos. sem cron jobs. cada sessão começa com você digitando um prompt. [como a matemática de custo funciona &rarr;](./docs/cost.md)

<img src="./gifs/mine-stats.gif" width="100%" alt="mine stats showing sessions, tokens, costs, and projects" />

---

## instale o plugin lore

```bash
/plugin marketplace add anipotts/claude-code-tips   # add marketplace (one time)
/plugin install lore@cc                             # install lore (session analytics)
/plugin install cc@cc                               # install cc (cross-session messaging)
```

você recebe **[lore](./plugins/lore/)** · mineração de sessões para sqlite. custos, busca, memória de erros, detecção de padrões. todos os dados ficam locais em `~/.claude/lore/lore.db`.

```
/lore                     today's sessions, cost, top tools
/lore search "websocket"  full-text search across all conversations
/lore mistakes            error patterns claude keeps repeating
/lore hotspots            most-edited files across sessions
/lore loops               repeated patterns across sessions
```

comece com `lore` + o hook `safety-guard`. adicione mais conforme avança. **[documentação do lore &rarr;](./plugins/lore/)**

---

## plugin cc

mensagens entre sessões e o subsistema `time`. veja o que outras sessões de claude code estão fazendo, envie mensagens entre elas e obtenha estimativas de tempo realistas baseadas no seu próprio histórico de sessões.

```bash
/plugin install cc@cc
```

```
/cc                             show active sessions
/cc send merizo "pause"         message another session
/cc:time-estimate <task>        ranged CC estimate, uses your current model + effort
/cc:time-calibrate              diff real throughput (from lore.db) against the rule
/cc:time-benchmark              guided A/B/C across effort levels on your model
```

---

## as 3 coisas que mudaram como codifico

### hooks

hooks são a diferença entre "claude faz o que eu quero" e "claude faz o que ele sente vontade". CLAUDE.md oferece orientação. hooks oferecem aplicação. um é uma sugestão, o outro é uma parede.

este repo tem 9 hooks que você pode colocar em qualquer projeto. safety-guard bloqueia force pushes, `rm -rf /` e `curl | bash`. no-squash bloqueia squash merges. context-save preserva estado antes da compactação. escolha os que combinam com seu fluxo de trabalho. [guia de hooks &rarr;](./docs/hooks.md)

### equipes de agentes

múltiplas instâncias de claude trabalhando simultaneamente no mesmo codebase, cada uma em seu próprio git worktree. o coordenador atribui tarefas, coleta resultados, mescla a melhor abordagem.

uso isso para pesquisa paralela, tentando mudanças arriscadas com segurança e comparando abordagens lado a lado sem tocar minha árvore de trabalho. [como uso equipes de agentes &rarr;](./docs/agents.md)

### prompt caching

é por isso que o plano de $200/mês é o melhor negócio em codificação com IA. claude code cacheia seu prompt de sistema, ferramentas e CLAUDE.md como prefixo. 91% dos meus tokens de entrada acertam o cache, significando que pago 10% do custo de entrada em 91% das minhas leituras.

a chave: mantenha seu CLAUDE.md curto e estável. cada edição quebra o cache de prefixo. o meu tem 30 linhas e muda talvez uma vez por semana. [o detalhamento completo de custos &rarr;](./docs/cost.md)

---

## dicas

técnicas curtas e independentes. cada uma é algo que você pode usar na sua próxima sessão.

| dica | o que você aprende |
|-----|---------------|
| [prompt caching](./docs/tips/prompt-caching.md) | obtenha taxas de acerto de cache 97%+, reduza sua conta |
| [safety hooks](./docs/tips/safety-hooks.md) | bloqueie force pushes e rm -rf em 5 minutos |
| [settings hierarchy](./docs/tips/settings-hierarchy.md) | settings de projeto vs global vs local |
| [session length](./docs/tips/session-length.md) | por que sessões mais curtas são mais eficientes (com dados) |
| [ultrathink](./docs/tips/ultrathink.md) | force pensamento estendido para problemas complexos |
| [context management](./docs/tips/context-management.md) | estratégias de compactação, taxa de ferramenta ativa, mantendo sessões apertadas |
| [plan mode](./docs/tips/plan-mode.md) | quando planejamento economiza tempo vs quando desperdiça |
| [fast mode](./docs/tips/fast-mode.md) | mesmo modelo, saída mais rápida, o trade-off |
| [plugins](./docs/tips/plugins.md) | construa um plugin do zero, o que torna um digno de instalação |
| [subagents](./docs/tips/subagents.md) | equipes de agentes, isolamento de worktree, quando o paralelo compensa |
| [mcp integration](./docs/tips/mcp-integration.md) | configure servidores MCP, use-os dentro de sessões |
| [hooks v2](./docs/tips/hooks-v2.md) | hooks de comando vs http vs prompt, o padrão assíncrono |

---

## hooks

copie um, configure, pronto. cada um é um script bash independente. [guia completo &rarr;](./docs/hooks.md)

| hook | evento | o que faz |
|---|---|---|
| [safety-guard](./hooks/safety-guard.sh) | PreToolUse | bloqueia force push, `rm -rf /`, DROP TABLE, curl-pipe-sh |
| [no-squash](./hooks/no-squash.sh) | PreToolUse | bloqueia squash merges |
| [panopticon](./hooks/panopticon.sh) | PostToolUse | registra cada chamada de ferramenta em sqlite |
| [context-save](./hooks/context-save.sh) | PreCompact | salva contexto antes da compressão |
| [notify](./hooks/notify.sh) | Notification | roteia para macOS, Slack, ntfy |

<details>
<summary>4 hooks a mais</summary>

| hook | evento | o que faz |
|---|---|---|
| [commit-nudge](./hooks/commit-nudge.sh) | PostToolUse | avisa você para fazer commit após N edições |
| [version-stamp](./hooks/version-stamp.sh) | SessionEnd | atualiza automaticamente stamps "tested with" |
| [stale-branch](./hooks/stale-branch.sh) | SessionStart | avisa sobre ramos de rastreamento desaparecidos |
| [md-lint-fix](./hooks/md-lint-fix.sh) | PostToolUse | corrige automaticamente lint de markdown ao salvar |

</details>

<img src="./gifs/hook-safety.gif" width="100%" alt="safety-guard blocking a dangerous command" />

## exemplo de agentes

copie para `.claude/agents/` e invoque com `/agent <name>`. cada um ensina um padrão diferente. [guia &rarr;](./docs/agents.md)

| agente | padrão | o que faz |
|---|---|---|
| [watch-tests](./examples/agents/watch-tests.md) | daemon | observa arquivos, executa testes, propõe correções |
| [try-worktree](./examples/agents/try-worktree.md) | worktree | tenta mudanças arriscadas em worktrees isoladas |
| [arch-review](./examples/agents/arch-review.md) | revisão rápida | teste rápido de smell de arquitetura |
| [write-pr](./examples/agents/write-pr.md) | integração git | descrições de PR a partir do seu diff |

## comandos que uso

| comando | o que faz |
|---|---|
| `/lore` | dados de uso · custos, sessões, busca, padrões |
| `/ship` | stage, commit, push, abre PR em um comando |
| `/improve` | propõe atualizações de CLAUDE.md a partir do histórico git |

mais [2 comandos de exemplo](./examples/commands/) que você pode copiar: `/sweep`, `/quicktest`.

---

## minhas opiniões pessoais

| | o que |
|---|---|
| [realidade de custo](./docs/cost.md) | o que claude code realmente custa, a matemática do prompt caching |
| [erros que cometi](./docs/mistakes.md) | o que me queimou para você puder pular |
| [automação](./docs/automation.md) | os 12 pipelines de CI que mantêm este repo |
| [fluxo de trabalho de sessão](./docs/session-workflow.md) | como trabalho dia a dia com claude code |
| [worktrees](./docs/worktrees.md) | exploração paralela com o aplicativo desktop |

## vs as alternativas

diplomático, orientado por dados, sem FUD. cada afirmação cita uma fonte.

[vs cursor](./docs/comparisons/cursor.md) &middot; [vs codex](./docs/comparisons/codex.md) &middot; [vs gemini](./docs/comparisons/gemini.md) &middot; [vs antigravity](./docs/comparisons/antigravity.md) &middot; [preço](./docs/comparisons/pricing.md)

---

## exemplos

- [templates CLAUDE.md](./examples/claude-md/) · configurações iniciais para TypeScript, Python, Rust, Next.js
- [agentes de exemplo](./examples/agents/) · 4 agentes, cada um ensinando um padrão diferente
- [comandos de exemplo](./examples/commands/) · 2 comandos que você pode copiar para qualquer projeto
- [plugin handoff](./examples/plugins/handoff/) · preservação de contexto PreCompact
- [plugin broadcast](./examples/plugins/broadcast/) · notificações assíncronas em eventos git

---

## como este repo funciona

este repo funciona com seus próprios padrões.

- **12 workflows de CI** · auditoria de docs, inteligência competitiva, resumo da comunidade, verificação de atualização, limpeza obsoleta, dependabot, lançamentos, teste de smoke de plugin, portão de qualidade de PR, validação, respondente de claude, observador upstream
- **11 hooks** em execução em cada sessão
- **<$1/mês** de custo de CI · workflows alimentados por IA usam haiku
- **0 manutenção manual** · tudo que não requer gosto é automatizado

[detalhes de automação &rarr;](./docs/automation.md)

---

## ferramentas que construí a partir desses padrões

todas saíram de viver no claude code todos os dias. cada uma resolve um problema específico que eu continuava enfrentando.

- **[lore](./plugins/lore/)** · mineração de sessões para sqlite. custos, busca, memória de erros, detecção de padrões
- **[claudemon](https://github.com/anipotts/claudemon)** · monitoramento de sessão em tempo real entre projetos e máquinas
- **[cc](./plugins/cc/)** · consciência multi-sessão. veja o que outras sessões estão fazendo, envie mensagens entre elas
- **[imessage-mcp](https://github.com/anipotts/imessage-mcp)** · servidor MCP para histórico de iMessage somente leitura. 26 ferramentas, zero solicitações de rede

## mais de mim

- [anipotts.com/thoughts](https://anipotts.com/thoughts) · formato longo
- [buttondown.com/anipotts](https://buttondown.com/anipotts) · newsletter
- [@anipottsbuilds](https://instagram.com/anipottsbuilds) · formato curto

---

MIT &middot; construído por [anipotts](https://anipotts.com)

<!-- translated from README.md @ 62df0ee -->
