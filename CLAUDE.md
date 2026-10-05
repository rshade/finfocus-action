# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build, Lint, and Test Commands

```bash
npm run build        # Build action into dist/ using ncc
npm run lint         # Lint TypeScript files with ESLint
npm run format       # Format with Prettier
npm test             # Run all tests with Jest
npm test -- __tests__/unit/analyze.test.ts  # Run single test file
npm test -- --testNamePattern="pattern"     # Run matching tests
npm test -- --coverage                      # With coverage report
```

## Project Overview

finfocus-action is a GitHub Action that integrates [finfocus](https://github.com/rshade/finfocus)
into CI/CD workflows. It posts cloud cost estimates and carbon footprint metrics to Pull Requests.

### Two Operational Modes

1. **Standard Mode** (default): Parses a Pulumi plan JSON, runs cost analysis via finfocus CLI, and
   posts a PR comment
2. **Analyzer Mode** (`analyzer-mode: true`): Sets up finfocus as a Pulumi policy analyzer for
   `pulumi preview` integration

## Architecture

The action is a TypeScript ES module project using the GitHub Actions toolkit. It's compiled with
`@vercel/ncc` into `dist/index.js` and runs as a composite action.

### Core Components (`src/`)

| File | Class | Responsibility |
|------|-------|----------------|
| `main.ts` | — | Entry point, config parsing, orchestration |
| `install.ts` | `Installer` | Downloads finfocus binary from GitHub releases, caches with `@actions/tool-cache` |
| `plugins.ts` | `PluginManager` | Installs finfocus plugins via CLI. Names are checked against `plugin list --available`; `kubernetes` and `jev` are registry names |
| `plugin-specs.ts` | — | Parses registry and `github.com/owner/repo` plugin specifiers |
| `v04.ts` | — | `cost cluster`, Jev scoring flags, dismiss/snooze, `overview --state-only`, Supports() decline notes |
| `config.ts` | `ConfigManager` | Creates `~/.finfocus/config.yaml` with budget configuration |
| `analyze.ts` | `Analyzer` | Runs `finfocus cost projected` (with `--pulumi-json` or `--terraform-state`), `recommendations`, `actual`, `estimate`, `cost cluster`, and `overview --state-only`; calculates sustainability metrics and budget status |
| `comment.ts` | `Commenter` | Upserts PR comments with marker `<!-- finfocus-action-comment -->` |
| `display.ts` | — | Resource filters (`--filter`), comment grouping, min cost, display cap, change-only rows |
| `formatter.ts` | — | Formats markdown tables for cost, recommendations, sustainability, actual costs, budget status |
| `guardrails.ts` | — | Threshold checking for cost (`100USD`) and carbon (`10kg`, `10%`) guardrails; budget threshold checks via `--exit-on-threshold --exit-code 10` (action-owned code) |
| `types.ts` | — | All TypeScript interfaces (`ActionConfiguration`, `FinfocusReport`, `BudgetStatus`, etc.) |

### Data Flow

```text
main.ts
  └─> Installer.install()           # Download/cache finfocus binary
  └─> PluginManager.installPlugins() # Optional plugin installation
  └─> ConfigManager.writeConfig()   # Optional: create budget config.yaml
  └─> ConfigManager.writeScoringConfig() # Optional: scoring.plugin jev
  └─> [Analyzer Mode Branch]
  │     └─> Analyzer.setupAnalyzerMode()  # Creates policy pack, sets PULUMI_POLICY_PACK
  └─> [Standard Mode Branch]
        └─> Analyzer.runStateOnly()       # optional: finfocus overview --state-only
        └─> Analyzer.runAnalysis()        # finfocus cost projected (skipped when state-only and no plan)
        └─> Analyzer.calculateSustainabilityMetrics()
        └─> Analyzer.runCluster()         # optional: finfocus cost cluster (kubernetes plugin)
        └─> Analyzer.applyRecommendationLifecycle() # optional dismiss/snooze
        └─> Analyzer.runRecommendations() # finfocus cost recommendations (--no-scoring unless Jev is enabled)
        └─> Analyzer.runEstimate()        # finfocus cost estimate (opt-in via estimate-spec)
        └─> Analyzer.runActualCosts()     # finfocus cost actual
        └─> Analyzer.calculateBudgetStatus() # Local budget math (no CLI call)
        └─> Analyzer.extractBudgetStatus() # Optional: extract budget info from output
        └─> Commenter.upsertComment()     # GitHub API (includes budget status)
        └─> checkBudgetThreshold()  # Guardrails (runs cost projected with --exit-on-threshold --exit-code 10, JSON fallback for older)
```

### Key Interfaces (types.ts)

- `ActionConfiguration`: All action inputs parsed from `core.getInput()`, including budget options
- `FinfocusReport`: Cost analysis output with `summary`, `resources`, `diff`
- `RecommendationsReport`: Cost optimization suggestions
- `ActualCostReport`: Historical cost data
- `SustainabilityReport`: Carbon footprint metrics (kgCO2e)
- `BudgetConfiguration`: Budget settings with amount, currency, period, and alerts
- `BudgetStatus`: Current budget status with spent, remaining, percent used, and triggered alerts
- `BudgetAlert`: Individual budget alert with threshold and type
- `BudgetExitCode`: Enum for threshold check exit codes (0=pass, 10=threshold breached; 10 is
  action-owned via `--exit-code`, finfocus v0.4.0 reserves 1=internal_error and 2=validation_error)
- `BudgetThresholdResult`: Result of budget threshold check with severity and message
- `EstimateSpec`/`EstimateReport`: What-if single-resource estimate input and output
  (`finfocus cost estimate`, v0.4.0; plan-based `--modify` not exposed)

## Code Conventions

### Imports

- ES module imports with `.js` extensions (NodeNext resolution)
- Namespace imports for external packages: `import * as core from '@actions/core'`
- Named imports for local: `import { Analyzer } from './analyze.js'`

### Naming

- Classes: `PascalCase` (Analyzer, Commenter)
- Interfaces: `PascalCase` with `I` prefix (IAnalyzer, ICommenter)
- Files: kebab-case (analyze.ts, comment.ts)

### Error Handling

- Use `try-catch` for async operations
- Check `error instanceof Error` before accessing properties
- Use `core.setFailed()` for fatal errors, `core.warning()` for non-fatal

### Testing

- Jest with esbuild-jest transform
- Unit tests: `__tests__/unit/*.test.ts`
- Integration tests: `__tests__/integration/*.test.ts`
- Mock external deps with `jest.mock()`, reset with `jest.clearAllMocks()` in `beforeEach()`

## Important Notes

- The `dist/` folder is committed and must be rebuilt with `npm ci` and `npm run build` in that worktree before committing changes. Use the `@vercel/ncc` version in the lockfile (0.45.0). A stale `node_modules` (for example 0.38.4), or a symlink to another checkout's `node_modules`, changes webpack module ids including the async chunk number and fails the Check dist workflow. ncc leaves old chunks in place, so do not delete them unless a following rebuild diff is empty.
- The finfocus contract job must pass `GITHUB_TOKEN` into `scripts/contract.sh`. `plugin install` reads that variable. `GH_TOKEN` is only for the `gh` CLI download step. Without `GITHUB_TOKEN`, the unauthenticated rate limit fails the v0.4.0 aws-public install and the budget breach check exits 0.
- PR comments use a marker (`<!-- finfocus-action-comment -->`) for upsert behavior
- Sustainability metrics are calculated from resource-level `sustainability.carbon_footprint` data
  in the finfocus report
- The analyzer mode creates a Pulumi policy pack at `~/.finfocus/analyzer/` with a binary named `pulumi-analyzer-policy-finfocus`
- Budget tracking is opt-in: ConfigManager only runs when `budget-amount` is provided
- Budget configuration is written as `cost.budgets.global` in `~/.finfocus/config.yaml` (the
  scoped schema finfocus v0.4.0 reads; a top-level `budget:` key is ignored)
- finfocus v0.4.0 has no `budget status` command; budget health and scoped-budget features were
  removed. Budget enforcement works via `--exit-on-threshold --exit-code 10` (action-owned)
- Budget status extraction returns undefined when using `--output json` (forward compatible for
  future finfocus CLI support)
- **JSON format compatibility**: finfocus v0.2.4+ wraps JSON output in a `"finfocus"` key. The
  action handles both wrapped and unwrapped formats for backward compatibility (see
  `src/analyze.ts:131`)
- **Exit code support**: for budget thresholds the action runs `finfocus cost projected
  --pulumi-json <plan> --exit-on-threshold --exit-code 10`. Exit 10 is action-owned; finfocus v0.4.0
  exits 1 (`internal_error`) or 2 (`validation_error`) on failures, and the action surfaces the
  error envelope `message` for those. The action auto-detects version and falls back to JSON parsing
  for versions < 0.2.5.
- **finfocus v0.4.3** is the latest GitHub release checked for issue #89 (published
  2026-10-05). `scripts/contract.sh` passes against the official v0.4.0 and v0.4.3 release
  binaries. Do not verify flags against the sibling finfocus checkout when that tree is a
  dirty feature branch. v0.4.3 `cost projected` JSON adds `diff` and `errors` under
  `.finfocus`; those keys are additive. `--state-only` exists on `finfocus overview` only.
  It is not a `cost projected` flag. `cost cluster --group-by` accepts `namespace`,
  `controller`, `pod`, `node`, `pulumi-stack`, and `label:<key>`.
- Jev scoring is opt-in. When `enable-jev-scoring` is false, `cost recommendations` runs
  with `--no-scoring`. When it is true, the action writes `scoring.enabled: true` and
  `scoring.plugin: jev` and omits `--no-scoring`. `TYPESAFE_API_KEY` stays an environment
  variable. Scores do not dismiss recommendations.
- Dismissals: the action does not pass `--include-dismissed` unless asked, and it drops
  recommendations with status `Dismissed` or `Snoozed`. `dismiss-recommendations` and
  `snooze-recommendations` run `cost recommendations dismiss|snooze --force` first.
- Supports() decline reasons are the `notes` text `(declined by <plugin>: <reason>)` on a
  resource. They are not the report `errors` array.
- Resource filters are finfocus `--filter` expressions (`type=ec2` is a case-insensitive
  substring, `tag:env=prod` matches plan tags). They are passed to `cost projected`, `cost
  actual`, and the budget threshold check. `*` is not a wildcard. Comment `group-by`
  (`resource`, `type`, `provider`, `service`, `tag:<key>`) is action-side. `cost projected`
  has no `--group-by`. `min-cost-threshold`, `max-resources-displayed`, `sort-by`, and
  `show-only-changes` change the comment only. The projected monthly total stays the CLI total.
- Do not implement pagination, NDJSON, or cost forecasting while issues #49, #21, and #19
  are still open for re-evaluation. Those overlap #89 and were left out on purpose.

## Active Technologies

- TypeScript 5.9+ (ES2022 target, NodeNext module resolution) + @actions/core ^2.0.2, @actions/exec
  ^2.0.0, @actions/github ^7.0.0, @actions/tool-cache ^3.0.0 (001-budget-health-suite)
- N/A (stateless action) (001-budget-health-suite)
- N/A (stateless action - config written to ~/.finfocus/config.yaml) (001-scoped-budgets)
- GitHub Actions YAML + Bash + googleapis/release-please-action@v4, actions/checkout@v6,
  actions/setup-node@v6 (001-fix-release-dist)

- TypeScript 5.9+ (ES modules) + @actions/core, @actions/exec (for running finfocus CLI)

## Recent Changes

- 001-budget-health-suite: Implemented comprehensive budget health suite integration for finfocus v0.2.5+:
  - Added `BudgetHealthStatus` type, `BudgetHealthReport` and `FinfocusBudgetStatusResponse` interfaces
  - Added `runBudgetStatus()` method to Analyzer with fallback for older versions
  - Added `formatBudgetHealthSection()` to formatter with visual health indicators (🟢/🟡/🔴/⛔)
  - Added `checkBudgetHealthThreshold()` to guardrails for fail-on-budget-health
  - New action inputs: budget-alert-threshold, fail-on-budget-health, show-budget-forecast
  - New action outputs: budget-health-score, budget-forecast, budget-runway-days, budget-status
  - TUI box display with progress bar and runway information

- 001-guardrails-exit-codes: Implemented budget threshold checking with finfocus exit codes
  (v0.2.5+). Added `BudgetExitCode` enum, `BudgetThresholdResult` interface,
  `checkBudgetThreshold()` orchestrator, and backward-compatible JSON fallback for older versions.

- 001-scoped-budgets: Implemented scoped budget support for finfocus v0.2.6+:
  - Added `BudgetScopeType`, `BudgetScope`, `ScopedBudgetStatus`, `ScopedBudgetAlert`,
    `ScopedBudgetReport`, `ScopedBudgetFailure`, `FinfocusScopedBudgetResponse`,
    `FinfocusScopeEntry` types
  - Added `parseBudgetScopes()` function in config.ts for YAML multiline input parsing
  - Extended `generateYaml()` to include `budget.scopes` section
  - Added `runScopedBudgetStatus()` and `parseScopedBudgetResponse()` to Analyzer
  - Added `formatScopedBudgetSection()` and `getScopeStatusIcon()` to formatter
  - Added `checkScopedBudgetBreach()` to guardrails for fail-on-budget-scope-breach
  - New action inputs: budget-scopes, fail-on-budget-scope-breach
  - New action output: budget-scopes-status
  - Version check fails action if scopes configured but CLI < v0.2.6
  - Soft limit warning at >20 scopes
