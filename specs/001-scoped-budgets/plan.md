# Implementation Plan: Scoped Budgets (Per-Provider, Per-Type, Per-Tag)

**Branch**: `001-scoped-budgets` | **Date**: 2026-02-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-scoped-budgets/spec.md`

## Summary

Implement scoped budget support for finfocus-action, enabling users to define granular budget limits per cloud provider (AWS, GCP, Azure), resource type (compute, storage, networking), or cost allocation tag (env:prod, team:platform). The feature extends the existing budget health suite by parsing a new `budget-scopes` YAML input, generating finfocus configuration with `budget.scopes`, displaying a consolidated "Budget Status by Scope" table in PR comments, and outputting scope status for downstream automation.

## Technical Context

**Language/Version**: TypeScript 5.9+ (ES2022 target, NodeNext module resolution)
**Primary Dependencies**: @actions/core ^2.0.2, @actions/exec ^2.0.0, @actions/github ^7.0.0, @actions/tool-cache ^3.0.0
**Storage**: N/A (stateless action - config written to ~/.finfocus/config.yaml)
**Testing**: Jest with esbuild-jest transform
**Target Platform**: GitHub Actions runner (Linux, Windows, macOS)
**Project Type**: Single project (GitHub Action)
**Performance Goals**: Process up to 20 scopes within action timeout; PR comment renders correctly
**Constraints**: finfocus CLI v0.2.6+ required when scopes configured; backward compatible with global budget
**Scale/Scope**: Up to 20 scoped budgets per workflow (soft limit with warning)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence/Notes |
|-----------|--------|----------------|
| I. Code Quality & Standards | ✅ PASS | Extends existing patterns (types.ts, config.ts, analyze.ts); no TODOs or stubs permitted |
| II. Testing Standards | ✅ PASS | Unit tests required for parser, formatter, guardrails; integration tests for CLI interaction |
| III. User Experience Consistency | ✅ PASS | Consistent table format matching existing budget health display; visual indicators (🟢🟡🔴⛔) |
| IV. Performance Requirements | ✅ PASS | Soft limit at 20 scopes with warning; single CLI call for scope status |
| V. Documentation Discipline | ✅ PASS | README.md update required; action.yml inputs documented |

**Gate Result**: PASS - No violations. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/001-scoped-budgets/
├── plan.md              # This file
├── spec.md              # Feature specification (complete)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (finfocus CLI contract)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── types.ts             # Add: BudgetScope, ScopedBudgetStatus, ScopedBudgetReport
├── config.ts            # Extend: generateYaml() for budget.scopes section
├── analyze.ts           # Add: runScopedBudgetStatus(), parseScopedBudgetResponse()
├── formatter.ts         # Add: formatScopedBudgetSection() table renderer
├── guardrails.ts        # Add: checkScopedBudgetBreach()
├── main.ts              # Extend: parse budget-scopes input, orchestrate scope checks
├── comment.ts           # No changes (uses existing upsertComment)
├── install.ts           # Extend: version check for v0.2.6+ requirement
└── plugins.ts           # No changes

__tests__/
├── unit/
│   ├── scoped-budgets.test.ts      # NEW: Parser, config generation tests
│   ├── scoped-budget-format.test.ts # NEW: Formatter table tests
│   └── scoped-budget-guardrails.test.ts # NEW: Threshold check tests
└── integration/
    └── scoped-budgets.test.ts       # NEW: End-to-end scope workflow

action.yml               # Add: budget-scopes, fail-on-budget-scope-breach inputs/outputs
```

**Structure Decision**: Single project structure - extends existing GitHub Action without architectural changes.

## Complexity Tracking

> No violations to justify. Design follows existing patterns.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |

## Constitution Check (Post-Design)

*Re-evaluation after Phase 1 design artifacts completed.*

| Principle | Status | Evidence/Notes |
|-----------|--------|----------------|
| I. Code Quality & Standards | ✅ PASS | Data model uses TypeScript interfaces extending existing patterns; no stubs |
| II. Testing Standards | ✅ PASS | Test file structure defined; unit tests for each new component |
| III. User Experience Consistency | ✅ PASS | Quickstart shows consistent UX with existing features; visual indicators match |
| IV. Performance Requirements | ✅ PASS | CLI contract defines single call for all scopes; soft limit documented |
| V. Documentation Discipline | ✅ PASS | Quickstart ready; contracts documented; README update task required |

**Post-Design Gate Result**: PASS - Design artifacts complete and constitution-compliant.

## Generated Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Implementation Plan | `specs/001-scoped-budgets/plan.md` | ✅ Complete |
| Research | `specs/001-scoped-budgets/research.md` | ✅ Complete |
| Data Model | `specs/001-scoped-budgets/data-model.md` | ✅ Complete |
| CLI Contract | `specs/001-scoped-budgets/contracts/finfocus-cli.md` | ✅ Complete |
| Quickstart | `specs/001-scoped-budgets/quickstart.md` | ✅ Complete |
| Tasks | `specs/001-scoped-budgets/tasks.md` | ✅ Complete |

## Next Steps

Run `/speckit.tasks` to generate the task breakdown for implementation.
