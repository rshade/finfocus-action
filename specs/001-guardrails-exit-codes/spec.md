# Feature Specification: Guardrails Exit Code Refactor

**Feature Branch**: `001-guardrails-exit-codes`
**Created**: 2026-02-02
**Status**: Draft
**Input**: GitHub Issue #48 - refactor(guardrails): use finfocus native exit codes for budget thresholds

## User Scenarios & Testing *(mandatory)*

### User Story 1 - CI Pipeline Fails on Budget Threshold Breach (Priority: P1)

A DevOps engineer configures finfocus-action to enforce budget thresholds in their CI/CD pipeline. When the finfocus CLI detects a budget breach, the action uses the exit code to determine the severity and fails appropriately with a meaningful message.

**Why this priority**: This is the core functionality of the refactor - replacing JSON parsing with exit code interpretation for budget threshold enforcement.

**Independent Test**: Can be fully tested by running the action with a plan that exceeds configured thresholds and verifying the action fails with the correct exit code interpretation.

**Acceptance Scenarios**:

1. **Given** a Pulumi plan that causes a budget warning threshold breach, **When** finfocus returns exit code 1, **Then** the action fails with a message indicating "Warning threshold breached"
2. **Given** a Pulumi plan that causes a critical budget threshold breach, **When** finfocus returns exit code 2, **Then** the action fails with a message indicating "Critical threshold breached"
3. **Given** a Pulumi plan that causes the budget to be exceeded, **When** finfocus returns exit code 3, **Then** the action fails with a message indicating "Budget exceeded"
4. **Given** a Pulumi plan within budget limits, **When** finfocus returns exit code 0, **Then** the action passes without failure

---

### User Story 2 - Backward Compatibility with Older finfocus Versions (Priority: P2)

A user running an older finfocus version (< v0.2.5) continues to have threshold checks work using the existing JSON parsing approach.

**Why this priority**: Ensures existing users are not broken by the refactor - critical for adoption but secondary to the main feature.

**Independent Test**: Can be tested by mocking an older finfocus version that doesn't return meaningful exit codes and verifying JSON parsing fallback works.

**Acceptance Scenarios**:

1. **Given** finfocus v0.2.4 or earlier, **When** a budget threshold is configured, **Then** the action falls back to JSON parsing for threshold checks
2. **Given** finfocus v0.2.5+, **When** a budget threshold is configured, **Then** the action uses exit codes for threshold checks

---

### User Story 3 - Clear Error Messages for Different Breach Severities (Priority: P3)

A developer reviewing a failed CI run quickly understands why the build failed and what severity of budget breach occurred.

**Why this priority**: Improves user experience and troubleshooting but is not core to functionality.

**Independent Test**: Can be tested by triggering each exit code scenario and verifying the error messages are distinct and actionable.

**Acceptance Scenarios**:

1. **Given** exit code 1 (warning), **When** the action fails, **Then** the error message clearly indicates it was a warning threshold
2. **Given** exit code 2 (critical), **When** the action fails, **Then** the error message clearly indicates it was a critical threshold
3. **Given** exit code 3 (exceeded), **When** the action fails, **Then** the error message clearly indicates the budget was exceeded

---

### Edge Cases

- What happens when finfocus returns an unexpected exit code (e.g., 4 or higher)? The system treats it as an error and provides a generic failure message.
- How does the system handle version detection failures? Falls back to JSON parsing as the safe default.
- What happens if the finfocus command times out or crashes? The error is propagated with appropriate context.
- How does the action behave when `fail-on-cost-increase` is set but no budget thresholds are configured in finfocus? The existing cost threshold behavior continues unchanged.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST interpret finfocus exit code 0 as "all thresholds passed"
- **FR-002**: System MUST interpret finfocus exit code 1 as "warning threshold breached"
- **FR-003**: System MUST interpret finfocus exit code 2 as "critical threshold breached"
- **FR-004**: System MUST interpret finfocus exit code 3 as "budget exceeded"
- **FR-005**: System MUST fall back to JSON parsing for threshold checks when finfocus version is below v0.2.5
- **FR-006**: System MUST provide distinct, actionable error messages for each exit code scenario
- **FR-007**: System MUST treat unexpected exit codes (4+) as errors and provide a generic failure message
- **FR-008**: System MUST preserve existing `fail-on-cost-increase` input behavior from the user's perspective
- **FR-009**: System MUST log the exit code when debug mode is enabled
- **FR-010**: System MUST handle command execution failures (timeout, crash) gracefully with appropriate error messages

### Key Entities

- **Exit Code**: Integer returned by finfocus CLI (0-3 for v0.2.5+)
- **Threshold Result**: Outcome of threshold check (pass, warning, critical, exceeded)
- **Version Info**: finfocus CLI version used for feature detection

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users experience no change in threshold enforcement behavior when upgrading from the current implementation
- **SC-002**: CI pipelines fail faster when using exit codes vs JSON parsing (no parsing overhead)
- **SC-003**: Error messages clearly communicate the type of budget breach (warning/critical/exceeded)
- **SC-004**: Users running finfocus < v0.2.5 continue to have working threshold checks
- **SC-005**: All existing unit tests pass without modification to test assertions (only implementation changes)

## Assumptions

- finfocus v0.2.5+ reliably returns the documented exit codes (0, 1, 2, 3)
- The `finfocus budget check` command (or equivalent) exists in v0.2.5
- Semantic versioning is used by finfocus, allowing version comparison
- The action can determine finfocus version via `finfocus --version` or similar command

## Out of Scope

- Changes to PR comment formatting
- New budget configuration inputs
- Carbon footprint threshold changes (remains JSON-based)
- Changes to the `behavior-on-error` setting behavior

## Dependencies

- finfocus CLI v0.2.5 with exit code support (finfocus/finfocus#496)
