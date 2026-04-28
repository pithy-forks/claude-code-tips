> [EN](./README.md) | [ZH](./README.zh-CN.md) | [ES](./README.es.md) | [HI](./README.hi.md) | [PT](./README.pt-BR.md) | [JA](./README.ja.md)

# claude-code-tips

[![CI](https://github.com/anipotts/claude-code-tips/actions/workflows/validate.yml/badge.svg)](https://github.com/anipotts/claude-code-tips/actions/workflows/validate.yml)
[![GitHub estrellas](https://img.shields.io/github/stars/anipotts/claude-code-tips?style=flat-square&labelColor=111827&color=000)](https://github.com/anipotts/claude-code-tips/stargazers)
[![último commit](https://img.shields.io/github/last-commit/anipotts/claude-code-tips?style=flat-square&labelColor=111827&color=000)](https://github.com/anipotts/claude-code-tips/commits/main)
[![probado con](https://img.shields.io/badge/tested%20with-Claude%20Code%20v2.1.122-000?style=flat-square&labelColor=D4A574&logo=anthropic&logoColor=white)](https://docs.anthropic.com/en/docs/claude-code)
[![licencia](https://img.shields.io/github/license/anipotts/claude-code-tips?style=flat-square&labelColor=111827&color=000)](./LICENSE)

patrones de Claude Code, probados en batalla en startups de YC, empresas tech públicas y unicornios. mantenido por alguien que usa Claude Code como su trabajo.

¿nuevo acá? empezá con el [índice de consejos](./docs/tips/) o mirá rápido [hooks](./docs/hooks.md) y [automatización](./docs/automation.md).

## qué hay adentro

tres plugins, un marketplace.

- **`lore@anipotts`** cada sesión extraída a sqlite. consultá costos, herramientas, errores, puntos calientes, bucles, y búsqueda de texto completo en tu propio historial. todo local.
- **`cc@anipotts`** conciencia entre sesiones y mensajería. más un subsistema de `time`: `/cc:time-estimate` da estimaciones realistas de tiempo en Claude Code basadas en tu historial de sesiones, no en suposiciones optimistas.
- **`time@anipotts`** indicador de combustible de 3 metros (sesión de 5 horas, semanal de 7 días, 200k de contexto). hook pre-turno empuja a Claude hacia handoffs más limpios conforme se llenan los metros. `/fuel state` los lee directamente; `/fuel handoff` redacta un punto de parada.

```
> /cc:time-estimate "reescribir middleware de auth y agregar tests"
CC: ~22 min activo (modo standard, Opus 4.7 high)
tu tiempo: ~15 min revisión
```

## inicio rápido

```bash
/plugin marketplace add anipotts/claude-code-tips   # agregar marketplace (una sola vez)
/plugin install lore@anipotts                             # instalar lore (analítica de sesiones)
/plugin install cc@anipotts                               # instalar cc (mensajería entre sesiones)
```

después: copiá [safety-guard.sh](./hooks/safety-guard.sh) para bloquear comandos peligrosos. leé un [consejo](./docs/tips/). listo.

---

## los números

cientos de sesiones en docenas de proyectos. máximo plan de $200/mes.

el mismo uso costaría ~$12K en la API con caching, ~$95K sin. sin bucles autónomos. sin cron jobs. cada sesión empieza conmigo escribiendo un prompt. [cómo funciona la matemática del costo →](./docs/cost.md)

<img src="./gifs/mine-stats.gif" width="100%" alt="estadísticas de mine mostrando sesiones, tokens, costos y proyectos" />

---

## instalá el plugin lore

```bash
/plugin marketplace add anipotts/claude-code-tips   # agregar marketplace (una sola vez)
/plugin install lore@anipotts                             # instalar lore (analítica de sesiones)
/plugin install cc@anipotts                               # instalar cc (mensajería entre sesiones)
```

obtenés **[lore](./plugins/lore/)** · extracción de sesiones a sqlite. costos, búsqueda, memoria de errores, detección de patrones. todos los datos se mantienen locales en `~/.claude/lore/lore.db`.

```
/lore                     sesiones de hoy, costo, herramientas principales
/lore search "websocket"  búsqueda de texto completo en todas las conversaciones
/lore mistakes            patrones de errores que Claude sigue repitiendo
/lore hotspots            archivos más editados entre sesiones
/lore loops               patrones repetidos entre sesiones
```

empezá con `lore` + el hook `safety-guard`. agregá más conforme avanzás. **[documentación de lore →](./plugins/lore/)**

---

## plugin cc

mensajería entre sesiones y el subsistema de `time`. mirá qué hacen otras sesiones de Claude Code, enviá mensajes entre ellas, y obtené estimaciones de tiempo realistas basadas en tu propio historial de sesiones.

```bash
/plugin install cc@anipotts
```

```
/cc                             mostrar sesiones activas
/cc send merizo "pause"         enviar mensaje a otra sesión
/cc:time-estimate <task>        estimación CC en rango, usa tu modelo actual + esfuerzo
/cc:time-calibrate              diferencia de throughput real (de lore.db) contra la regla
/cc:time-benchmark              A/B/C guiado entre niveles de esfuerzo en tu modelo
```

---

## las 3 cosas que cambiaron cómo codifico

### hooks

hooks son la diferencia entre "Claude hace lo que quiero" y "Claude hace lo que se le antoja." CLAUDE.md da orientación. hooks dan fuerza. uno es una sugerencia, el otro es una pared.

este repo tiene 9 hooks que podés soltar en cualquier proyecto. safety-guard bloquea force pushes, `rm -rf /`, y `curl | bash`. no-squash bloquea squash merges. context-save preserva el estado antes de compactación. elegí los que se ajusten a tu flujo de trabajo. [guía de hooks →](./docs/hooks.md)

### equipos de agentes

múltiples instancias de Claude trabajando simultáneamente en la misma base de código, cada una en su propio git worktree. el coordinador asigna tareas, recoge resultados, fusiona el mejor enfoque.

uso esto para investigación paralela, intentar cambios riesgosos de forma segura, y comparar enfoques lado a lado sin tocar mi worktree activo. [cómo uso equipos de agentes →](./docs/agents.md)

### prompt caching

esto es por qué el plan de $200/mes es el mejor negocio en codificación con IA. Claude Code cachea tu system prompt, herramientas, y CLAUDE.md como prefijo. 91% de mis tokens de entrada golpean el cache, lo que significa que pago 10% del costo de entrada en 91% de mis lecturas.

la clave: mantené tu CLAUDE.md corto y estable. cada edición rompe el prefix cache. el mío tiene 30 líneas y cambia quizás una vez a la semana. [el breakdown de costos completo →](./docs/cost.md)

---

## consejos

técnicas cortas y standalone. cada una es algo que podés usar en tu próxima sesión.

| consejo | qué aprendés |
|-----|---------------|
| [prompt caching](./docs/tips/prompt-caching.md) | obtené tasas de cache hit de 97%+, reduce tu factura |
| [safety hooks](./docs/tips/safety-hooks.md) | bloqueá force pushes y rm -rf en 5 minutos |
| [jerarquía de configuración](./docs/tips/settings-hierarchy.md) | configuración de proyecto vs global vs local |
| [duración de sesión](./docs/tips/session-length.md) | por qué sesiones más cortas son más eficientes (con datos) |
| [ultrathink](./docs/tips/ultrathink.md) | forzá pensamiento extendido para problemas complejos |
| [gestión de contexto](./docs/tips/context-management.md) | estrategias de compactación, tasa de herramientas activas, mantener sesiones ajustadas |
| [modo plan](./docs/tips/plan-mode.md) | cuándo planificar ahorra tiempo vs cuándo lo desperdicia |
| [modo rápido](./docs/tips/fast-mode.md) | mismo modelo, output más rápido, el tradeoff |
| [plugins](./docs/tips/plugins.md) | construye un plugin desde cero, qué hace que uno valga la pena instalar |
| [subagentes](./docs/tips/subagents.md) | equipos de agentes, aislamiento de worktree, cuándo paralelismo se paga |
| [integración MCP](./docs/tips/mcp-integration.md) | conectá servidores MCP, úsalos adentro de sesiones |
| [hooks v2](./docs/tips/hooks-v2.md) | hooks de comando vs http vs prompt, el patrón async |

---

## hooks

copiá uno, conéctalo, listo. cada uno es un script bash standalone. [guía completa →](./docs/hooks.md)

| hook | evento | qué hace |
|---|---|---|
| [safety-guard](./hooks/safety-guard.sh) | PreToolUse | bloquea force push, `rm -rf /`, DROP TABLE, curl-pipe-sh |
| [no-squash](./hooks/no-squash.sh) | PreToolUse | bloquea squash merges |
| [panopticon](./hooks/panopticon.sh) | PostToolUse | registra cada tool call a sqlite |
| [context-save](./hooks/context-save.sh) | PreCompact | guarda contexto antes de compresión |
| [notify](./hooks/notify.sh) | Notification | enruta a macOS, Slack, ntfy |

<details>
<summary>4 hooks más</summary>

| hook | evento | qué hace |
|---|---|---|
| [commit-nudge](./hooks/commit-nudge.sh) | PostToolUse | te recuerda hacer commit después de N ediciones |
| [version-stamp](./hooks/version-stamp.sh) | SessionEnd | actualiza automáticamente sellos de "probado con" |
| [stale-branch](./hooks/stale-branch.sh) | SessionStart | advierte sobre ramas tracking que se fueron |
| [md-lint-fix](./hooks/md-lint-fix.sh) | PostToolUse | arregla automáticamente markdown lint al guardar |

</details>

<img src="./gifs/hook-safety.gif" width="100%" alt="safety-guard bloqueando un comando peligroso" />

## agentes de ejemplo

copiá a `.claude/agents/` e invocá con `/agent <name>`. cada uno enseña un patrón diferente. [guía →](./docs/agents.md)

| agente | patrón | qué hace |
|---|---|---|
| [watch-tests](./examples/agents/watch-tests.md) | daemon | observa archivos, corre tests, propone fixes |
| [try-worktree](./examples/agents/try-worktree.md) | worktree | intenta cambios riesgosos en worktrees aislados |
| [arch-review](./examples/agents/arch-review.md) | revisión rápida | prueba rápida de olor de arquitectura |
| [write-pr](./examples/agents/write-pr.md) | integración git | descripciones de PR desde tu diff |

## comandos que uso

| comando | qué hace |
|---|---|
| `/lore` | datos de uso · costos, sesiones, búsqueda, patrones |
| `/ship` | stage, commit, push, abrir PR en un comando |
| `/improve` | propone actualizaciones de CLAUDE.md desde historial git |

más [2 comandos de ejemplo](./examples/commands/) que podés copiar: `/sweep`, `/quicktest`.

---

## mis opiniones personales

| | qué |
|---|---|
| [realidad de costos](./docs/cost.md) | qué cuesta realmente Claude Code, la matemática del prompt caching |
| [errores que cometí](./docs/mistakes.md) | qué me quemó para que podés saltarlo |
| [automatización](./docs/automation.md) | los 12 pipelines de CI que mantienen este repo |
| [flujo de trabajo de sesión](./docs/session-workflow.md) | cómo trabajo día a día con Claude Code |
| [worktrees](./docs/worktrees.md) | exploración paralela con la aplicación de escritorio |

## vs las alternativas

diplomático, basado en datos, sin FUD. cada afirmación cita una fuente.

[vs cursor](./docs/comparisons/cursor.md) · [vs codex](./docs/comparisons/codex.md) · [vs gemini](./docs/comparisons/gemini.md) · [vs antigravity](./docs/comparisons/antigravity.md) · [precios](./docs/comparisons/pricing.md)

---

## ejemplos

- [plantillas CLAUDE.md](./examples/claude-md/) · configuraciones de inicio para TypeScript, Python, Rust, Next.js
- [agentes de ejemplo](./examples/agents/) · 4 agentes, cada uno enseña un patrón diferente
- [comandos de ejemplo](./examples/commands/) · 2 comandos que podés copiar a cualquier proyecto
- [plugin de handoff](./examples/plugins/handoff/) · preservación de contexto PreCompact
- [plugin de broadcast](./examples/plugins/broadcast/) · notificaciones async en eventos git

---

## cómo funciona este repo

este repo corre en sus propios patrones.

- **12 flujos de CI** · auditoría de docs, inteligencia competitiva, digestión comunitaria, verificación de frescura, limpieza de obsoletos, dependabot, releases, prueba de smoke del plugin, puerta de calidad de PR, validación, respondedor de claude, vigilante upstream
- **11 hooks** corriendo en cada sesión
- **<$1/mes** costo de CI · flujos de trabajo con IA usan haiku
- **0 mantenimiento manual** · todo lo que no requiere buen gusto está automatizado

[detalles de automatización →](./docs/automation.md)

---

## herramientas que construí de estos patrones

todas salieron de vivir en Claude Code cada día. cada una resuelve un problema específico que seguía encontrando.

- **[lore](./plugins/lore/)** · extracción de sesiones a sqlite. costos, búsqueda, memoria de errores, detección de patrones
- **[claudemon](https://github.com/anipotts/claudemon)** · monitoreo de sesiones en tiempo real entre proyectos y máquinas
- **[cc](./plugins/cc/)** · conciencia multi-sesión. mirá qué hacen otras sesiones, enviá mensajes entre ellas
- **[imessage-mcp](https://github.com/anipotts/imessage-mcp)** · servidor MCP para historial de iMessage de solo lectura. 26 herramientas, cero solicitudes de red

## más de mí

- [anipotts.com/thoughts](https://anipotts.com/thoughts) · formato largo
- [buttondown.com/anipotts](https://buttondown.com/anipotts) · newsletter
- [@anipottsbuilds](https://instagram.com/anipottsbuilds) · formato corto

---

MIT · construido por [anipotts](https://anipotts.com)

<!-- translated from README.md @ 62df0ee -->
