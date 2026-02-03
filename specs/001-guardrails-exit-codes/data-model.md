# Data Model: Guardrails Exit Code Refactor

**Feature**: 001-guardrails-exit-codes
**Date**: 2026-02-02

## Overview

This feature introduces minimal new types to support exit code-based threshold checking. The data model changes are additive and backward-compatible.

## New Types

### BudgetExitCode

Represents the exit codes returned by finfocus v0.2.5+ for budget threshold checks.

```typescript
/**
 * Exit codes returned by finfocus CLI for budget threshold checks.
 * Only applicable for finfocus v0.2.5 and above.
 */
export enum BudgetExitCode {
  /** All thresholds passed */
  PASS = 0,
  /** Warning threshold breached */
  WARNING = 1,
  /** Critical threshold breached */
  CRITICAL = 2,
  /** Budget exceeded */
  EXCEEDED = 3,
}
```

### BudgetThresholdResult

Result of a budget threshold check, abstracting whether exit codes or JSON parsing was used.

```typescript
/**
 * Result of a budget threshold check.
 */
export interface BudgetThresholdResult {
  /** Whether the threshold check passed */
  passed: boolean;
  /** Severity level if threshold was breached */
  severity: 'none' | 'warning' | 'critical' | 'exceeded';
  /** The exit code returned by finfocus (if exit code method used) */
  exitCode?: number;
  /** Human-readable message for the result */
  message: string;
}
```

## Modified Types

### ActionConfiguration (no changes needed)

The existing `ActionConfiguration` interface already has all necessary fields:

- `threshold: string | null` - The cost threshold input
- `finfocusVersion: string` - Used for version detection
- `debug: boolean` - Controls logging

No modifications required.

## Entity Relationships

```text
┌─────────────────────┐
│ ActionConfiguration │
│  - threshold        │
│  - finfocusVersion  │
│  - debug            │
└─────────┬───────────┘
          │
          │ used by
          ▼
┌─────────────────────┐     returns      ┌──────────────────────┐
│   guardrails.ts     │ ───────────────► │ BudgetThresholdResult│
│ checkBudgetThreshold│                  │  - passed            │
└─────────────────────┘                  │  - severity          │
          │                              │  - exitCode          │
          │ maps from                    │  - message           │
          ▼                              └──────────────────────┘
┌─────────────────────┐
│   BudgetExitCode    │
│  - PASS (0)         │
│  - WARNING (1)      │
│  - CRITICAL (2)     │
│  - EXCEEDED (3)     │
└─────────────────────┘
```

## Validation Rules

1. **Exit code range**: Only values 0-3 are valid exit codes for budget checks
2. **Severity mapping**: Each exit code maps to exactly one severity level
3. **Backward compatibility**: When exit codes are not available, severity is derived from JSON parsing with mapping:
   - No breach → 'none'
   - Any breach → 'exceeded' (legacy behavior treats all breaches equally)

## State Transitions

```text
                    ┌──────────────────────┐
                    │   Start Threshold    │
                    │       Check          │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │  Detect finfocus     │
                    │     version          │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
    version >= 0.2.5    version < 0.2.5   detection failed
              │                │                │
              ▼                ▼                ▼
    ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
    │ Use exit codes  │ │ Use JSON parsing│ │ Use JSON parsing│
    │ (new behavior)  │ │ (fallback)      │ │ (fallback)      │
    └────────┬────────┘ └────────┬────────┘ └────────┬────────┘
             │                   │                   │
             └───────────────────┼───────────────────┘
                                 │
                    ┌────────────▼───────────┐
                    │ Return BudgetThreshold │
                    │       Result           │
                    └────────────────────────┘
```
