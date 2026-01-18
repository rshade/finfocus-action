# Quickstart: Cost Optimization Recommendations

**Date**: 2026-01-12

## Overview

The cost optimization recommendations feature adds optional cost-saving suggestions to your PR comments alongside cost estimates.

## Setup

1. Update your GitHub Actions workflow to include the new input:

```yaml
- uses: rshade/finfocus-action@main
  with:
    include-recommendations: true
```

## Usage

When enabled, the action will:

1. Run `finfocus cost recommendations` if the CLI is available
2. Parse the recommendations JSON
3. Display them in a table format in the PR comment

## Example Output

```
💡 Cost Optimization Recommendations

| Resource | Recommendation | Monthly Savings |
|----------|----------------|-----------------|
| test-instance | Migrate to t4g.micro | 1.46 USD |

**Potential Monthly Savings: 2.19 USD**
```

## Requirements

- finfocus CLI must be installed in the runner environment
- Pulumi plan JSON file must be available at `plan.json`
