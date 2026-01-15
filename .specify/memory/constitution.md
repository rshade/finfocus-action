<!--
Sync Impact Report:
- Version: 1.3.0 → 1.4.0
- Principles Modified:
  - User Experience Consistency: Added "Batteries Included" defaults principle (optional features must default to 'true').
- Added sections: None
- Removed sections: None
- Templates requiring updates: ✅ checked (none required)
- Follow-up TODOs: None
-->

# finfocus-action Constitution

## Core Principles

### I. Code Quality & Standards

Code MUST be idiomatic, readable, and maintainable. Adhere strictly to language-specific best practices (e.g., Go formatting, linting). Comments should explain 'why', not 'what', and be used sparingly where code is self-explanatory. Complexity should be minimized; prefer simple, explicit logic over clever, obscure solutions. Creating TODOs or stubs in the code is strictly forbidden; all tasks must be fully implemented to be considered complete.

### II. Testing Standards

Comprehensive test coverage is MANDATORY. Unit tests MUST cover business logic, while integration tests MUST verify workflows. Tests must be reliable, deterministic, and independent. Test-Driven Development (TDD) is encouraged. Code without tests is considered broken.

### III. User Experience Consistency

Interfaces (whether CLI or API) MUST be predictable, intuitive, and consistent. Output formats must be uniform across commands/endpoints. Error messages MUST be actionable, clear, and distinct from standard output. Avoid exposing internal implementation details to the user.

Adopt "Batteries Included" defaults: Optional features MUST default to 'true' (opt-out) to maximize discoverability and immediate utility, unless they incur significant cost or risk.

### IV. Performance Requirements

Code MUST be optimized for execution speed and resource efficiency. Critical paths MUST be profiled and optimized. Avoid unnecessary allocations, blocking operations, or O(n^2) algorithms where better alternatives exist. Performance regressions are treated as bugs.

### V. Documentation Discipline

Documentation is a first-class citizen. `README.md` and `docs/` (if present) MUST be updated synchronously with code changes to reflect full technical criteria. API changes require immediate documentation updates. Documentation MUST be clear, concise, and up-to-date with the current state of the codebase. With each new specification or spec update, both Standard Configuration (PR Commenter) and Analyzer Mode documentation MUST be synchronized. Every implementation plan MUST include specific tasks for "doc generation by a technical writer" and a formal "documentation review loop" to ensure accuracy and completeness.

## Technology Stack & Constraints

**Primary Language**: TypeScript / Node.js (implied by repository structure).
**Environment**: Linux compatibility is required.
**Dependency Management**: Use standard modules (e.g., `npm` / `package.json`).
**Security**: No secrets in code. Input validation is mandatory for all external data.

## Workflow & Review

**Development**: All changes require a feature branch and a pull request.
**Quality Gates**: CI/CD pipelines (linting, testing, building) MUST pass before merging.
**Review**: Pull requests MUST include a description of changes and rationale. Code reviews should verify adherence to this Constitution.

## Governance

This Constitution governs all development within the `finfocus-action` project. Amendments require a formal version bump, documented rationale, and team consensus. All pull requests and code reviews MUST verify compliance with these principles.

**Version**: 1.4.0 | **Ratified**: 2026-01-08 | **Last Amended**: 2026-01-14