# Data Model: finfocus-action

**Feature Branch**: `001-create-finfocus-action`

## Interfaces

### ActionConfiguration (Inputs)
Map of inputs provided by the GitHub Action workflow.

```typescript
interface ActionConfiguration {
  pulumiPlanJsonPath: string; // valid file path
  githubToken: string;       // non-empty string
  pulumicostVersion: string; // "latest" or semver string
  installPlugins: string[];  // parsed from comma-separated string
  behaviorOnError: 'fail' | 'warn' | 'silent';
  postComment: boolean;
  threshold: string | null; // Maps to 'fail-on-cost-increase' input (e.g., "100USD")
  analyzerMode: boolean;
}
```

### PulumicostReport (External)
The JSON structure returned by `pulumicost cost projected --json`.

```typescript
interface PulumicostReport {
  projected_monthly_cost: number;
  currency: string; // ISO 4217 3-letter code (e.g., "USD")
  diff?: {
    monthly_cost_change: number;
    percent_change: number;
  };
  resources: Array<{
    urn: string;
    monthly_cost: number;
  }>;
  // ... other fields from pulumicost schema
}
```

### CostAssessment
Internal representation of the analysis result for reporting/logic.

```typescript
interface CostAssessment {
  totalMonthlyCost: number;
  monthlyCostDiff: number;
  currency: string;
  reportPath: string;
  failedThreshold: boolean;
}
```

## Validation Rules

1.  **Threshold Parsing**: `threshold` string must match regex `^(\d+(\.\d{1,2})?)([A-Z]{3})$` (e.g., "50.00USD"). If invalid, log warning (per FR-005 clarification).
2.  **File Existence**: `pulumiPlanJsonPath` must exist before execution.
