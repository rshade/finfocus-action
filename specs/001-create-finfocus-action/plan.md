# Implementation Plan: Create finfocus-action GitHub Action

**Branch**: `001-create-finfocus-action` | **Date**: 2026-01-08 | **Spec**: [spec.md](./spec.md)

## Summary

Implement `finfocus-action`, a TypeScript-based GitHub Composite Action that wraps the `finfocus` binary. The action will provide automated cloud cost estimates in PR comments and enforce budget guardrails. Technical approach involves using `@actions/tool-cache` for binary management and the GitHub API for sticky PR comments.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20
**Primary Dependencies**: `@actions/core`, `@actions/exec`, `@actions/github`, `@actions/tool-cache`, `jest`
**Storage**: N/A (Temporary files for report JSON)
**Testing**: Jest (Unit), GitHub Actions Integration Workflows
**Target Platform**: GitHub Actions (Linux, macOS, Windows)
**Project Type**: GitHub Action (Node.js/Composite)
**Performance Goals**: Action execution (excluding tool download) < 1 minute.
**Constraints**: Must run cross-platform; Must handle GitHub API rate limits for comments.
**Scale/Scope**: Supports any Pulumi project capable of generating a JSON plan.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Idiomatic Code**: Using TypeScript for a GitHub Action is the idiomatic standard, despite the project's general preference for Go (see Complexity Tracking).
- [x] **Comprehensive Testing**: Plan includes unit tests for all logic components and integration tests in CI.
- [x] **Consistent UX**: Sticky comments and standard action inputs/outputs follow established patterns.
- [x] **Performance**: Composite action avoids Docker startup overhead.
- [x] **Documentation**: `README.md` and `action.yml` updates are part of the core tasks.

## Project Structure

### Documentation (this feature)

```text
specs/001-create-finfocus-action/
├── plan.md              # This file
├── research.md          # Research on TS vs Go and architecture
├── data-model.md        # Input/Output and Report interfaces
├── quickstart.md        # Usage examples
├── contracts/           # Internal service interfaces
└── tasks.md             # Implementation tasks
```

### Source Code (repository root)

```text
src/
├── main.ts              # Action entry point
├── install.ts           # Binary downloader/cache logic
├── plugins.ts           # Finfocus plugin management
├── comment.ts           # GitHub PR comment logic
└── analyze.ts           # Finfocus CLI wrapper logic

dist/                    # Compiled production assets

__tests__/               # Jest test suite
├── unit/
└── integration/

action.yml               # Action definition
package.json             # NPM dependencies
```

**Structure Decision**: Single project (Node.js) structure. Standard for TypeScript GitHub Actions to ensure simplicity and ease of distribution.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| TypeScript instead of Go | GitHub Actions native runtime is Node.js. | Using Go would require pre-compiled binaries for every platform or slower Docker containers, increasing maintenance and runtime latency. |