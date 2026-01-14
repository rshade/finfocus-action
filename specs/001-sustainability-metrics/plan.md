# Implementation Plan: Sustainability Metrics (GreenOps)

**Branch**: `001-sustainability-metrics` | **Date**: 2026-01-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-sustainability-metrics/spec.md`

## Summary

Implement support for `pulumicost` sustainability metrics (GreenOps) by adding new action inputs, extracting carbon data from the JSON report, calculating environmental equivalents (trees, miles, electricity), and displaying a "Sustainability Impact" section in the PR comment. Includes a fail-safe threshold for carbon increases.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20
**Primary Dependencies**: `@actions/core`, `@actions/exec`
**Storage**: N/A (Stateless action)
**Testing**: Jest (Unit/Integration)
**Target Platform**: GitHub Actions (Linux runner)
**Project Type**: Single project (CLI Action)
**Performance Goals**: Minimal overhead (<2s added processing time).
**Constraints**: Must handle missing sustainability data gracefully.
**Scale/Scope**: Processes standard Pulumi plan JSONs.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Code Quality**: Changes will follow existing TS patterns.
- [x] **Testing**: Unit tests for equivalency formulas and threshold logic.
- [x] **UX Consistency**: New comment section matches existing style (tables, headers).
- [x] **Performance**: Parsing is synchronous and fast; no heavy compute.
- [x] **Documentation**: `README.md` and `docs/` will be updated. Technical writer task included.

## Project Structure

### Documentation (this feature)

```text
specs/001-sustainability-metrics/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── sustainability.ts
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
src/
├── types.ts             # Update interfaces (PulumicostResource, ActionConfiguration)
├── analyze.ts           # Update Analyzer to parse sustainability data & pass flags
├── formatter.ts         # Add formatSustainabilitySection logic
├── comment.ts           # Update comment assembly
├── guardrails.ts        # Add carbon threshold logic
└── main.ts              # Wire up new inputs

__tests__/
├── unit/
│   ├── formatter.test.ts # Test equivalency calc & formatting
│   └── guardrails.test.ts # Test carbon threshold
```

**Structure Decision**: Extending existing single-project structure.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |