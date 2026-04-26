> [EN](./README.md) | [ZH](./README.zh-CN.md) | [ES](./README.es.md) | [HI](./README.hi.md) | [PT](./README.pt-BR.md) | [JA](./README.ja.md)

# claude-code-tips

[![CI](https://github.com/anipotts/claude-code-tips/actions/workflows/validate.yml/badge.svg)](https://github.com/anipotts/claude-code-tips/actions/workflows/validate.yml)
[![GitHub stars](https://img.shields.io/github/stars/anipotts/claude-code-tips?style=flat-square&labelColor=111827&color=000)](https://github.com/anipotts/claude-code-tips/stargazers)
[![last commit](https://img.shields.io/github/last-commit/anipotts/claude-code-tips?style=flat-square&labelColor=111827&color=000)](https://github.com/anipotts/claude-code-tips/commits/main)
[![tested with](https://img.shields.io/badge/tested%20with-Claude%20Code%20v2.1.94-000?style=flat-square&labelColor=D4A574&logo=anthropic&logoColor=white)](https://docs.anthropic.com/en/docs/claude-code)
[![license](https://img.shields.io/github/license/anipotts/claude-code-tips?style=flat-square&labelColor=111827&color=000)](./LICENSE)

padrões de claude code, testados em batalha em startups da YC, empresas tech públicas e unicórnios. mantido por alguém que usa Claude Code como seu trabalho.

novo aqui? comece com o [índice de dicas](./docs/tips/) ou dê uma olhada em [hooks](./docs/hooks.md) e [automação](./docs/automation.md).

## o que tem dentro

três plugins, um marketplace.

- **`lore@cc`** toda sessão minerada em sqlite. consulte custos, ferramentas, erros, pontos quentes, loops e busca de texto completo no seu próprio histórico. tudo local.
- **`cc@cc`** consciência entre sessões e mensagens. além de um subsistema `time`: `/cc:time-estimate` fornece estimativas de tempo realistas de claude code baseadas no seu histórico de sessões, não em palpites otimistas.
- **`fuel@cc`** medidor de combustível de 3 metros (sessão de 5 horas, semanal de 7 dias, 200k de contexto). hook pré-turno incentiva claude em direção a handoffs mais limpos conforme os medidores enchem. `/fuel state` lê-os diretamente; `/fuel handoff` elabora um ponto de parada.

```
> /cc:time-estimate "rewrite auth middleware and add tests"
CC: ~22 min active (standard mode, Opus 4.7 high)
seu tempo: ~15 min review
```

## início rápido

```bash
/plugin marketplace add anipotts/claude-code-tips   # adicionar marketplace (uma vez)
/plugin install lore@cc                             # instalar lore (análise de sessão)
/plugin install cc@cc                               # instalar cc (mensagens entre sessões)
```

depois: copie [safety-guard.sh](./hooks/safety-guard.sh) para bloquear comandos perigosos. leia uma [dica](./docs/tips/). pronto.

---

## os números

centenas de sessões em dúzias de projetos. máximo de $200/mês no plano.

o mesmo uso custaria ~$12K na API com caching, ~$95K sem. sem loops autônomos. sem cron jobs. toda sessão começa com você digitando um prompt. [como a matemática de custos funciona &rarr;](./docs/cost.md)

<img src="./gifs/mine-stats.gif" width="100%" alt="mine stats mostrando sessões, tokens, custos e projetos" />

---

## instale o plugin lore

```bash
/plugin marketplace add anipotts/claude-code-tips   # adicionar marketplace (uma vez)
/plugin install lore@cc                             # instalar lore (análise de sessão)
/plugin install cc@cc                               # instalar cc (mensagens entre sessões)
```

você obtém **[lore](./plugins/lore/)** · mineração de sessão para sqlite. custos, busca, memória de erros, detecção de padrões. todos os dados ficam locais em `~/.claude/lore/lore.db`.

```
/lore                     sessões de hoje, custo, ferramentas principais
/lore search "websocket"  busca de texto completo em todas as conversas
/lore mistakes            padrões de erro que claude continua repetindo
/lore hotspots            arquivos mais editados em todas as sessões
/lore loops               padrões repetidos em todas as sessões
```

comece com `lore` + o hook `safety-guard`. adicione mais conforme avança. **[documentação de lore &rarr;](./plugins/lore/)**

---

## plugin cc

mensagens entre sessões e subsistema `time`. veja o que outras sessões de Claude Code estão fazendo, envie mensagens entre elas e obtenha estimativas de tempo realistas baseadas no seu próprio histórico de sessões.

```bash
/plugin install cc@cc
```

```
/cc                             mostrar sessões ativas
/cc send merizo "pause"         enviar mensagem para outra sessão
/cc:time-estimate <task>        estimativa CC em intervalo, usa seu modelo atual + esforço
/cc:time-calibrate              diff throughput real (de lore.db) contra a regra
/cc:time-benchmark              A/B/C guiado em níveis de esforço no seu modelo
```

---

## as 3 coisas que mudaram como eu codifico

### hooks

hooks são a diferença entre "claude faz o que quero" e "claude faz o que bem entende". CLAUDE.md oferece orientação. hooks aplicam. uma é uma sugestão, a outra é uma parede.

este repositório tem 9 hooks que você pode usar em qualquer projeto. safety-guard bloqueia force pushes, `rm -rf /` e `curl | bash`. no-squash bloqueia squash merges. context-save preserva estado antes da compressão. escolha os que se encaixam no seu fluxo de trabalho. [guia de hooks &rarr;](./docs/hooks.md)

### equipes de agentes

múltiplas instâncias de Claude trabalhando simultaneamente no mesmo codebase, cada uma em sua própria worktree git. o coordenador atribui tarefas, coleta resultados, mescla a melhor abordagem.

uso isso para pesquisa paralela, tentando mudanças arriscadas com segurança e comparando abordagens lado a lado sem tocar na minha árvore de trabalho. [como uso equipes de agentes &rarr;](./docs/agents.md)

### prompt caching

é por isso que o plano de $200/mês é o melhor negócio em codificação com IA. Claude Code cacheia seu prompt de sistema, ferramentas e CLAUDE.md como prefixo. 91% dos meus tokens de entrada acertam o cache, significando que pago 10% do custo de entrada em 91% das minhas leituras.

a chave: mantenha seu CLAUDE.md curto e estável. cada edição quebra o cache de prefixo. o meu tem 30 linhas e muda talvez uma vez por semana. [o detalhamento completo de custos &rarr;](./docs/cost.md)

---

## dicas

técnicas curtas e autossuficientes. cada uma é algo que você pode usar em sua próxima sessão.

| dica | o que você aprende |
|-----|---------------|
| [prompt caching](./docs/tips/prompt-caching.md) | obtenha taxas de acerto de cache de 97%+, reduza sua conta |
| [safety hooks](./docs/tips/safety-hooks.md) | bloqueie force pushes e rm -rf em 5 minutos |
| [settings hierarchy](./docs/tips/settings-hierarchy.md) | configurações de projeto vs globais vs locais |
| [session length](./docs/tips/session-length.md) | por que sessões mais curtas são mais eficientes (com dados) |
| [ultrathink](./docs/tips/ultrathink.md) | force pensamento estendido para problemas complexos |
| [context management](./docs/tips/context-management.md) | estratégias de compressão, taxa de ferramenta ativa, manter sessões ajustadas |
| [plan mode](./docs/tips/plan-mode.md) | quando o planejamento economiza tempo vs quando desperdica |
| [fast mode](./docs/tips/fast-mode.md) | mesmo modelo, saída mais rápida, a troca |
| [plugins](./docs/tips/plugins.md) | construa um plugin do zero, o que faz um valer a pena instalar |
| [subagents](./docs/tips/subagents.md) | equipes de agentes, isolamento de worktree, quando paralelo compensa |
| [mcp integration](./docs/tips/mcp-integration.md) | conecte servidores MCP, use-os dentro de sessões |
| [hooks v2](./docs/tips/hooks-v2.md) | command vs http vs prompt hooks, o padrão async |

---

## hooks

copie um, configure, pronto. cada um é um script bash autossuficiente. [guia completo &rarr;](./docs/hooks.md)

| hook | evento | o que faz |
|---|---|---|
| [safety-guard](./hooks/safety-guard.sh) | PreToolUse | bloqueia force push, `rm -rf /`, DROP TABLE, curl-pipe-sh |
| [no-squash](./hooks/no-squash.sh) | PreToolUse | bloqueia squash merges |
| [panopticon](./hooks/panopticon.sh) | PostToolUse | registra toda chamada de ferramenta em sqlite |
| [context-save](./hooks/context-save.sh) | PreCompact | salva contexto antes da compressão |
| [notify](./hooks/notify.sh) | Notification | roteia para macOS, Slack, ntfy |

<details>
<summary>4 hooks a mais</summary>

| hook | evento | o que faz |
|---|---|---|
| [commit-nudge](./hooks/commit-nudge.sh) | PostToolUse | lembra você de fazer commit após N edições |
| [version-stamp](./hooks/version-stamp.sh) | SessionEnd | auto-atualiza stamps "testado com" |
| [stale-branch](./hooks/stale-branch.sh) | SessionStart | avisa sobre branches de rastreamento desaparecidos |
| [md-lint-fix](./hooks/md-lint-fix.sh) | PostToolUse | auto-corrige markdown lint ao salvar |

</details>

<img src="./gifs/hook-safety.gif" width="100%" alt="safety-guard bloqueando um comando perigoso" />

## agentes de exemplo

copie para `.claude/agents/` e invoque com `/agent <name>`. cada um ensina um padrão diferente. [guia &rarr;](./docs/agents.md)

| agente | padrão | o que faz |
|---|---|---|
| [watch-tests](./examples/agents/watch-tests.md) | daemon | monitora arquivos, executa testes, propõe correções |
| [try-worktree](./examples/agents/try-worktree.md) | worktree | tenta mudanças arriscadas em worktrees isoladas |
| [arch-review](./examples/agents/arch-review.md) | quick review | teste de smell de arquitetura rápido |
| [write-pr](./examples/agents/write-pr.md) | git integration | descrições de PR do seu diff |

## comandos que uso

| comando | o que faz |
|---|---|
| `/lore` | dados de uso · custos, sessões, busca, padrões |
| `/ship` | stage, commit, push, abrir PR em um comando |
| `/improve` | propor atualizações de CLAUDE.md do histórico git |

além de [2 comandos de exemplo](./examples/commands/) que você pode copiar: `/sweep`, `/quicktest`.

---

## meus posicionamentos pessoais

| | o que |
|---|---|
| [realidade de custos](./docs/cost.md) | quanto Claude Code realmente custa, a matemática do prompt caching |
| [erros que cometi](./docs/mistakes.md) | o que me queimou para você poder pular |
| [automação](./docs/automation.md) | os 12 pipelines CI que mantêm este repositório |
| [fluxo de trabalho de sessão](./docs/session-workflow.md) | como trabalho diariamente com Claude Code |
| [worktrees](./docs/worktrees.md) | exploração paralela com o app de desktop |

## vs as alternativas

diplomático, orientado por dados, sem FUD. toda afirmação cita uma fonte.

[vs cursor](./docs/comparisons/cursor.md) &middot; [vs codex](./docs/comparisons/codex.md) &middot; [vs gemini](./docs/comparisons/gemini.md) &middot; [vs antigravity](./docs/comparisons/antigravity.md) &middot; [preços](./docs/comparisons/pricing.md)

---

## exemplos

- [templates de CLAUDE.md](./examples/claude-md/) · configurações iniciais para TypeScript, Python, Rust, Next.js
- [agentes de exemplo](./examples/agents/) · 4 agentes, cada um ensinando um padrão diferente
- [comandos de exemplo](./examples/commands/) · 2 comandos que você pode copiar para qualquer projeto
- [plugin handoff](./examples/plugins/handoff/) · preservação de contexto pré-compactação
- [plugin broadcast](./examples/plugins/broadcast/) · notificações assíncronas em eventos git

---

## como este repositório funciona

este repositório é executado com seus próprios padrões.

- **12 workflows CI** · auditoria de docs, inteligência competitiva, resumo comunitário, verificação de atualização, limpeza obsoleta, dependabot, releases, teste de smoke de plugin, portão de qualidade de PR, validação, respondente Claude, observador upstream
- **11 hooks** rodando em cada sessão
- **<$1/mês** custo de CI · workflows alimentados por IA usam haiku
- **0 manutenção manual** · tudo que não requer gosto é automatizado

[detalhes de automação &rarr;](./docs/automation.md)

---

## ferramentas que construí com esses padrões

todas saíram de viver em Claude Code todos os dias. cada uma resolve um problema específico que continuava acontecendo.

- **[lore](./plugins/lore/)** · mineração de sessão para sqlite. custos, busca, memória de erros, detecção de padrões
- **[claudemon](https://github.com/anipotts/claudemon)** · monitoramento de sessão em tempo real em projetos e máquinas
- **[cc](./plugins/cc/)** · consciência multi-sessão. veja o que outras sessões estão fazendo, envie mensagens entre elas
- **[imessage-mcp](https://github.com/anipotts/imessage-mcp)** · servidor MCP para histórico de iMessage somente leitura. 26 ferramentas, zero requisições de rede

## mais de mim

- [anipotts.com/thoughts](https://anipotts.com/thoughts) · long-form
- [buttondown.com/anipotts](https://buttondown.com/anipotts) · newsletter
- [@anipottsbuilds](https://instagram.com/anipottsbuilds) · short-form

---

MIT &middot; construído por [anipotts](https://anipotts.com)

<!-- translated from README.md @ 925abe7 -->
