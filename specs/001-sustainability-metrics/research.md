# Research: Sustainability Metrics

**Date**: 2026-01-13
**Feature**: Sustainability/Carbon Footprint Metrics

## 1. Input Configuration

**Decision**: Add 4 new inputs to `action.yml`.

- `include-sustainability`: (boolean, default false) Main toggle.
- `utilization-rate`: (string, default "1.0") Passed to CLI.
- `sustainability-equivalents`: (boolean, default true) UI toggle.
- `fail-on-carbon-increase`: (string, default "") Threshold logic.

**Rationale**:
- `include-sustainability` is off by default to avoid clutter for users who don't care.
- `utilization-rate` needs to be passed to the `pulumicost` CLI args to affect calculation *before* we get the JSON.
- `fail-on-carbon-increase` mirrors `fail-on-cost-increase` for consistency.

**Alternatives**:
- Passing utilization via env var? No, CLI flag is cleaner.
- Combining toggles? No, explicit is better.

## 2. Data Extraction (`pulumicost` Integration)

**Decision**: Parse `sustainability` field from `pulumicost` JSON output.

Based on issue description, `pulumicost` v0.1.3+ JSON output adds a `sustainability` object to resources:

```json
{
  "resources": [{
    "resourceType": "aws:ec2/instance:Instance",
    "monthly": 7.50,
    "sustainability": {
      "gCO2e": {"value": 12.5, "unit": "gCO2e/month"},
      "carbon_footprint": {"value": 12.5, "unit": "kgCO2e/month"}
    }
  }]
}
```

**Implementation**:
- Update `PulumicostResource` interface in `src/types.ts` to include optional `sustainability` field.
- Update `Analyzer.runAnalysis` to pass `--utilization` flag if configured.
- No extra parsing logic needed if `pulumicost` returns it in the main JSON; just type definition update.

## 3. Calculation & Display

**Decision**:
- **Total**: Sum `sustainability.carbon_footprint.value` from all resources.
- **Diff**: Calculate manually if `pulumicost` doesn't provide it in summary diff (likely need to sum for "base" state if available, or just show absolute if diff not supported by CLI yet). *Assumption*: CLI might not give diff for carbon yet, so we might only show absolute values for V1, or try to calculate if we have base plan.
    - *Correction*: The issue says "Display carbon footprint in PR comment with change comparison". If `pulumicost` provides a diff in the JSON, we use it. If not, we might be limited to absolute. The JSON example shows resource-level data. The text mentions "Carbon Change +15.2". We will look for a diff field or calculate it if possible.
- **Equivalents**: Calculate in `src/formatter.ts` using the totals.

**Equivalency Formulas (from spec)**:
- Trees: `kgCO2e * 12 / 22`
- Miles: `kgCO2e / 0.4`
- Electricity: `kgCO2e / (30 * 0.42)`

## 4. Threshold Logic

**Decision**: Implement in `src/guardrails.ts` (or similar logic where `fail-on-cost-increase` lives).

- New function `checkCarbonThreshold(diff: number, threshold: string)`.
- If `threshold` is percent (e.g. "10%"), compare to base.
- If `threshold` is absolute (e.g. "10kg"), compare absolute diff.

## 5. Unknowns Resolved

- **JSON Structure**: Confirmed from issue description (mock).
- **Existing Code**: `src/analyze.ts` runs the command. `src/types.ts` defines interfaces. `src/comment.ts` / `src/formatter.ts` handles display.
- **Inputs**: Defined in `action.yml`.

## 6. Architecture Update

- **Analyzer**: Update `runAnalysis` args.
- **Types**: Add `SustainabilityMetrics` interface.
- **Formatter**: Add `formatSustainabilitySection`.
- **Main**: Wire up inputs to config.
