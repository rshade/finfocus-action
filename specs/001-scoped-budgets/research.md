# Research: Scoped Budgets

**Feature**: 001-scoped-budgets
**Date**: 2026-02-03

## Research Tasks Completed

### 1. finfocus CLI v0.2.6 Scoped Budget Configuration Format

**Decision**: Use YAML configuration under `budget.scopes` key with scope prefix as key.

**Rationale**: Aligns with finfocus CLI conventions (PR #509). The format uses the full scope prefix (e.g., `provider/aws`) as the YAML key, which is consistent with existing CLI patterns and enables straightforward parsing.

**Expected Configuration Format**:

```yaml
budget:
  amount: 2000
  currency: USD
  period: monthly
  alerts:
    - threshold: 80
      type: actual
  scopes:
    provider/aws:
      amount: 1000
    provider/gcp:
      amount: 500
    type/compute:
      amount: 1200
    tag/env:prod:
      amount: 800
```

**Alternatives Considered**:

1. Nested structure (`scopes.provider.aws`) - Rejected: inconsistent with finfocus CLI flat scope key convention
2. Array format with scope field - Rejected: less readable in YAML, harder to maintain uniqueness

### 2. finfocus CLI Scoped Budget Status Output Format

**Decision**: Pass through finfocus CLI JSON output without transformation for `budget-scopes-status` action output.

**Rationale**: Per clarification session, the action should not define its own schema but relay what finfocus returns. This ensures forward compatibility as finfocus evolves.

**Expected CLI Output Format** (finfocus v0.2.6+):

```json
{
  "finfocus": {
    "scopes": [
      {
        "scope": "provider/aws",
        "type": "provider",
        "key": "aws",
        "spent": 500.00,
        "budget": 1000.00,
        "currency": "USD",
        "percent_used": 50.0,
        "status": "healthy",
        "alerts": []
      }
    ]
  }
}
```

**Notes**:

- May be wrapped in `"finfocus"` key (v0.2.4+ pattern)
- Action parses for display but outputs raw JSON

### 3. Scope Parsing Best Practices

**Decision**: Parse `budget-scopes` input as YAML multiline string, validate prefix, extract scope type and key.

**Rationale**: YAML multiline is user-friendly in GitHub Actions workflows and matches existing `budget-alerts` JSON array pattern for consistency.

**Input Format**:

```yaml
budget-scopes: |
  provider/aws: 1000
  provider/gcp: 500
  type/compute: 1200
  tag/env:prod: 800
```

**Parsing Rules**:

1. Split on newlines, trim whitespace
2. Parse each line as `key: value` pair
3. Validate key starts with `provider/`, `type/`, or `tag/`
4. Extract scope type (before `/`) and scope key (after `/`)
5. Parse value as number (budget amount)
6. Log warning and skip invalid entries (FR-007)

**Alternatives Considered**:

1. JSON array - Rejected: more verbose, less readable in workflows
2. Comma-separated string - Rejected: doesn't support values with special characters

### 4. Version Detection Pattern

**Decision**: Use existing `getFinfocusVersion()` in install.ts with semver comparison for v0.2.6+ check.

**Rationale**: Existing pattern from budget health integration (v0.2.5) is proven and handles version parsing correctly.

**Implementation**:

```typescript
const version = await getFinfocusVersion();
if (version && semver.lt(version, '0.2.6')) {
  throw new Error('Scoped budgets require finfocus v0.2.6+');
}
```

**Alternatives Considered**:

1. Runtime feature detection via CLI flag - Rejected: adds latency, may fail silently
2. No version check - Rejected: confusing errors from older CLI versions

### 5. Partial Failure Handling Pattern

**Decision**: Process all scopes, collect successes and failures separately, report both in output.

**Rationale**: Per clarification, action should maximize visibility while not blocking on partial data issues.

**Implementation Approach**:

```typescript
interface ScopedBudgetResult {
  successful: ScopedBudgetStatus[];
  failed: { scope: string; error: string }[];
}
```

- Log warnings for failed scopes via `core.warning()`
- Include only successful scopes in PR comment table
- `budget-scopes-status` output includes both (or just successful per finfocus CLI)

### 6. Breach Evaluation Logic

**Decision**: Evaluate breach only on successfully-processed scopes; failed scopes excluded.

**Rationale**: Per clarification, incomplete data should not prevent enforcement on available data.

**Implementation**:

```typescript
function checkScopedBudgetBreach(
  results: ScopedBudgetResult,
  failOnBreach: boolean
): void {
  if (!failOnBreach) return;

  const breached = results.successful.filter(s => s.percentUsed >= 100);
  if (breached.length > 0) {
    const names = breached.map(s => s.scope).join(', ');
    core.setFailed(`Budget exceeded for scopes: ${names}`);
  }
}
```

### 7. PR Comment Table Format

**Decision**: Single consolidated "Budget Status by Scope" table sorted by percentUsed descending.

**Rationale**: Matches User Story 4 requirement for at-a-glance visibility. Highest usage first helps prioritize attention.

**Format**:

```markdown
### 📊 Budget Status by Scope

| Scope | Spent | Budget | Status |
|:------|------:|-------:|:------:|
| provider/aws | $900.00 | $1,000.00 | 🟡 90% |
| type/compute | $600.00 | $1,200.00 | 🟢 50% |
| provider/gcp | $150.00 | $500.00 | 🟢 30% |
```

**Status Indicators**:

- 🟢 healthy: < warning threshold (default 80%)
- 🟡 warning: ≥ warning threshold, < 100%
- 🔴 critical: ≥ 100%, < 110%
- ⛔ exceeded: ≥ 110%

### 8. Soft Limit Implementation

**Decision**: Log warning at >20 scopes, continue processing.

**Rationale**: Per clarification, avoid artificial constraints while setting clear expectations about tested capacity.

**Implementation**:

```typescript
const SCOPE_SOFT_LIMIT = 20;
if (scopes.length > SCOPE_SOFT_LIMIT) {
  core.warning(
    `Configured ${scopes.length} scopes (exceeds recommended limit of ${SCOPE_SOFT_LIMIT}). ` +
    `Performance and PR comment readability may be impacted.`
  );
}
```

## Dependencies Verified

| Dependency | Version | Status | Notes |
|------------|---------|--------|-------|
| finfocus CLI | v0.2.6+ | ⏳ Pending | PR #509 adds scoped budget support |
| @actions/core | ^2.0.2 | ✅ Available | Existing dependency |
| @actions/exec | ^2.0.0 | ✅ Available | Existing dependency |
| semver | ✅ | ✅ Available | Already used in install.ts |

## Open Questions Resolved

All questions from clarification session have been incorporated:

1. ✅ Version fallback → Fail immediately (FR-011)
2. ✅ Partial failures → Report successful, warn for failed (FR-012)
3. ✅ Breach with partial → Evaluate on successful only (FR-009)
4. ✅ 20 scope limit → Soft limit with warning (SC-001)
5. ✅ Output format → Pass through finfocus CLI (FR-005)

## Next Phase

Proceed to Phase 1: Design & Contracts

- Generate data-model.md with TypeScript interfaces
- Generate contracts/finfocus-cli.md with CLI contract
- Generate quickstart.md with usage examples
