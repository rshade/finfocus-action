<!--
Sync Impact Report:
- Version: 1.0.0 (Initial Adoption)
- Principles Established:
  - Code Quality & Standards
  - Testing Standards
  - User Experience Consistency
  - Performance Requirements
  - Documentation Discipline
- Templates Checked: plan, spec, tasks (Compatible)
-->

# finfocus-action Constitution

## Core Principles

### I. Code Quality & Standards
Code MUST be idiomatic, readable, and maintainable. Adhere strictly to language-specific best practices (e.g., Go formatting, linting). Comments should explain 'why', not 'what', and be used sparingly where code is self-explanatory. Complexity should be minimized; prefer simple, explicit logic over clever, obscure solutions.

### II. Testing Standards
Comprehensive test coverage is MANDATORY. Unit tests MUST cover business logic, while integration tests MUST verify workflows. Tests must be reliable, deterministic, and independent. Test-Driven Development (TDD) is encouraged. Code without tests is considered broken.

### III. User Experience Consistency
Interfaces (whether CLI or API) MUST be predictable, intuitive, and consistent. Output formats must be uniform across commands/endpoints. Error messages MUST be actionable, clear, and distinct from standard output. Avoid exposing internal implementation details to the user.

### IV. Performance Requirements
Code MUST be optimized for execution speed and resource efficiency. Critical paths MUST be profiled and optimized. Avoid unnecessary allocations, blocking operations, or O(n^2) algorithms where better alternatives exist. Performance regressions are treated as bugs.

### V. Documentation Discipline
Documentation is a first-class citizen. `README.md` and `docs/` (if present) MUST be updated synchronously with code changes. API changes require immediate documentation updates. Documentation MUST be clear, concise, and up-to-date with the current state of the codebase.

## Technology Stack & Constraints

**Primary Language**: Go (implied by repository structure).
**Environment**: Linux compatibility is required.
**Dependency Management**: Use standard modules (e.g., `go mod`).
**Security**: No secrets in code. Input validation is mandatory for all external data.

## Workflow & Review

**Development**: All changes require a feature branch and a pull request.
**Quality Gates**: CI/CD pipelines (linting, testing, building) MUST pass before merging.
**Review**: Pull requests MUST include a description of changes and rationale. Code reviews should verify adherence to this Constitution.

## Governance

This Constitution governs all development within the `finfocus-action` project. Amendments require a formal version bump, documented rationale, and team consensus. All pull requests and code reviews MUST verify compliance with these principles.

**Version**: 1.0.0 | **Ratified**: 2026-01-08 | **Last Amended**: 2026-01-08