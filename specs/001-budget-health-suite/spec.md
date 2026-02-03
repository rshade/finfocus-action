# Feature Specification: Budget Health Suite Integration

**Feature Branch**: `001-budget-health-suite`
**Created**: 2026-02-02
**Status**: Draft
**Input**: GitHub Issue #46 - feat(budget): integrate budget health suite from finfocus v0.2.5

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Budget Health in PR Comments (Priority: P1)

As a DevOps engineer reviewing a pull request, I want to see comprehensive budget health metrics in the PR comment so that I can make informed decisions about whether the infrastructure changes are financially sustainable.

**Why this priority**: This is the primary value proposition - providing visibility into budget health during code review. Without this, users cannot make cost-conscious decisions at PR time.

**Independent Test**: Can be fully tested by running the action with `budget-amount` configured and verifying the PR comment contains health score, forecast, and runway metrics.

**Acceptance Scenarios**:

1. **Given** `budget-amount` is set to 2000 and `budget-currency` is USD, **When** the action runs on a PR, **Then** the PR comment includes a Budget Health section showing health score, spent/total, forecast, and runway days.

2. **Given** `budget-amount` is set and projected costs are 62% of budget, **When** the action runs, **Then** the health score displays as "healthy" status with appropriate visual indicator.

3. **Given** `budget-amount` is not configured, **When** the action runs, **Then** no budget health section appears in the PR comment.

---

### User Story 2 - Fail Builds on Poor Budget Health (Priority: P2)

As a platform engineer, I want to automatically fail CI builds when budget health drops below a threshold so that cost overruns are caught before merge.

**Why this priority**: Guardrail enforcement is essential for governance but depends on the metrics display being functional first.

**Independent Test**: Can be fully tested by configuring `fail-on-budget-health: 50` and running against a scenario where health score is 45, verifying the action fails.

**Acceptance Scenarios**:

1. **Given** `fail-on-budget-health` is set to 50, **When** the calculated health score is 45, **Then** the action fails with an appropriate error message.

2. **Given** `fail-on-budget-health` is set to 50, **When** the calculated health score is 75, **Then** the action succeeds.

3. **Given** `fail-on-budget-health` is not set, **When** the health score is 20, **Then** the action does not fail (health threshold enforcement is opt-in).

---

### User Story 3 - Access Budget Metrics in Downstream Jobs (Priority: P2)

As a CI/CD pipeline author, I want budget health metrics exposed as action outputs so that downstream jobs can react to budget conditions programmatically.

**Why this priority**: Output availability enables integration with external dashboards, alerting systems, and custom workflow logic.

**Independent Test**: Can be fully tested by verifying the action sets the four new outputs after execution, and a subsequent workflow step can read them.

**Acceptance Scenarios**:

1. **Given** the action completes with budget configured, **When** a downstream step reads `budget-health-score`, **Then** the value is a number between 0 and 100.

2. **Given** the action completes, **When** a downstream step reads `budget-status`, **Then** the value is one of: "healthy", "warning", "critical", or "exceeded".

3. **Given** `budget-amount` is not set, **When** a downstream step reads budget outputs, **Then** the outputs are empty strings.

---

### User Story 4 - Configure Budget Alert Thresholds (Priority: P3)

As a finance-aware DevOps lead, I want to customize the alert threshold percentage so that alerts trigger at a level appropriate for my organization's risk tolerance.

**Why this priority**: Customization is valuable but most users will accept the default 80% threshold.

**Independent Test**: Can be fully tested by setting `budget-alert-threshold: 70` and verifying alerts trigger when budget usage exceeds 70%.

**Acceptance Scenarios**:

1. **Given** `budget-alert-threshold` is set to 70, **When** budget usage is 75%, **Then** a warning alert is shown in the PR comment.

2. **Given** `budget-alert-threshold` is not set (default 80), **When** budget usage is 75%, **Then** no warning alert is shown.

---

### Edge Cases

- What happens when finfocus CLI version is older than v0.2.5 (does not support budget status command)?
  - Action falls back to existing budget calculation logic, outputs partial data, and logs a warning.
- How does the system handle when finfocus budget status command returns invalid JSON?
  - Action logs a warning and continues without budget health metrics; PR comment omits the budget section.
- What happens when budget-amount is zero or negative?
  - Action treats this as "no budget configured" and skips budget health features.
- What happens when projected cost exceeds budget by 200%+?
  - Health score floors at 0, status shows "exceeded", runway shows 0 days.
- What happens when no costs are projected (new empty infrastructure)?
  - Health score is 100, status is "healthy", forecast equals $0, runway is "unlimited".

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST invoke `finfocus budget status --output json` when `budget-amount` is configured and finfocus version is v0.2.5+.
- **FR-002**: System MUST calculate and display a health score from 0-100 in the PR comment Budget Health section.
- **FR-003**: System MUST display budget forecast (projected end-of-period spend) in the PR comment.
- **FR-004**: System MUST display budget runway (days until budget exhaustion) in the PR comment.
- **FR-005**: System MUST fail the action when health score is below `fail-on-budget-health` threshold (if configured).
- **FR-006**: System MUST expose `budget-health-score`, `budget-forecast`, `budget-runway-days`, and `budget-status` as action outputs.
- **FR-007**: System MUST accept `budget-alert-threshold` input to customize the percentage at which warnings appear.
- **FR-008**: System MUST gracefully degrade when finfocus version is below v0.2.5, falling back to existing budget status calculation.
- **FR-009**: System MUST display budget status as one of: "healthy" (score >= 80), "warning" (score 50-79), "critical" (score < 50), or "exceeded" (spent > budget).
- **FR-010**: System MUST include visual indicators (icons/colors) in the PR comment to quickly convey budget health status.

### Key Entities

- **BudgetHealthReport**: Extends existing `BudgetStatus` interface with `healthScore`, `forecast`, `runwayDays`, and `status` fields.
- **BudgetHealthThresholds**: Configuration object containing `alertThreshold` and `failThreshold` values.
- **HealthScoreCalculation**: Algorithm that converts spent/budget/forecast into a 0-100 score.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view complete budget health metrics (score, forecast, runway) in PR comments within the existing action execution time budget.
- **SC-002**: `fail-on-budget-health` correctly blocks PRs when health score is below the configured threshold.
- **SC-003**: All four budget-related outputs are accessible to downstream workflow jobs.
- **SC-004**: Budget health features work seamlessly with existing action inputs (`budget-amount`, `budget-currency`, `budget-period`, `budget-alerts`).
- **SC-005**: Action continues to function when finfocus CLI is older than v0.2.5, providing existing budget tracking capabilities.
- **SC-006**: 100% of acceptance scenarios in this specification pass in automated tests.

## Assumptions

- finfocus v0.2.5+ provides `finfocus budget status --output json` with fields: `health_score`, `forecast`, `runway_days`, `status`, `spent`, `remaining`, `percent_used`.
- The health score algorithm in finfocus uses: score = max(0, 100 - (percent_used * 1.25)) with adjustments for forecast trends.
- Budget runway is calculated as: (remaining_budget / daily_burn_rate) where daily_burn_rate = spent / elapsed_days_in_period.
- The `show-budget-forecast` input defaults to `true` to show forecast in comments; set to `false` to hide.
