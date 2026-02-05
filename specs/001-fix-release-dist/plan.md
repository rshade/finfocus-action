# Implementation Plan: Fix Release-Please Changelog Duplication and Dist Build Timing

**Branch**: `001-fix-release-dist` | **Date**: 2026-02-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-fix-release-dist/spec.md`

## Summary

Fix the release workflow to prevent changelog duplication caused by orphaned release tags. The current `build-and-tag` job creates a new commit on the release tag after merge, resulting in tags that point to commits outside main's history. This breaks release-please's ability to calculate changelogs correctly.

**Solution**: Restructure the workflow to build and commit `dist/` to the release PR branch *before* merge, not after. Use `prs_created` output to detect when a release PR exists and update it with dist/ changes. Remove the post-release tag manipulation that creates orphaned commits.

## Technical Context

**Language/Version**: GitHub Actions YAML + Bash
**Primary Dependencies**: googleapis/release-please-action@v4, actions/checkout@v6, actions/setup-node@v6
**Storage**: N/A
**Testing**: Manual workflow validation (no unit tests for YAML workflows)
**Target Platform**: GitHub Actions runners (ubuntu-latest)
**Project Type**: CI/CD workflow configuration
**Performance Goals**: N/A (CI workflow, not runtime code)
**Constraints**: Must use PAT for workflow trigger permissions; must maintain floating tags
**Scale/Scope**: Single workflow file modification

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality & Standards | ✅ PASS | YAML follows GitHub Actions best practices; no TODOs or stubs |
| II. Testing Standards | ⚠️ N/A | Workflow YAML cannot have unit tests; validation is manual |
| III. User Experience Consistency | ✅ PASS | No user-facing interface changes; floating tags preserved |
| IV. Performance Requirements | ✅ PASS | CI workflow; no runtime performance impact |
| V. Documentation Discipline | ✅ PASS | Will update README if workflow behavior changes |

**Gate Status**: PASSED - All applicable principles satisfied.

## Project Structure

### Documentation (this feature)

```text
specs/001-fix-release-dist/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # N/A (no data model)
├── quickstart.md        # N/A (CI workflow)
├── contracts/           # N/A (no API)
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
.github/workflows/
└── release-please.yml   # Modified workflow file (single file change)
```

**Structure Decision**: This is a CI/CD configuration change affecting only `.github/workflows/release-please.yml`. No application source code changes required.

## Complexity Tracking

No Constitution violations requiring justification.
