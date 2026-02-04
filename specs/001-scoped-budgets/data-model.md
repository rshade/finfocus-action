# Data Model: Scoped Budgets

**Feature**: 001-scoped-budgets
**Date**: 2026-02-03

## Entity Definitions

### BudgetScopeType (Enum/Union)

Represents the category of budget scope.

```typescript
export type BudgetScopeType = 'provider' | 'type' | 'tag';
```

**Values**:

- `provider` - Cloud provider (aws, gcp, azure)
- `type` - Resource type (compute, storage, networking)
- `tag` - Cost allocation tag (key:value format)

### BudgetScope (New Interface)

Represents a single scoped budget configuration parsed from user input.

```typescript
export interface BudgetScope {
  /** Full scope identifier (e.g., "provider/aws", "tag/env:prod") */
  scope: string;

  /** Scope category */
  scopeType: BudgetScopeType;

  /** Scope key within category (e.g., "aws", "compute", "env:prod") */
  scopeKey: string;

  /** Budget limit amount */
  amount: number;
}
```

**Validation Rules**:

- `scope` must match pattern: `^(provider|type|tag)/[a-zA-Z0-9_:-]+$`
- `scopeType` derived from prefix before first `/`
- `scopeKey` is everything after first `/`
- `amount` must be positive number

**Relationships**:

- Parsed from `budget-scopes` action input
- Written to finfocus config.yaml under `budget.scopes`

### ScopedBudgetStatus (New Interface)

Extends BudgetStatus with scope-specific fields. Represents status of a single scope.

```typescript
export interface ScopedBudgetStatus {
  /** Full scope identifier */
  scope: string;

  /** Scope category */
  scopeType: BudgetScopeType;

  /** Scope key within category */
  scopeKey: string;

  /** Amount spent in this scope */
  spent: number;

  /** Budget limit for this scope */
  budget: number;

  /** Currency code */
  currency: string;

  /** Percentage of budget used (0-100+) */
  percentUsed: number;

  /** Health status */
  status: BudgetHealthStatus;

  /** Triggered alerts for this scope */
  alerts: ScopedBudgetAlert[];
}
```

**Validation Rules**:

- `percentUsed` calculated as `(spent / budget) * 100`
- `status` derived from percentUsed thresholds
- `alerts` filtered to only triggered alerts

**State Transitions** (status):

```text
healthy (< 80%) → warning (≥ 80%, < 100%) → critical (≥ 100%, < 110%) → exceeded (≥ 110%)
```

### ScopedBudgetAlert (New Interface)

Alert configuration and status for a scope.

```typescript
export interface ScopedBudgetAlert {
  /** Threshold percentage */
  threshold: number;

  /** Alert type */
  type: 'actual' | 'forecasted';

  /** Whether alert is triggered */
  triggered: boolean;
}
```

### ScopedBudgetReport (New Interface)

Collection of all scope statuses returned from finfocus CLI.

```typescript
export interface ScopedBudgetReport {
  /** Array of scope statuses */
  scopes: ScopedBudgetStatus[];

  /** Scopes that failed to process */
  failed: ScopedBudgetFailure[];
}
```

### ScopedBudgetFailure (New Interface)

Represents a scope that failed to process.

```typescript
export interface ScopedBudgetFailure {
  /** Scope that failed */
  scope: string;

  /** Error message */
  error: string;
}
```

### FinfocusScopedBudgetResponse (New Interface)

Raw JSON structure from finfocus CLI v0.2.6+.

```typescript
export interface FinfocusScopedBudgetResponse {
  finfocus?: {
    scopes: FinfocusScopeEntry[];
  };
  scopes?: FinfocusScopeEntry[];
}

export interface FinfocusScopeEntry {
  scope: string;
  type: string;
  key: string;
  spent: number;
  budget: number;
  currency: string;
  percent_used: number;
  status: string;
  alerts?: Array<{
    threshold: number;
    type: string;
    triggered: boolean;
  }>;
}
```

**Notes**:

- Response may be wrapped in `finfocus` key (v0.2.4+ pattern)
- Action handles both wrapped and unwrapped formats

## Extended Interfaces

### ActionConfiguration (Extended)

Add new fields to existing interface.

```typescript
// Additions to existing ActionConfiguration
export interface ActionConfiguration {
  // ... existing fields ...

  /** Scoped budget configuration as YAML multiline string */
  budgetScopes: string;

  /** Fail action if any scope exceeds budget */
  failOnBudgetScopeBreach: boolean;
}
```

## Relationship Diagram

```text
ActionConfiguration
    │
    ├── budgetScopes (string) ──parse──► BudgetScope[]
    │                                         │
    │                                         ▼
    │                              finfocus config.yaml
    │                                    budget.scopes
    │
    └── failOnBudgetScopeBreach ──────► checkScopedBudgetBreach()
                                              │
                                              ▼
                              ScopedBudgetReport (from CLI)
                                    │
                                    ├── scopes: ScopedBudgetStatus[]
                                    │         │
                                    │         ▼
                                    │   PR Comment Table
                                    │   budget-scopes-status output
                                    │
                                    └── failed: ScopedBudgetFailure[]
                                              │
                                              ▼
                                        core.warning() logs
```

## Data Flow

```text
1. User Input (action.yml)
   budget-scopes: |
     provider/aws: 1000
     provider/gcp: 500

2. Parse Phase (config.ts)
   parseBudgetScopes(input) → BudgetScope[]

3. Config Generation (config.ts)
   generateYaml(config, scopes) → ~/.finfocus/config.yaml

4. CLI Execution (analyze.ts)
   finfocus budget status --output json → FinfocusScopedBudgetResponse

5. Response Parsing (analyze.ts)
   parseScopedBudgetResponse() → ScopedBudgetReport

6. Display (formatter.ts)
   formatScopedBudgetSection(report) → Markdown table

7. Output (main.ts)
   core.setOutput('budget-scopes-status', JSON.stringify(report.scopes))

8. Guardrails (guardrails.ts)
   checkScopedBudgetBreach(report, failOnBreach) → pass/fail
```

## Index/Uniqueness Rules

- **BudgetScope.scope**: Must be unique within configuration (duplicate scopes overwrite)
- **ScopedBudgetStatus.scope**: Unique per report (one status per scope)

## Volume Assumptions

- Maximum 20 scopes recommended (soft limit)
- Each scope adds ~1 row to PR comment table
- CLI response ~100-500 bytes per scope
