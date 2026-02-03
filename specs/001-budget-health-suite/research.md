# Research: Budget Health Suite Integration

**Feature**: 001-budget-health-suite
**Date**: 2026-02-02

## Research Tasks

### 1. finfocus CLI Budget Status Command

**Question**: What is the exact JSON output format of `finfocus budget status --output json`?

**Decision**: Based on spec assumptions and finfocus v0.2.5 release notes, the expected format is:

```json
{
  "health_score": 85,
  "status": "healthy",
  "spent": 1234.56,
  "remaining": 765.44,
  "percent_used": 61.7,
  "forecast": 1890.00,
  "runway_days": 12,
  "budget": {
    "amount": 2000,
    "currency": "USD",
    "period": "monthly"
  }
}
```

**Rationale**: This structure aligns with the existing `BudgetStatus` interface in `types.ts` and adds the new health-specific fields.

**Alternatives Considered**:
- Flat structure without nested `budget` object - rejected for clarity
- Separate endpoints for health vs status - rejected for simplicity

### 2. Health Score Algorithm

**Question**: How should health score be calculated if finfocus CLI returns it vs local calculation?

**Decision**: Use finfocus CLI health_score when available (v0.2.5+), fall back to local calculation for older versions.

**Local Calculation Formula**:
```
score = max(0, 100 - (percent_used * 1.25))
```

With adjustments:
- If forecast exceeds budget: subtract additional 10 points
- If runway < 7 days: subtract additional 15 points
- Floor at 0, cap at 100

**Rationale**: Simple formula that matches documented finfocus behavior while providing backward compatibility.

**Alternatives Considered**:
- Always calculate locally - rejected to avoid divergence from CLI
- Require v0.2.5+ - rejected for backward compatibility

### 3. Status Thresholds

**Question**: What are the exact thresholds for status classification?

**Decision**: Use the following thresholds (consistent with spec):

| Status | Health Score Range | Condition |
|--------|-------------------|-----------|
| healthy | 80-100 | Normal operation |
| warning | 50-79 | Approaching limit |
| critical | 1-49 | Budget concerns |
| exceeded | 0 OR spent > budget | Over budget |

**Rationale**: These thresholds provide clear escalation path and match industry conventions for budget monitoring.

### 4. Version Detection Pattern

**Question**: How to detect finfocus version for feature gating?

**Decision**: Reuse existing pattern from `install.ts`:

```typescript
import { getFinfocusVersion, supportsExitCodes } from './install.js';

const version = await getFinfocusVersion();
const supportsBudgetHealth = supportsExitCodes(version); // v0.2.5+ check
```

**Rationale**: Code reuse, already tested, consistent with guardrails implementation.

### 5. Action Input/Output Naming

**Question**: What naming convention for new inputs/outputs?

**Decision**: Follow existing kebab-case pattern:

**Inputs**:
- `budget-alert-threshold` (number, default: 80)
- `fail-on-budget-health` (number, optional)
- `show-budget-forecast` (boolean, default: true)

**Outputs**:
- `budget-health-score` (number)
- `budget-forecast` (string, formatted currency)
- `budget-runway-days` (number)
- `budget-status` (string: healthy|warning|critical|exceeded)

**Rationale**: Consistent with existing inputs like `fail-on-cost-increase`, `budget-amount`, etc.

### 6. PR Comment Format

**Question**: How to display budget health in PR comments?

**Decision**: Enhance existing TUI box format with health metrics:

```
## Budget Health

╭────────────────────────────────────────────╮
│ BUDGET HEALTH                              │
│ ────────────────────────────────────────── │
│ Health Score: 🟢 85/100                    │
│ Budget: $2,000.00/monthly                  │
│ Spent: $1,234.56 (62%)                     │
│ Forecast: $1,890.00 (end of month)         │
│ Runway: 12 days remaining                  │
│                                            │
│ █████████████████████░░░░░░░░░ 62%         │
╰────────────────────────────────────────────╯
```

Visual indicators:
- 🟢 healthy (80+)
- 🟡 warning (50-79)
- 🔴 critical (<50)
- ⛔ exceeded

**Rationale**: Extends existing TUI box pattern from `formatBudgetSection()`, maintains visual consistency.

### 7. Graceful Degradation

**Question**: What to show when finfocus <0.2.5?

**Decision**: Show partial budget info using existing `calculateBudgetStatus()`:

- Display: spent, remaining, percent_used (existing)
- Omit: health_score, forecast, runway_days (new features)
- Log warning: "Budget health features require finfocus v0.2.5+"

**Rationale**: Maintains backward compatibility while encouraging upgrade.

### 8. Error Handling

**Question**: How to handle `finfocus budget status` failures?

**Decision**: Follow existing pattern from `runActualCosts()`:

1. If command fails: log warning, return undefined
2. If JSON parse fails: log warning, return undefined
3. If partial data: fill available fields, leave others undefined
4. Never fail the action due to budget status errors (unless `fail-on-budget-health` is set and threshold breached)

**Rationale**: Consistent with existing error handling, budget health is informational by default.

## Summary

All research questions resolved. Key decisions:
- Reuse existing version detection and calculation patterns
- Extend rather than replace existing budget infrastructure
- Graceful degradation for older finfocus versions
- TUI box format with visual health indicators
- Standard kebab-case naming for inputs/outputs
