# Data Model: Budget Health Suite Integration

**Feature**: 001-budget-health-suite
**Date**: 2026-02-02

## Entities

### BudgetHealthReport (extends BudgetStatus)

Extends the existing `BudgetStatus` interface with health-specific fields.

```typescript
/**
 * Budget health status returned from finfocus v0.2.5+ or calculated locally.
 * Extends existing BudgetStatus interface.
 */
export interface BudgetHealthReport extends BudgetStatus {
  /** Health score from 0-100 (100 = fully healthy) */
  healthScore?: number;

  /** Projected end-of-period spend (formatted string, e.g., "$1,890.00") */
  forecast?: string;

  /** Forecast as raw number for calculations */
  forecastAmount?: number;

  /** Days until budget exhausted at current burn rate */
  runwayDays?: number;

  /** Computed status based on health score and spend */
  healthStatus: BudgetHealthStatus;
}

/**
 * Budget health status levels
 */
export type BudgetHealthStatus = 'healthy' | 'warning' | 'critical' | 'exceeded';
```

**Relationships**:
- Extends: `BudgetStatus` (existing in types.ts)
- Used by: `Analyzer.runBudgetStatus()`, `formatBudgetHealthSection()`

**Validation Rules**:
- `healthScore`: Must be 0-100 inclusive
- `runwayDays`: Must be >= 0, or undefined for "unlimited"
- `forecastAmount`: Must be >= 0
- `healthStatus`: Must be one of the four valid values

### BudgetHealthConfig

Configuration for budget health features extracted from action inputs.

```typescript
/**
 * Configuration for budget health threshold checking.
 */
export interface BudgetHealthConfig {
  /** Percentage threshold to trigger alert in PR comment (default: 80) */
  alertThreshold: number;

  /** Health score threshold to fail the action (optional, opt-in) */
  failThreshold?: number;

  /** Whether to show forecast in PR comment (default: true) */
  showForecast: boolean;
}
```

**Relationships**:
- Extracted from: `ActionConfiguration` input fields
- Used by: `formatBudgetHealthSection()`, `checkBudgetHealthThreshold()`

**Validation Rules**:
- `alertThreshold`: Must be 1-100
- `failThreshold`: If set, must be 0-100
- `showForecast`: Boolean

### FinfocusBudgetStatusResponse

Raw JSON response from `finfocus budget status --output json`.

```typescript
/**
 * Raw response from finfocus budget status command (v0.2.5+).
 */
export interface FinfocusBudgetStatusResponse {
  health_score: number;
  status: string;
  spent: number;
  remaining: number;
  percent_used: number;
  forecast: number;
  runway_days: number;
  budget: {
    amount: number;
    currency: string;
    period: string;
  };
}
```

**Relationships**:
- Source: `finfocus budget status --output json`
- Transformed to: `BudgetHealthReport`

**Validation Rules**:
- All numeric fields must be finite numbers
- `status` must be a non-empty string
- `budget.currency` must be a valid currency code
- `budget.period` must be 'monthly' | 'quarterly' | 'yearly'

## State Transitions

### Budget Health Status Flow

```
                    ┌─────────────┐
                    │   healthy   │  score >= 80
                    │    (🟢)     │
                    └──────┬──────┘
                           │ score drops below 80
                           ▼
                    ┌─────────────┐
                    │   warning   │  50 <= score < 80
                    │    (🟡)     │
                    └──────┬──────┘
                           │ score drops below 50
                           ▼
                    ┌─────────────┐
                    │   critical  │  0 < score < 50
                    │    (🔴)     │
                    └──────┬──────┘
                           │ score = 0 OR spent > budget
                           ▼
                    ┌─────────────┐
                    │   exceeded  │  over budget
                    │    (⛔)     │
                    └─────────────┘
```

**Transition Rules**:
1. Status is computed fresh on each action run (stateless)
2. `exceeded` takes priority: if `spent > budget`, status is `exceeded` regardless of score
3. Transitions are bidirectional (status can improve if costs decrease)

## ActionConfiguration Extensions

New fields added to existing `ActionConfiguration` interface:

```typescript
// In types.ts - add to existing interface
export interface ActionConfiguration {
  // ... existing fields ...

  /** Percentage threshold to trigger budget alert (default: 80) */
  budgetAlertThreshold?: number;

  /** Health score threshold to fail action (optional) */
  failOnBudgetHealth?: number;

  /** Whether to show budget forecast in PR comment (default: true) */
  showBudgetForecast?: boolean;
}
```

## Output Schema

New action outputs added to action.yml:

```yaml
outputs:
  # ... existing outputs ...

  budget-health-score:
    description: 'Budget health score (0-100)'
    value: ${{ steps.run.outputs.budget-health-score }}

  budget-forecast:
    description: 'Projected end-of-period spend'
    value: ${{ steps.run.outputs.budget-forecast }}

  budget-runway-days:
    description: 'Days until budget exhausted at current rate'
    value: ${{ steps.run.outputs.budget-runway-days }}

  budget-status:
    description: "Budget health status: 'healthy' | 'warning' | 'critical' | 'exceeded'"
    value: ${{ steps.run.outputs.budget-status }}
```

## Data Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  action.yml     │────▶│  main.ts         │────▶│  analyze.ts         │
│  inputs         │     │  parseInputs()   │     │  runBudgetStatus()  │
└─────────────────┘     └──────────────────┘     └──────────┬──────────┘
                                                            │
                        ┌──────────────────┐                │
                        │  finfocus CLI    │◀───────────────┘
                        │  budget status   │
                        └────────┬─────────┘
                                 │ JSON response
                                 ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  PR Comment     │◀────│  formatter.ts    │◀────│  BudgetHealthReport │
│  (GitHub)       │     │  formatBudget()  │     │  (transformed)      │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │  guardrails.ts   │
                        │  checkHealth()   │
                        └──────────────────┘
```
