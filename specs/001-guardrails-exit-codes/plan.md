# Implementation Plan: Guardrails Exit Code Refactor

**Branch**: `001-guardrails-exit-codes` | **Date**: 2026-02-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-guardrails-exit-codes/spec.md`

## Summary

Refactor budget threshold enforcement in `guardrails.ts` to use finfocus CLI v0.2.5+ native exit codes (0=pass, 1=warning, 2=critical, 3=exceeded) instead of parsing JSON output. Maintain backward compatibility with older finfocus versions by falling back to the existing JSON parsing approach when version < 0.2.5.

## Technical Context

**Language/Version**: TypeScript 5.9+ (ES modules)
**Primary Dependencies**: @actions/core, @actions/exec (for running finfocus CLI)
**Storage**: N/A
**Testing**: Jest with esbuild-jest transform
**Target Platform**: GitHub Actions runners (Linux, macOS, Windows)
**Project Type**: Single project (GitHub Action)
**Performance Goals**: N/A (CI tool, not performance-critical)
**Constraints**: Must not break existing `fail-on-cost-increase` behavior
**Scale/Scope**: Single file refactor with new tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality & Standards | ✅ Pass | Refactor maintains idiomatic TypeScript; no TODOs or stubs |
| II. Testing Standards | ✅ Pass | New unit tests for exit code handling; existing tests preserved |
| III. User Experience Consistency | ✅ Pass | Clear error messages for each exit code; no change to inputs |
| IV. Performance Requirements | ✅ Pass | Exit code check faster than JSON parsing |
| V. Documentation Discipline | ✅ Pass | README update task included for new behavior |

**Gate Result**: PASS - No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/001-guardrails-exit-codes/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (minimal - internal types only)
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── guardrails.ts        # PRIMARY: Refactor checkBudgetThreshold()
├── install.ts           # Add getFinfocusVersion() helper
├── types.ts             # Add BudgetExitCode enum/type
└── main.ts              # Minor: update guardrails invocation

__tests__/
└── unit/
    └── guardrails.test.ts  # Add exit code test cases
```

**Structure Decision**: Single project structure - this is a GitHub Action with TypeScript source compiled by ncc. No new directories needed; changes are localized to existing files.

## Complexity Tracking

> No violations requiring justification.
