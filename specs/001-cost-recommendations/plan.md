# Implementation Plan: Cost Optimization Recommendations

**Branch**: `001-cost-recommendations` | **Date**: 2026-01-12 | **Spec**: specs/001-cost-recommendations/spec.md
**Input**: Feature specification from `/specs/001-cost-recommendations/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add support for displaying cost optimization recommendations from `pulumicost cost recommendations` in PR comments alongside existing cost estimates. Technical approach: Extend the GitHub Action to optionally run `pulumicost cost recommendations`, parse the JSON output, and format recommendations in the PR comment with savings details.

## Technical Context

**Language/Version**: Go (latest stable)  
**Primary Dependencies**: @actions/core, @actions/github, @actions/exec, pulumicost CLI  
**Storage**: N/A (no persistent storage required)  
**Testing**: Jest for unit tests, integration tests via GitHub Actions workflow  
**Target Platform**: GitHub Actions runner (Linux)  
**Project Type**: GitHub Action (single project)  
**Performance Goals**: PR comments display within 30 seconds of action completion  
**Constraints**: Handle up to 50 recommendations gracefully, command execution under 20 seconds, no external API calls beyond pulumicost  
**Scale/Scope**: Single PR processing, recommendations count variable (0-50+), output size manageable in PR comments

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- Code Quality & Standards: Plan uses idiomatic Go, follows existing patterns in codebase, no TODOs or stubs planned.
- Testing Standards: Unit tests for new logic, integration tests for PR comment generation.
- User Experience Consistency: PR comment format consistent with existing cost estimates, clear error handling.
- Performance Requirements: Command execution optimized, performance goals met.
- Documentation Discipline: README updated with new input/output.
- Technology Stack: Uses Go and GitHub Actions toolkit as per constitution.
- Workflow & Review: Feature branch created, PR will include description and rationale.

**Status**: PASS - No violations detected.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── types.ts          # Add RecommendationsReport interface
├── analyze.ts        # Add runRecommendations method
├── main.ts           # Add recommendations logic
├── formatter.ts      # Add recommendations formatting
└── [existing files]

__tests__/
├── unit/
│   ├── analyze.test.ts    # Add recommendations tests
│   └── formatter.test.ts  # Add formatting tests
└── integration/
    └── [existing integration tests]
```

**Structure Decision**: Single project structure selected as this is a GitHub Action extension. New functionality integrated into existing src/ directory following current patterns. Tests added to **tests**/unit/ and **tests**/integration/.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |
