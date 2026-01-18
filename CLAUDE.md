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
| `analyze.ts` | `Analyzer` | Runs `finfocus cost projected`, `recommendations`, `actual` commands; calculates sustainability metrics |
| `comment.ts` | `Commenter` | Upserts PR comments with marker `<!-- finfocus-action-comment -->` |
| `formatter.ts` | — | Formats markdown tables for cost, recommendations, sustainability, actual costs |
| `guardrails.ts` | — | Threshold checking for cost (`100USD`) and carbon (`10kg`, `10%`) guardrails |
| `types.ts` | — | All TypeScript interfaces (`ActionConfiguration`, `FinfocusReport`, etc.) |

### Data Flow

```
main.ts
  └─> Installer.install()           # Download/cache finfocus binary
  └─> PluginManager.installPlugins() # Optional plugin installation
  └─> [Analyzer Mode Branch]
  │     └─> Analyzer.setupAnalyzerMode()  # Creates policy pack, sets PULUMI_POLICY_PACK
  └─> [Standard Mode Branch]
        └─> Analyzer.runAnalysis()        # finfocus cost projected
        └─> Analyzer.calculateSustainabilityMetrics()
        └─> Analyzer.runRecommendations() # finfocus cost recommendations
        └─> Analyzer.runActualCosts()     # finfocus cost actual
        └─> Commenter.upsertComment()     # GitHub API
        └─> checkThreshold() / checkCarbonThreshold()  # Guardrails
```

### Key Interfaces (types.ts)

- `ActionConfiguration`: All action inputs parsed from `core.getInput()`
- `FinfocusReport`: Cost analysis output with `summary`, `resources`, `diff`
- `RecommendationsReport`: Cost optimization suggestions
- `ActualCostReport`: Historical cost data
- `SustainabilityReport`: Carbon footprint metrics (kgCO2e)

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
