> [EN](./README.md) | [ZH](./README.zh-CN.md) | [ES](./README.es.md) | [HI](./README.hi.md) | [PT](./README.pt-BR.md) | [JA](./README.ja.md)

# claude-code-tips

[![CI](https://github.com/anipotts/claude-code-tips/actions/workflows/validate.yml/badge.svg)](https://github.com/anipotts/claude-code-tips/actions/workflows/validate.yml)
[![GitHub estrellas](https://img.shields.io/github/stars/anipotts/claude-code-tips?style=flat-square&labelColor=111827&color=000)](https://github.com/anipotts/claude-code-tips/stargazers)
[![último commit](https://img.shields.io/github/last-commit/anipotts/claude-code-tips?style=flat-square&labelColor=111827&color=000)](https://github.com/anipotts/claude-code-tips/commits/main)
[![testeado con](https://img.shields.io/badge/tested%20with-Claude%20Code%20v2.1.94-000?style=flat-square&labelColor=D4A574&logo=anthropic&logoColor=white)](https://docs.anthropic.com/en/docs/claude-code)
[![licencia](https://img.shields.io/github/license/anipotts/claude-code-tips?style=flat-square&labelColor=111827&color=000)](./LICENSE)

patrones de claude code, probados en batalla en startups de YC, empresas tech públicas y unicornios. mantenido por alguien que usa claude code como su trabajo.

¿primer día? empieza con el [índice de consejos](./docs/tips/) o hojea [hooks](./docs/hooks.md) y [automatización](./docs/automation.md).

## qué hay adentro

tres plugins, un marketplace.

- **`mine@cc`** cada sesión minada en sqlite. consulta costos, herramientas, errores, puntos calientes, bucles, y búsqueda de texto completo en tu propio historial. todo local.
- **`cc@cc`** consciencia entre sesiones y mensajería. más un subsistema de `time`: `/cc:time-estimate` da estimaciones realistas de tiempo de claude code basadas en tu historial de sesiones, no en suposiciones optimistas.
- **`fuel@cc`** medidor de combustible de 3 metros (sesión de 5 horas, semanal de 7 días, contexto de 200k). hook pre-turno empuja a claude hacia handoffs más limpios conforme se llenan los medidores. `/fuel state` los lee directamente; `/fuel handoff` redacta un punto de parada.

```
> /cc:time-estimate "rewrite auth middleware and add tests"
CC: ~22 min active (standard mode, Opus 4.7 high)
tu tiempo: ~15 min review
```

## inicio rápido

```bash
/plugin marketplace add anipotts/claude-code-tips   # agregar marketplace (una sola vez)
/plugin install mine@cc                             # instalar mine (análisis de sesión)
/plugin install cc@cc                               # instalar cc (mensajería entre sesiones)
```

luego: copia [safety-guard.sh](./hooks/safety-guard.sh) para bloquear comandos peligrosos. lee un [consejo](./docs/tips/). listo.

---

## los números

cientos de sesiones en docenas de proyectos. máximo plan de $200/mes.

el mismo uso costaría ~$12K en la API con caching, ~$95K sin. sin bucles autónomos. sin cron jobs. cada sesión comienza cuando me dispongo a escribir un prompt. [cómo funciona la matemática de costos &rarr;](./docs/cost.md)

<img src="./gifs/mine-stats.gif" width="100%" alt="estadísticas de mine mostrando sesiones, tokens, costos y proyectos" />

---

## instala el plugin mine

```bash
/plugin marketplace add anipotts/claude-code-tips   # agregar marketplace (una sola vez)
/plugin install mine@cc                             # instalar mine (análisis de sesión)
/plugin install cc@cc                               # instalar cc (mensajería entre sesiones)
```

obtienes **[mine](./plugins/mine/)** · minería de sesiones en sqlite. costos, búsqueda, memoria de errores, detección de patrones. todos los datos se quedan locales en `~/.claude/mine.db`.

```
/mine                     sesiones de hoy, costo, herramientas principales
/mine search "websocket"  búsqueda de texto completo en todas las conversaciones
/mine mistakes            patrones de error que claude sigue repitiendo
/mine hotspots            archivos más editados en todas las sesiones
/mine loops               patrones repetidos en todas las sesiones
```

empieza con `mine` + el hook `safety-guard`. agrega más conforme avances. **[docs de mine &rarr;](./plugins/mine/)**

---

## plugin cc

mensajería entre sesiones y el subsistema `time`. ve qué están haciendo otras sesiones de claude code, envía mensajes entre ellas, y obtén estimaciones de tiempo realistas basadas en tu propio historial de sesiones.

```bash
/plugin install cc@cc
```

```
/cc                             mostrar sesiones activas
/cc send merizo "pause"         enviar mensaje a otra sesión
/cc:time-estimate <task>        estimación CC en rango, usa tu modelo actual + esfuerzo
/cc:time-calibrate              diff rendimiento real (desde mine.db) contra la regla
/cc:time-benchmark              A/B/C guiado en niveles de esfuerzo en tu modelo
```

---

## las 3 cosas que cambiaron cómo codifico

### hooks

los hooks son la diferencia entre "claude hace lo que quiero" y "claude hace lo que le antoja". CLAUDE.md da orientación. los hooks dan cumplimiento. uno es una sugerencia, el otro es una pared.

este repo tiene 9 hooks que puedes soltar en cualquier proyecto. safety-guard bloquea force pushes, `rm -rf /`, y `curl | bash`. no-squash bloquea squash merges. context-save preserva estado antes de compresión. elige los que encajen con tu flujo de trabajo. [guía de hooks &rarr;](./docs/hooks.md)

### equipos de agentes

múltiples instancias de claude trabajando simultáneamente en el mismo codebase, cada una en su propio git worktree. el coordinador asigna tareas, recopila resultados, fusiona el mejor enfoque.

uso esto para investigación paralela, intentar cambios riesgosos de forma segura, y comparar enfoques lado a lado sin tocar mi árbol de trabajo. [cómo uso equipos de agentes &rarr;](./docs/agents.md)

### prompt caching

esto es por qué el plan de $200/mes es el mejor trato en coding con IA. claude code cachea tu system prompt, herramientas, y CLAUDE.md como prefijo. 91% de mis tokens de entrada golpean la caché, lo que significa que pago 10% del costo de entrada en 91% de mis lecturas.

la clave: mantén tu CLAUDE.md corto y estable. cada edición rompe la caché de prefijo. el mío es 30 líneas y cambia quizás una vez por semana. [el desglose completo de costos &rarr;](./docs/cost.md)

---

## consejos

técnicas cortas e independientes. cada una es algo que puedes usar en tu próxima sesión.

| consejo | qué aprendes |
|-----|---------------|
| [prompt caching](./docs/tips/prompt-caching.md) | obtén tasas de caché de 97%+, reduce tu factura |
| [safety hooks](./docs/tips/safety-hooks.md) | bloquea force pushes y rm -rf en 5 minutos |
| [jerarquía de settings](./docs/tips/settings-hierarchy.md) | settings de proyecto vs global vs local |
| [duración de sesión](./docs/tips/session-length.md) | por qué sesiones más cortas son más eficientes (con datos) |
| [ultrathink](./docs/tips/ultrathink.md) | fuerza pensamiento extendido para problemas complejos |
| [gestión de contexto](./docs/tips/context-management.md) | estrategias de compresión, tasa de herramienta activa, mantén sesiones apretadas |
| [plan mode](./docs/tips/plan-mode.md) | cuándo planificar ahorra tiempo vs cuándo lo desperdicia |
| [fast mode](./docs/tips/fast-mode.md) | mismo modelo, salida más rápida, el tradeoff |
| [plugins](./docs/tips/plugins.md) | construye un plugin desde cero, qué hace uno que valga la pena instalar |
| [subagentes](./docs/tips/subagents.md) | equipos de agentes, aislamiento de worktree, cuándo el paralelismo vale la pena |
| [integración mcp](./docs/tips/mcp-integration.md) | conecta servidores MCP, úsalos dentro de sesiones |
| [hooks v2](./docs/tips/hooks-v2.md) | hooks de comando vs http vs prompt, el patrón async |

---

## hooks

copia uno, conectalo, listo. cada uno es un script bash independiente. [guía completa &rarr;](./docs/hooks.md)

| hook | evento | qué hace |
|---|---|---|
| [safety-guard](./hooks/safety-guard.sh) | PreToolUse | bloquea force push, `rm -rf /`, DROP TABLE, curl-pipe-sh |
| [no-squash](./hooks/no-squash.sh) | PreToolUse | bloquea squash merges |
| [panopticon](./hooks/panopticon.sh) | PostToolUse | registra cada llamada de herramienta en sqlite |
| [context-save](./hooks/context-save.sh) | PreCompact | guarda contexto antes de compresión |
| [notify](./hooks/notify.sh) | Notification | enruta a macOS, Slack, ntfy |

<details>
<summary>4 hooks más</summary>

| hook | evento | qué hace |
|---|---|---|
| [commit-nudge](./hooks/commit-nudge.sh) | PostToolUse | te recuerda que hagas commit después de N ediciones |
| [version-stamp](./hooks/version-stamp.sh) | SessionEnd | actualiza automáticamente sellos "testeado con" |
| [stale-branch](./hooks/stale-branch.sh) | SessionStart | advierte sobre ramas de tracking desaparecidas |
| [md-lint-fix](./hooks/md-lint-fix.sh) | PostToolUse | auto-corrige linting de markdown al guardar |

</details>

<img src="./gifs/hook-safety.gif" width="100%" alt="safety-guard bloqueando un comando peligroso" />

## agentes de ejemplo

copia a `.claude/agents/` e invoca con `/agent <name>`. cada uno enseña un patrón diferente. [guía &rarr;](./docs/agents.md)

| agente | patrón | qué hace |
|---|---|---|
| [watch-tests](./examples/agents/watch-tests.md) | daemon | vigila archivos, ejecuta tests, propone correcciones |
| [try-worktree](./examples/agents/try-worktree.md) | worktree | intenta cambios riesgosos en worktrees aislados |
| [arch-review](./examples/agents/arch-review.md) | revisión rápida | prueba rápida de huelen a arquitectura |
| [write-pr](./examples/agents/write-pr.md) | integración git | descripciones de PR desde tu diff |

## comandos que uso

| comando | qué hace |
|---|---|
| `/mine` | datos de uso · costos, sesiones, búsqueda, patrones |
| `/ship` | stage, commit, push, abrir PR en un comando |
| `/improve` | proponer actualizaciones de CLAUDE.md desde historial git |

más [2 comandos de ejemplo](./examples/commands/) que puedes copiar: `/sweep`, `/quicktest`.

---

## mis opiniones personales

| | qué |
|---|---|
| [realidad de costos](./docs/cost.md) | qué cuesta realmente claude code, la matemática de prompt caching |
| [errores que cometí](./docs/mistakes.md) | lo que me quemó para que puedas evitarlo |
| [automatización](./docs/automation.md) | los 12 pipelines de CI que mantienen este repo |
| [flujo de trabajo de sesión](./docs/session-workflow.md) | cómo trabajo día a día con claude code |
| [worktrees](./docs/worktrees.md) | exploración paralela con la app de escritorio |

## vs las alternativas

diplomático, basado en datos, sin FUD. cada afirmación cita una fuente.

[vs cursor](./docs/comparisons/cursor.md) &middot; [vs codex](./docs/comparisons/codex.md) &middot; [vs gemini](./docs/comparisons/gemini.md) &middot; [vs antigravity](./docs/comparisons/antigravity.md) &middot; [precios](./docs/comparisons/pricing.md)

---

## ejemplos

- [plantillas CLAUDE.md](./examples/claude-md/) · configuraciones iniciales para TypeScript, Python, Rust, Next.js
- [agentes de ejemplo](./examples/agents/) · 4 agentes, cada uno enseña un patrón diferente
- [comandos de ejemplo](./examples/commands/) · 2 comandos que puedes copiar a cualquier proyecto
- [plugin handoff](./examples/plugins/handoff/) · preservación de contexto PreCompact
- [plugin broadcast](./examples/plugins/broadcast/) · notificaciones async en eventos git

---

## cómo funciona este repo

este repo corre sobre sus propios patrones.

- **12 flujos de trabajo de CI** · auditoría de docs, inteligencia competitiva, digestión de comunidad, verificación de frescura, limpieza de estancamiento, dependabot, releases, prueba de humo de plugins, puerta de calidad de PR, validación, respondedor claude, observador ascendente
- **11 hooks** ejecutándose en cada sesión
- **<$1/mes** costo de CI · flujos de trabajo con IA usan haiku
- **0 mantenimiento manual** · todo lo que no requiere gusto es automatizado

[detalles de automatización &rarr;](./docs/automation.md)

---

## herramientas que construí a partir de estos patrones

todas surgieron de vivir en claude code cada día. cada una resuelve un problema específico que seguía encontrando.

- **[mine](./plugins/mine/)** · minería de sesiones en sqlite. costos, búsqueda, memoria de errores, detección de patrones
- **[claudemon](https://github.com/anipotts/claudemon)** · monitoreo de sesiones en tiempo real en proyectos y máquinas
- **[cc](./plugins/cc/)** · consciencia multi-sesión. ve qué están haciendo otras sesiones, envía mensajes entre ellas
- **[imessage-mcp](https://github.com/anipotts/imessage-mcp)** · servidor MCP para historial de iMessage de solo lectura. 26 herramientas, cero solicitudes de red

## más de mí

- [anipotts.com/thoughts](https://anipotts.com/thoughts) · formato largo
- [buttondown.com/anipotts](https://buttondown.com/anipotts) · boletín
- [@anipottsbuilds](https://instagram.com/anipottsbuilds) · formato corto

---

MIT &middot; hecho por [anipotts](https://anipotts.com)

<!-- translated from README.md @ 925abe7 -->
