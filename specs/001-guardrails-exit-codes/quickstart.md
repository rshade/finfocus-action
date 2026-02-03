# Quickstart: Guardrails Exit Code Refactor

**Feature**: 001-guardrails-exit-codes
**Date**: 2026-02-02

## Overview

This guide covers the implementation of exit code-based budget threshold checking in finfocus-action. After this refactor, the action will use finfocus CLI exit codes (v0.2.5+) to determine budget threshold breaches instead of parsing JSON output.

## Prerequisites

- Node.js 20+
- npm
- finfocus CLI (for local testing)

## Development Setup

```bash
# Clone and install
git checkout 001-guardrails-exit-codes
npm install

# Run tests
npm test

# Build
npm run build
```

## Key Files to Modify

| File | Changes |
|------|---------|
| `src/guardrails.ts` | Add `checkBudgetThreshold()` function with exit code handling |
| `src/types.ts` | Add `BudgetExitCode` enum and `BudgetThresholdResult` interface |
| `src/install.ts` | Add `getFinfocusVersion()` helper method |
| `src/main.ts` | Update guardrails invocation to use new function |
| `__tests__/unit/guardrails.test.ts` | Add tests for exit code scenarios |

## Implementation Steps

### 1. Add Types (types.ts)

```typescript
export enum BudgetExitCode {
  PASS = 0,
  WARNING = 1,
  CRITICAL = 2,
  EXCEEDED = 3,
}

export interface BudgetThresholdResult {
  passed: boolean;
  severity: 'none' | 'warning' | 'critical' | 'exceeded';
  exitCode?: number;
  message: string;
}
```

### 2. Add Version Detection (install.ts or new version.ts)

```typescript
export async function getFinfocusVersion(): Promise<string> {
  const output = await exec.getExecOutput('finfocus', ['--version'], {
    ignoreReturnCode: true,
    silent: true,
  });
  const match = output.stdout.match(/v?(\d+\.\d+\.\d+)/);
  return match ? match[1] : '0.0.0';
}

export function supportsExitCodes(version: string): boolean {
  const [major, minor, patch] = version.split('.').map(Number);
  return major > 0 || (major === 0 && (minor > 2 || (minor === 2 && patch >= 5)));
}
```

### 3. Refactor Guardrails (guardrails.ts)

```typescript
export async function checkBudgetThreshold(
  config: ActionConfiguration,
  report: FinfocusReport,
): Promise<BudgetThresholdResult> {
  const version = await getFinfocusVersion();

  // Handle version detection failure (returns '0.0.0' sentinel)
  if (version === '0.0.0') {
    core.warning('Could not detect finfocus version, falling back to JSON parsing');
    return checkBudgetThresholdWithJson(config, report);
  }

  if (supportsExitCodes(version)) {
    return checkBudgetThresholdWithExitCodes(config);
  }

  // Fallback to existing JSON parsing for older versions
  return checkBudgetThresholdWithJson(config, report);
}

async function checkBudgetThresholdWithExitCodes(
  config: ActionConfiguration,
): Promise<BudgetThresholdResult> {
  const result = await exec.getExecOutput('finfocus', ['cost', 'projected', config.pulumiPlanJsonPath], {
    ignoreReturnCode: true,
  });

  switch (result.exitCode) {
    case BudgetExitCode.PASS:
      return { passed: true, severity: 'none', exitCode: 0, message: 'Budget thresholds passed' };
    case BudgetExitCode.WARNING:
      return { passed: false, severity: 'warning', exitCode: 1, message: 'Warning threshold breached' };
    case BudgetExitCode.CRITICAL:
      return { passed: false, severity: 'critical', exitCode: 2, message: 'Critical threshold breached' };
    case BudgetExitCode.EXCEEDED:
      return { passed: false, severity: 'exceeded', exitCode: 3, message: 'Budget exceeded' };
    default:
      throw new Error(`Unexpected finfocus exit code: ${result.exitCode}`);
  }
}
```

### 4. Update Main (main.ts)

```typescript
// In the guardrails section
if (config.threshold) {
  const result = await checkBudgetThreshold(config, report);
  if (!result.passed) {
    throw new Error(`${result.message} (exit code: ${result.exitCode})`);
  }
}
```

## Testing

### Unit Tests

```typescript
describe('checkBudgetThreshold with exit codes', () => {
  it('should pass when exit code is 0', async () => {
    mockExec.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });
    const result = await checkBudgetThresholdWithExitCodes(config);
    expect(result.passed).toBe(true);
    expect(result.severity).toBe('none');
  });

  it('should fail with warning when exit code is 1', async () => {
    mockExec.mockResolvedValue({ exitCode: 1, stdout: '', stderr: '' });
    const result = await checkBudgetThresholdWithExitCodes(config);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('warning');
  });

  // ... similar tests for exit codes 2, 3, and unexpected codes
});
```

### Manual Testing

```bash
# Test with a Pulumi plan that exceeds budget
export INPUT_PULUMI_PLAN_JSON=./test-fixtures/over-budget-plan.json
export INPUT_FAIL_ON_COST_INCREASE=100USD
npm run build && node dist/index.js
```

## Verification Checklist

- [ ] Exit code 0 → action passes
- [ ] Exit code 1 → action fails with "Warning threshold breached"
- [ ] Exit code 2 → action fails with "Critical threshold breached"
- [ ] Exit code 3 → action fails with "Budget exceeded"
- [ ] Old finfocus version → falls back to JSON parsing
- [ ] Version detection failure → falls back to JSON parsing
- [ ] All existing tests pass
- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes
