# Feature Specification: Scoped Budgets (Per-Provider, Per-Type, Per-Tag)

**Feature Branch**: `001-scoped-budgets`
**Created**: 2026-02-03
**Status**: Draft
**Input**: User description: "feat(budget): support scoped budgets (per-provider, per-type, per-tag)"
**GitHub Issue**: #47

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Define Provider-Specific Budgets (Priority: P1)

As a DevOps engineer managing multi-cloud infrastructure, I want to set separate budget limits for each cloud provider (AWS, GCP, Azure) so that I can track and control spending independently per provider.

**Why this priority**: Provider-level budgets are the most common use case for organizations with multi-cloud deployments. This provides immediate value for cost governance across cloud providers.

**Independent Test**: Can be fully tested by configuring provider-specific budgets and verifying that PR comments show separate budget status for each configured provider.

**Acceptance Scenarios**:

1. **Given** a workflow with `budget-scopes: "provider/aws: 500\nprovider/gcp: 300"`, **When** the action runs cost analysis, **Then** the PR comment displays a Budget Status by Scope table showing AWS and GCP budgets with their respective spent amounts and status indicators.
2. **Given** provider budgets are configured and AWS spend is at 90% while GCP is at 30%, **When** the action runs, **Then** the PR comment shows a warning indicator for AWS and a healthy indicator for GCP.
3. **Given** a provider budget with threshold alerts, **When** spend exceeds the warning threshold for that provider, **Then** the action outputs a warning and the budget-scopes-status output reflects the triggered alert.

---

### User Story 2 - Define Resource Type Budgets (Priority: P2)

As a platform engineer, I want to set budgets by resource type (compute, storage, networking) so that I can identify which resource categories are driving costs and enforce spending limits per category.

**Why this priority**: Resource type budgets help organizations identify cost drivers and set guardrails for specific infrastructure categories, complementing provider-level visibility.

**Independent Test**: Can be fully tested by configuring type-specific budgets and verifying accurate spend tracking and display per resource type.

**Acceptance Scenarios**:

1. **Given** a workflow with `budget-scopes: "type/compute: 200\ntype/storage: 100"`, **When** the action analyzes costs, **Then** the PR comment shows budget status for each resource type with spent, limit, and percentage.
2. **Given** compute resources exceed their budget limit, **When** the action runs with `fail-on-budget-scope-breach: true`, **Then** the action fails with a message indicating which scope(s) exceeded their limit.

---

### User Story 3 - Define Tag-Based Budgets (Priority: P2)

As a finance team member, I want to set budgets by cost allocation tags (environment, team, project) so that I can enforce spending policies at the organizational unit level.

**Why this priority**: Tag-based budgets enable organizational cost allocation and chargeback scenarios, which is critical for enterprise governance.

**Independent Test**: Can be fully tested by configuring tag-based budgets and verifying spend tracking against tagged resources.

**Acceptance Scenarios**:

1. **Given** a workflow with `budget-scopes: "tag/env:prod: 1000\ntag/team:platform: 500"`, **When** the action runs, **Then** the PR comment shows budget status for each tag with proper display formatting (e.g., "env:prod" displayed as a readable label).
2. **Given** tag-based budgets with resources that have multiple matching tags, **When** costs are calculated, **Then** each scope shows only the costs for resources matching that specific tag.

---

### User Story 4 - Combined Scope Budget Report (Priority: P3)

As a team lead reviewing a PR, I want to see all budget scopes in a single consolidated table so that I can quickly assess overall budget health across all dimensions.

**Why this priority**: A combined view provides at-a-glance visibility and enables quick decision-making during PR review.

**Independent Test**: Can be fully tested by configuring multiple scope types and verifying the consolidated table displays all scopes correctly.

**Acceptance Scenarios**:

1. **Given** budgets configured for providers, types, and tags, **When** the action runs, **Then** the PR comment displays a single "Budget Status by Scope" table with all scopes sorted by percentage used (highest first).
2. **Given** multiple budget scopes, **When** viewing the PR comment, **Then** each scope row shows: Scope name (human-readable), Spent amount, Budget limit, Status indicator with percentage.

---

### Edge Cases

- What happens when no resources match a configured scope? The action displays "No resources found" with $0.00 spent for that scope.
- How does the system handle invalid scope formats (e.g., missing prefix)? The action logs a warning and skips invalid scope entries.
- What if a scope key contains special characters? Tag values with colons (e.g., `tag/env:prod`) are parsed correctly by splitting on the first colon after the scope prefix.
- What happens when budgets overlap (e.g., a resource counts toward both provider/aws and type/compute)? Each scope tracks independently; a resource can contribute to multiple scope budgets.
- How does the system handle when finfocus CLI version is below v0.2.6? The action MUST fail immediately with a clear error message indicating that scoped budgets require finfocus v0.2.6+ when `budget-scopes` is configured.
- What happens when finfocus CLI succeeds for some scopes but fails for others? The action reports successful scopes in the PR comment and `budget-scopes-status` output, logs warnings for failed scopes, and continues without failing.
- How does `fail-on-budget-scope-breach` interact with partial scope failures? Breach evaluation applies only to successfully-processed scopes; failed scopes are ignored for breach detection. If any processed scope exceeds its budget, the action fails.
- What happens when more than 20 scopes are configured? The action logs a warning about potential performance/readability impact but continues processing all scopes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST parse the `budget-scopes` input as a YAML-formatted multiline string with key-value pairs.
- **FR-002**: System MUST support three scope prefixes: `provider/`, `type/`, and `tag/`.
- **FR-003**: System MUST generate valid finfocus configuration YAML that includes scoped budget definitions under the `budget.scopes` key.
- **FR-004**: System MUST display a "Budget Status by Scope" table in PR comments showing each configured scope with spent, budget, and status columns.
- **FR-005**: System MUST output the `budget-scopes-status` action output containing the finfocus CLI scope status response passed through without transformation.
- **FR-006**: System MUST use visual status indicators in the PR comment: healthy (below warning threshold), warning (above warning threshold), critical/exceeded (above budget).
- **FR-007**: System MUST validate scope format and log warnings for invalid entries without failing the action.
- **FR-008**: System MUST support individual threshold configuration per scope when provided by finfocus CLI output.
- **FR-009**: System MUST provide a `fail-on-budget-scope-breach` input to optionally fail the action when any successfully-processed scope exceeds its budget (failed scopes are excluded from breach evaluation).
- **FR-010**: System MUST maintain backward compatibility with existing global budget inputs (`budget-amount`, `budget-currency`, `budget-period`).
- **FR-011**: System MUST fail immediately with a clear error message when `budget-scopes` is configured but finfocus CLI version is below v0.2.6.
- **FR-012**: System MUST handle partial scope failures gracefully by reporting successful scopes and logging warnings for failed scopes without failing the action.

### Key Entities

- **BudgetScope**: Represents a single scoped budget with type (provider/type/tag), key (e.g., "aws", "compute", "env:prod"), amount, and optional currency.
- **ScopedBudgetStatus**: Extends the existing BudgetStatus with scope-specific fields including scope type, scope key, and individual threshold status.
- **ScopedBudgetReport**: Collection of ScopedBudgetStatus entries returned from finfocus CLI for display and output.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can configure up to 20 scoped budgets in a single workflow with guaranteed performance and PR comment readability (soft limit: >20 scopes triggers a warning but processing continues).
- **SC-002**: PR comments render the scoped budget table correctly in all GitHub-supported markdown viewers.
- **SC-003**: The `budget-scopes-status` output contains valid JSON that downstream jobs can parse and use for further automation.
- **SC-004**: Scope parsing correctly handles all valid finfocus scope formats including tags with colons in values.
- **SC-005**: All acceptance scenarios pass in integration tests; PR comment with 20 scopes renders correctly without truncation.

## Assumptions

- finfocus CLI v0.2.6+ is available and supports the `budget.scopes` configuration format.
- The scope format follows finfocus CLI conventions: `provider/{provider-name}`, `type/{resource-type}`, `tag/{key:value}`.
- Scope budgets inherit the global `budget-currency` and `budget-period` unless finfocus CLI supports per-scope overrides.
- The finfocus CLI returns scope status in a structured JSON format; this output is passed through directly to the `budget-scopes-status` action output without transformation.

## Dependencies

- finfocus CLI v0.2.6+ with scoped budget support (PR #509)
- Existing budget health integration from v0.2.5 (issue #54)

## Clarifications

### Session 2026-02-03

- Q: When finfocus CLI v0.2.6+ is not available and scoped budgets are configured, how should the action behave? → A: Fail the action immediately.
- Q: When finfocus CLI succeeds for some scopes but fails for others, how should the action behave? → A: Report successful scopes, log warnings for failed scopes, continue with partial results.
- Q: Should `fail-on-budget-scope-breach` fail when a processed scope exceeds budget while other scopes failed to process? → A: Yes, fail if any successfully-processed scope exceeds budget; ignore failed scopes for breach evaluation.
- Q: Is the 20 scoped budgets limit (SC-001) a hard limit or tested capacity? → A: Soft limit with warning; action logs warning if >20 scopes but continues processing.
- Q: What fields should each scope entry include in the `budget-scopes-status` output? → A: Pass through the finfocus CLI output structure without transformation.

## Out of Scope

- Real-time budget monitoring or alerting outside of PR context
- Budget forecasting per scope (uses global forecast only)
- Custom currency per scope (uses global currency)
- Hierarchical budget inheritance (parent-child scope relationships)
