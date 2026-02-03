# Implementation Plan: Budget Health Suite Integration

**Branch**: `001-budget-health-suite` | **Date**: 2026-02-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-budget-health-suite/spec.md`

## Summary

Integrate the finfocus v0.2.5 budget health suite to provide comprehensive budget tracking, health scoring, and forecasting in PR comments. The implementation extends existing budget infrastructure with new CLI integration (`finfocus budget status`), enhanced PR comment formatting, new action inputs/outputs, and health-based guardrails.

## Technical Context

**Language/Version**: TypeScript 5.9+ (ES2022 target, NodeNext module resolution)
**Primary Dependencies**: @actions/core ^2.0.2, @actions/exec ^2.0.0, @actions/github ^7.0.0, @actions/tool-cache ^3.0.0
**Storage**: N/A (stateless action)
**Testing**: Jest 30 with esbuild-jest transform
**Target Platform**: Linux (GitHub Actions runners), Node.js runtime
**Project Type**: Single project (GitHub Action)
**Performance Goals**: Action execution within existing time budget (<60s typical)
**Constraints**: Must maintain backward compatibility with finfocus <0.2.5
**Scale/Scope**: Single action, ~9 source files, targeting incremental enhancement

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality | ✅ Pass | Will follow existing patterns in codebase |
| II. Testing Standards | ✅ Pass | Unit tests for health calculation, integration tests for CLI |
| III. UX Consistency | ✅ Pass | Follows existing PR comment format, "Batteries Included" defaults |
| IV. Performance | ✅ Pass | Single additional CLI call, minimal overhead |
| V. Documentation | ✅ Pass | README update, action.yml documentation required |

**Pre-Design Gate**: PASSED

## Project Structure

### Documentation (this feature)

```text
specs/001-budget-health-suite/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (N/A - no external API)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── main.ts              # Entry point - add budget health orchestration
├── types.ts             # Add BudgetHealthReport interface
├── analyze.ts           # Add runBudgetStatus() method
├── formatter.ts         # Enhance formatBudgetSection() for health metrics
├── guardrails.ts        # Add checkBudgetHealthThreshold()
├── install.ts           # Existing - supports version detection
├── config.ts            # Existing - budget config already present
├── comment.ts           # Existing - passes budget data to formatter
└── plugins.ts           # Existing - no changes

__tests__/
├── unit/
│   ├── budget-health.test.ts    # NEW: Health score calculation tests
│   ├── formatter.test.ts        # Extend for budget health section
│   └── guardrails.test.ts       # Extend for health threshold tests
└── integration/
    └── budget-health.test.ts    # NEW: End-to-end budget health flow

action.yml                       # Add new inputs/outputs
README.md                        # Document budget health features
```

**Structure Decision**: Single project structure maintained. Changes are additive to existing files with one new test file for budget health unit tests.

## Complexity Tracking

> No Constitution violations requiring justification.

| Aspect | Complexity | Justification |
|--------|------------|---------------|
| New CLI command | Low | Follows existing `runAnalysis()` pattern |
| Interface extension | Low | Extends existing `BudgetStatus` interface |
| Formatter enhancement | Low | Extends existing `formatBudgetSection()` |
| Version detection | Already exists | `supportsExitCodes()` in install.ts |

## Post-Design Constitution Check

*Re-evaluated after Phase 1 design completion.*

| Principle | Status | Verification |
|-----------|--------|--------------|
| I. Code Quality | ✅ Pass | Design follows existing patterns, no TODOs/stubs |
| II. Testing Standards | ✅ Pass | Unit + integration tests specified in structure |
| III. UX Consistency | ✅ Pass | TUI box format consistent, defaults follow "Batteries Included" |
| IV. Performance | ✅ Pass | Single CLI call, graceful degradation for old versions |
| V. Documentation | ✅ Pass | action.yml updates, README updates, quickstart.md created |

**Post-Design Gate**: PASSED

## Generated Artifacts

| Artifact | Path | Description |
|----------|------|-------------|
| Research | [research.md](./research.md) | Decision log for unknowns |
| Data Model | [data-model.md](./data-model.md) | Interface definitions |
| Quickstart | [quickstart.md](./quickstart.md) | Implementation guide |
| Contracts | [contracts/](./contracts/) | Action interface contract |

## Next Steps

Run `/speckit.tasks` to generate implementation tasks from this plan.
