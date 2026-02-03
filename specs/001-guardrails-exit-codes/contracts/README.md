# Contracts: Guardrails Exit Code Refactor

**Feature**: 001-guardrails-exit-codes

## Overview

This feature involves internal refactoring with no new external APIs or contracts. The changes are encapsulated within the action's internal modules.

## External Dependencies

### finfocus CLI Exit Code Contract

The action depends on finfocus CLI v0.2.5+ returning specific exit codes:

| Exit Code | Meaning |
|-----------|---------|
| 0 | All budget thresholds passed |
| 1 | Warning threshold breached |
| 2 | Critical threshold breached |
| 3 | Budget exceeded |

**Source**: finfocus/finfocus#496

## Internal Interfaces

### New Functions (guardrails.ts)

```typescript
/**
 * Check budget threshold using exit codes (v0.2.5+) or JSON fallback.
 */
export async function checkBudgetThreshold(
  config: ActionConfiguration,
): Promise<BudgetThresholdResult>;

/**
 * Get installed finfocus version.
 */
export async function getFinfocusVersion(): Promise<string>;

/**
 * Check if version supports exit codes.
 */
export function supportsExitCodes(version: string): boolean;
```

## Backward Compatibility

The existing `checkThreshold()` and `checkCarbonThreshold()` functions remain unchanged. The new `checkBudgetThreshold()` function is additive and will be used alongside existing guardrails.
