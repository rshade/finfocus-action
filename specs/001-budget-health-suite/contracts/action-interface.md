# Action Interface Contract: Budget Health Suite

**Feature**: 001-budget-health-suite
**Date**: 2026-02-02

## Inputs

### New Inputs

| Input | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `budget-alert-threshold` | number | No | `80` | Percentage threshold to trigger budget alert in PR comment |
| `fail-on-budget-health` | number | No | (none) | Fail action if health score falls below this value (0-100) |
| `show-budget-forecast` | boolean | No | `true` | Display budget forecast in PR comment |

### Existing Inputs (unchanged)

| Input | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `budget-amount` | number | No | (none) | Budget amount for cost tracking |
| `budget-currency` | string | No | `USD` | Budget currency code |
| `budget-period` | string | No | `monthly` | Budget period: monthly, quarterly, yearly |
| `budget-alerts` | string | No | (none) | Budget alerts in JSON format |

## Outputs

### New Outputs

| Output | Type | Description |
|--------|------|-------------|
| `budget-health-score` | number | Budget health score (0-100), empty if budget not configured |
| `budget-forecast` | string | Projected end-of-period spend (e.g., "$1,890.00"), empty if unavailable |
| `budget-runway-days` | number | Days until budget exhausted at current rate, empty if unlimited |
| `budget-status` | string | One of: `healthy`, `warning`, `critical`, `exceeded`, empty if not configured |

### Existing Outputs (unchanged)

| Output | Type | Description |
|--------|------|-------------|
| `budget-spent` | string | Current budget spend |
| `budget-remaining` | string | Remaining budget |
| `budget-percent-used` | string | Percentage of budget used |

## Environment Variables

### New Variables (passed to dist/index.js)

```text
INPUT_BUDGET_ALERT_THRESHOLD
INPUT_FAIL_ON_BUDGET_HEALTH
INPUT_SHOW_BUDGET_FORECAST
```

## Behavior Contract

### When `budget-amount` is NOT set

- All budget-related outputs are empty strings
- No budget section appears in PR comment
- `fail-on-budget-health` is ignored

### When `budget-amount` IS set

1. Action invokes `finfocus budget status --output json` (if v0.2.5+)
2. If CLI unavailable or fails, falls back to local calculation
3. Outputs are populated with health metrics
4. PR comment includes Budget Health section
5. If `fail-on-budget-health` is set and score is below threshold, action fails

### Health Score to Status Mapping

| Health Score | Status | Action Behavior |
|--------------|--------|-----------------|
| 80-100 | `healthy` | Success |
| 50-79 | `warning` | Success (alert shown if above `budget-alert-threshold`) |
| 1-49 | `critical` | Success (unless `fail-on-budget-health` set) |
| 0 or spent > budget | `exceeded` | Success (unless `fail-on-budget-health` set) |

### Version Compatibility

| finfocus Version | Behavior |
|------------------|----------|
| < 0.2.5 | Fallback: basic budget status (spent, remaining, percent), no health score/forecast/runway |
| >= 0.2.5 | Full: health score, forecast, runway, status from CLI |

## Error Handling Contract

| Scenario | Behavior |
|----------|----------|
| `finfocus budget status` command fails | Log warning, fall back to local calculation |
| Invalid JSON response | Log warning, fall back to local calculation |
| `budget-amount` is zero or negative | Treat as "not configured", skip budget features |
| `fail-on-budget-health` threshold breached | Action fails with descriptive error message |
| Network/CLI timeout | Log warning, continue without budget health (non-blocking) |
