# Quickstart: Scoped Budgets

**Feature**: 001-scoped-budgets
**Date**: 2026-02-03

## Overview

Scoped budgets allow you to set granular budget limits per cloud provider, resource type, or cost allocation tag. This enables multi-cloud cost governance, resource category tracking, and organizational chargeback scenarios.

## Prerequisites

- finfocus-action v1.2.0+
- finfocus CLI v0.2.6+ (automatically installed by action)

## Basic Usage

### Provider Budgets

Set separate budgets for each cloud provider:

```yaml
- uses: rshade/finfocus-action@v1
  with:
    pulumi-plan-json: pulumi-plan.json
    budget-amount: 2000
    budget-currency: USD
    budget-period: monthly
    budget-scopes: |
      provider/aws: 1000
      provider/gcp: 500
      provider/azure: 500
```

### Resource Type Budgets

Track spending by resource category:

```yaml
- uses: rshade/finfocus-action@v1
  with:
    pulumi-plan-json: pulumi-plan.json
    budget-amount: 2000
    budget-scopes: |
      type/compute: 1200
      type/storage: 500
      type/networking: 300
```

### Tag-Based Budgets

Enforce budgets by cost allocation tags:

```yaml
- uses: rshade/finfocus-action@v1
  with:
    pulumi-plan-json: pulumi-plan.json
    budget-amount: 5000
    budget-scopes: |
      tag/env:prod: 3000
      tag/env:staging: 1500
      tag/env:dev: 500
```

### Combined Scopes

Mix all scope types in one configuration:

```yaml
- uses: rshade/finfocus-action@v1
  with:
    pulumi-plan-json: pulumi-plan.json
    budget-amount: 10000
    budget-scopes: |
      provider/aws: 6000
      provider/gcp: 4000
      type/compute: 5000
      type/storage: 3000
      tag/team:platform: 4000
      tag/team:data: 3000
```

## Enforcement

### Fail on Budget Breach

Fail the workflow when any scope exceeds its budget:

```yaml
- uses: rshade/finfocus-action@v1
  with:
    pulumi-plan-json: pulumi-plan.json
    budget-amount: 2000
    budget-scopes: |
      provider/aws: 1000
      provider/gcp: 500
    fail-on-budget-scope-breach: true
```

### Using Outputs for Custom Logic

Access scope status in subsequent steps:

```yaml
- uses: rshade/finfocus-action@v1
  id: finfocus
  with:
    pulumi-plan-json: pulumi-plan.json
    budget-scopes: |
      provider/aws: 1000

- name: Check AWS Budget
  run: |
    SCOPES='${{ steps.finfocus.outputs.budget-scopes-status }}'
    AWS_STATUS=$(echo "$SCOPES" | jq -r '.[] | select(.scope == "provider/aws") | .status')
    if [ "$AWS_STATUS" = "exceeded" ]; then
      echo "::error::AWS budget exceeded!"
      exit 1
    fi
```

## PR Comment Display

When scoped budgets are configured, the PR comment includes a "Budget Status by Scope" table:

```markdown
### 📊 Budget Status by Scope

| Scope | Spent | Budget | Status |
|:------|------:|-------:|:------:|
| provider/aws | $900.00 | $1,000.00 | 🟡 90% |
| type/compute | $600.00 | $1,200.00 | 🟢 50% |
| tag/env:prod | $800.00 | $800.00 | 🔴 100% |
| provider/gcp | $150.00 | $500.00 | 🟢 30% |
```

**Status Indicators**:

- 🟢 Healthy: Below 80% used
- 🟡 Warning: 80-99% used
- 🔴 Critical: 100-109% used
- ⛔ Exceeded: 110%+ used

## Scope Format Reference

| Type | Format | Example |
|------|--------|---------|
| Provider | `provider/{name}` | `provider/aws`, `provider/gcp`, `provider/azure` |
| Type | `type/{category}` | `type/compute`, `type/storage`, `type/networking` |
| Tag | `tag/{key:value}` | `tag/env:prod`, `tag/team:platform`, `tag/project:api` |

## Action Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `budget-scopes` | YAML multiline string of scope:amount pairs | (none) |
| `fail-on-budget-scope-breach` | Fail if any scope exceeds budget | `false` |

## Action Outputs

| Output | Description |
|--------|-------------|
| `budget-scopes-status` | JSON array of scope statuses from finfocus CLI |

## Limits & Recommendations

- **Soft limit**: 20 scopes maximum (warning logged if exceeded)
- **Budget inheritance**: Scopes use global currency and period
- **Overlap**: Resources can count toward multiple scopes (e.g., both provider/aws and type/compute)

## Error Handling

### Invalid Scope Format

Invalid scopes are logged as warnings and skipped:

```yaml
budget-scopes: |
  provider/aws: 1000
  invalid-format: 500  # Warning: skipped
  type/compute: 800
```

### finfocus Version Too Old

Action fails immediately if finfocus CLI is below v0.2.6:

```text
Error: Scoped budgets require finfocus v0.2.6+. Current version: 0.2.5
```

### Partial Scope Failures

If some scopes fail to process, successful scopes are still reported:

```text
Warning: Failed to process scope 'tag/nonexistent:value': No resources found
```

## Migration from Global Budget

Scoped budgets work alongside the existing global budget. You can:

1. **Keep both**: Global budget + scoped budgets provide two levels of visibility
2. **Replace**: Set global budget high, use scopes for actual enforcement
3. **Gradual adoption**: Start with provider scopes, add types and tags over time

```yaml
# Global + Scoped (recommended for visibility)
budget-amount: 10000  # Overall ceiling
budget-scopes: |
  provider/aws: 6000  # Detailed breakdown
  provider/gcp: 4000
```
