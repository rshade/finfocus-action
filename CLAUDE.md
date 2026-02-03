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

finfocus-action is a GitHub Action that integrates [finfocus](https://github.com/rshade/finfocus) into CI/CD workflows. It posts cloud cost estimates and carbon footprint metrics to Pull Requests.

### Two Operational Modes

1. **Standard Mode** (default): Parses a Pulumi plan JSON, runs cost analysis via finfocus CLI, and posts a PR comment
2. **Analyzer Mode** (`analyzer-mode: true`): Sets up finfocus as a Pulumi policy analyzer for `pulumi preview` integration

## Architecture

The action is a TypeScript ES module project using the GitHub Actions toolkit. It's compiled with `@vercel/ncc` into `dist/index.js` and runs as a composite action.

### Core Components (`src/`)

| File | Class | Responsibility |
|------|-------|----------------|
| `main.ts` | — | Entry point, config parsing, orchestration |
| `install.ts` | `Installer` | Downloads finfocus binary from GitHub releases, caches with `@actions/tool-cache` |
| `plugins.ts` | `PluginManager` | Installs finfocus plugins via CLI |
| `config.ts` | `ConfigManager` | Creates `~/.finfocus/config.yaml` with budget configuration |
| `analyze.ts` | `Analyzer` | Runs `finfocus cost projected`, `recommendations`, `actual`, `budget status` commands; calculates sustainability metrics; extracts budget status and health |
| `comment.ts` | `Commenter` | Upserts PR comments with marker `<!-- finfocus-action-comment -->` |
| `formatter.ts` | — | Formats markdown tables for cost, recommendations, sustainability, actual costs, budget status, budget health |
| `guardrails.ts` | — | Threshold checking for cost (`100USD`) and carbon (`10kg`, `10%`) guardrails; budget threshold checks with exit code support (v0.2.5+); budget health threshold checks |
| `types.ts` | — | All TypeScript interfaces (`ActionConfiguration`, `FinfocusReport`, `BudgetStatus`, etc.) |

### Data Flow

```text
main.ts
  └─> Installer.install()           # Download/cache finfocus binary
  └─> PluginManager.installPlugins() # Optional plugin installation
  └─> ConfigManager.writeConfig()   # Optional: create budget config.yaml
  └─> [Analyzer Mode Branch]
  │     └─> Analyzer.setupAnalyzerMode()  # Creates policy pack, sets PULUMI_POLICY_PACK
  └─> [Standard Mode Branch]
        └─> Analyzer.runAnalysis()        # finfocus cost projected
        └─> Analyzer.calculateSustainabilityMetrics()
        └─> Analyzer.runRecommendations() # finfocus cost recommendations
        └─> Analyzer.runActualCosts()     # finfocus cost actual
        └─> Analyzer.extractBudgetStatus() # Optional: extract budget info from output
        └─> Analyzer.runBudgetStatus()    # Optional: budget health (v0.2.5+)
        └─> Commenter.upsertComment()     # GitHub API (includes budget status and health)
        └─> checkBudgetThreshold()  # Guardrails (uses exit codes for v0.2.5+, JSON fallback for older)
        └─> checkBudgetHealthThreshold()  # Guardrails (fail if health score below threshold)
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
- `BudgetExitCode`: Enum for finfocus v0.2.5+ exit codes (0=pass, 1=warning, 2=critical, 3=exceeded)
- `BudgetThresholdResult`: Result of budget threshold check with severity and message
- `BudgetHealthStatus`: Type for health status levels ('healthy' | 'warning' | 'critical' | 'exceeded')
- `BudgetHealthReport`: Extended budget status with healthScore, forecast, forecastAmount, runwayDays
- `FinfocusBudgetStatusResponse`: Raw JSON response from finfocus budget status command

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

- The `dist/` folder is committed and must be rebuilt with `npm run build` before committing changes
- PR comments use a marker (`<!-- finfocus-action-comment -->`) for upsert behavior
- Sustainability metrics are calculated from resource-level `sustainability.carbon_footprint` data in the finfocus report
- The analyzer mode creates a Pulumi policy pack at `~/.finfocus/analyzer/` with a binary named `pulumi-analyzer-policy-finfocus`
- Budget tracking is opt-in: ConfigManager only runs when `budget-amount` is provided
- Budget configuration is written to `~/.finfocus/config.yaml` for finfocus CLI to read
- Budget status extraction returns undefined when using `--output json` (forward compatible for future finfocus CLI support)
- **JSON format compatibility**: finfocus v0.2.4+ wraps JSON output in a `"finfocus"` key. The action handles both wrapped and unwrapped formats for backward compatibility (see `src/analyze.ts:131`)
- **Exit code support**: finfocus v0.2.5+ returns exit codes for budget thresholds (0=pass, 1=warning, 2=critical, 3=exceeded). The action auto-detects version and falls back to JSON parsing for older versions.

## Active Technologies
- TypeScript 5.9+ (ES2022 target, NodeNext module resolution) + @actions/core ^2.0.2, @actions/exec ^2.0.0, @actions/github ^7.0.0, @actions/tool-cache ^3.0.0 (001-budget-health-suite)
- N/A (stateless action) (001-budget-health-suite)

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

- 001-guardrails-exit-codes: Implemented budget threshold checking with finfocus exit codes (v0.2.5+). Added `BudgetExitCode` enum, `BudgetThresholdResult` interface, `checkBudgetThreshold()` orchestrator, and backward-compatible JSON fallback for older versions.
