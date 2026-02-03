# Quickstart: Budget Health Suite

**Feature**: 001-budget-health-suite
**Date**: 2026-02-02

## Overview

This guide covers implementing the budget health suite integration for finfocus-action.

## Prerequisites

- Node.js 24+
- npm
- finfocus CLI v0.2.5+ (for full health features)
- Existing finfocus-action codebase

## Implementation Steps

### Step 1: Extend Types (types.ts)

Add the new interfaces:

```typescript
// Add to types.ts

export type BudgetHealthStatus = 'healthy' | 'warning' | 'critical' | 'exceeded';

export interface BudgetHealthReport extends BudgetStatus {
  healthScore?: number;
  forecast?: string;
  forecastAmount?: number;
  runwayDays?: number;
  healthStatus: BudgetHealthStatus;
}

// Extend ActionConfiguration
export interface ActionConfiguration {
  // ... existing fields ...
  budgetAlertThreshold?: number;
  failOnBudgetHealth?: number;
  showBudgetForecast?: boolean;
}
```

### Step 2: Add CLI Integration (analyze.ts)

Add the `runBudgetStatus` method:

```typescript
async runBudgetStatus(config: ActionConfiguration): Promise<BudgetHealthReport | undefined> {
  // Check if budget is configured
  if (!config.budgetAmount || config.budgetAmount <= 0) {
    return undefined;
  }

  // Check finfocus version
  const version = await getFinfocusVersion();
  if (!supportsExitCodes(version)) {
    core.warning('Budget health features require finfocus v0.2.5+');
    return this.calculateBudgetHealthFallback(config);
  }

  // Run finfocus budget status
  const args = ['budget', 'status', '--output', 'json'];
  const output = await exec.getExecOutput('finfocus', args, {
    silent: !config.debug,
    ignoreReturnCode: true,
  });

  if (output.exitCode !== 0) {
    core.warning(`finfocus budget status failed: ${output.stderr}`);
    return this.calculateBudgetHealthFallback(config);
  }

  return this.parseBudgetStatusResponse(output.stdout, config);
}
```

### Step 3: Update Formatter (formatter.ts)

Enhance `formatBudgetSection`:

```typescript
function formatBudgetHealthSection(
  budgetHealth: BudgetHealthReport,
  config?: ActionConfiguration
): string {
  const statusIcon = {
    healthy: '🟢',
    warning: '🟡',
    critical: '🔴',
    exceeded: '⛔',
  }[budgetHealth.healthStatus];

  const lines: string[] = [
    'BUDGET HEALTH',
    '────────────────────────────────────────',
    `Health Score: ${statusIcon} ${budgetHealth.healthScore ?? 'N/A'}/100`,
    `Budget: ${formatCurrency(budgetHealth.amount)}/${budgetHealth.period}`,
    `Spent: ${formatCurrency(budgetHealth.spent)} (${budgetHealth.percentUsed?.toFixed(0)}%)`,
  ];

  if (config?.showBudgetForecast !== false && budgetHealth.forecast) {
    lines.push(`Forecast: ${budgetHealth.forecast} (end of period)`);
  }

  if (budgetHealth.runwayDays !== undefined) {
    const runwayText = budgetHealth.runwayDays === Infinity
      ? 'Unlimited'
      : `${budgetHealth.runwayDays} days remaining`;
    lines.push(`Runway: ${runwayText}`);
  }

  // Progress bar
  const progressBar = generateTUIProgressBar(budgetHealth.percentUsed ?? 0);
  lines.push('');
  lines.push(`${progressBar} ${(budgetHealth.percentUsed ?? 0).toFixed(0)}%`);

  return '\n```\n' + createTUIBox(lines) + '\n```\n';
}
```

### Step 4: Add Guardrail (guardrails.ts)

```typescript
export function checkBudgetHealthThreshold(
  config: ActionConfiguration,
  budgetHealth: BudgetHealthReport
): BudgetThresholdResult {
  if (!config.failOnBudgetHealth) {
    return { passed: true, severity: 'none', message: 'No health threshold configured' };
  }

  const score = budgetHealth.healthScore ?? 0;

  if (score < config.failOnBudgetHealth) {
    return {
      passed: false,
      severity: budgetHealth.healthStatus === 'exceeded' ? 'exceeded' : 'critical',
      message: `Budget health score ${score} is below threshold ${config.failOnBudgetHealth}`,
    };
  }

  return {
    passed: true,
    severity: 'none',
    message: `Budget health score ${score} meets threshold ${config.failOnBudgetHealth}`,
  };
}
```

### Step 5: Update action.yml

Add new inputs and outputs:

```yaml
inputs:
  budget-alert-threshold:
    description: 'Percentage threshold to trigger budget alert'
    required: false
    default: '80'
  fail-on-budget-health:
    description: 'Fail if budget health score falls below this value (0-100)'
    required: false
    default: ''
  show-budget-forecast:
    description: 'Display budget forecast in PR comment'
    required: false
    default: 'true'

outputs:
  budget-health-score:
    description: 'Budget health score (0-100)'
  budget-forecast:
    description: 'Projected end-of-period spend'
  budget-runway-days:
    description: 'Days until budget exhausted'
  budget-status:
    description: 'healthy | warning | critical | exceeded'
```

### Step 6: Update main.ts

Integrate budget health into the orchestration flow:

```typescript
// After existing budget status calculation
let budgetHealth: BudgetHealthReport | undefined;
if (config.budgetAmount && config.budgetAmount > 0) {
  core.startGroup('📊 Running budget health analysis');
  budgetHealth = await analyzer.runBudgetStatus(config);

  if (budgetHealth) {
    core.setOutput('budget-health-score', budgetHealth.healthScore?.toString() ?? '');
    core.setOutput('budget-forecast', budgetHealth.forecast ?? '');
    core.setOutput('budget-runway-days', budgetHealth.runwayDays?.toString() ?? '');
    core.setOutput('budget-status', budgetHealth.healthStatus);
  }
  core.endGroup();
}

// Pass to commenter
await commenter.upsertComment(report, token, config, ..., budgetHealth);

// Check health threshold
if (config.failOnBudgetHealth && budgetHealth) {
  const healthResult = checkBudgetHealthThreshold(config, budgetHealth);
  if (!healthResult.passed) {
    throw new Error(healthResult.message);
  }
}
```

## Testing

### Unit Tests

```bash
npm test -- __tests__/unit/budget-health.test.ts
```

Key test cases:
1. Health score calculation with various percent_used values
2. Status classification at boundary values (49/50, 79/80)
3. Exceeded status when spent > budget
4. Fallback behavior for finfocus < 0.2.5
5. Guardrail threshold checking

### Integration Tests

```bash
npm test -- __tests__/integration/budget-health.test.ts
```

Key test cases:
1. Full flow with mock finfocus CLI
2. PR comment formatting verification
3. Output values verification
4. Error handling for CLI failures

## Build & Verify

```bash
npm run lint
npm test
npm run build
```

Verify `dist/index.js` is updated before committing.
