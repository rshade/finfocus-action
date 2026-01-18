# finfocus-action Strategic Roadmap

> **Constitution**: See [CONTEXT.md](./CONTEXT.md) for architectural boundaries and design principles.

## Overview

finfocus-action provides cloud cost visibility and sustainability metrics in GitHub Pull Request comments. It wraps the [finfocus](https://github.com/rshade/finfocus) CLI to bring FinOps and GreenOps practices into the PR workflow.

## Completed Work

### v1.0.0 - Foundation (Done)

Initial release with core functionality:

- [x] #1 - GitHub Action scaffolding with TypeScript
- [x] Cross-platform binary installation (linux, macos, windows; amd64, arm64)
- [x] PR commenting engine with sticky comments (upsert behavior)
- [x] Basic cost guardrails (`fail-on-cost-increase` threshold)
- [x] Pulumi Analyzer integration mode (`analyzer-mode: true`)

### v1.1.0 - Enhanced Analysis (Done)

- [x] #15 - Cost optimization recommendations in PR comments
- [x] #16 - Historical cost tracking with `finfocus cost actual`
- [x] #17 - Sustainability/carbon footprint metrics (GreenOps)
- [x] Carbon guardrails (`fail-on-carbon-increase` threshold)
- [x] Environmental impact equivalents (trees, miles, electricity days)

## Current Focus

### v1.2.0 - Cost Governance & Filtering

Focus: Budget controls, filtering, and better cost breakdowns.

| Issue | Title | Status |
|-------|-------|--------|
| #18 | Budget thresholds and cost governance controls | Open |
| #20 | Resource filtering and grouping options | Open |

**Key deliverables:**

- Percentage-based thresholds (`fail-on-cost-increase: 20%`)
- Monthly budget limits with warning mode
- Budget override mechanism via PR labels
- Filter costs by resource type, tag, or provider
- Group-by options (provider, service, type, tag)
- Show-only-changes mode for focused PR comments

## Near-Term Vision

### v1.3.0 - Interoperability & Artifacts

Focus: Enable downstream integrations and data export.

| Issue | Title | Status |
|-------|-------|--------|
| #21 | JSON/artifact output for downstream processing | Open |

**Key deliverables:**

- Generate structured JSON reports with full metadata
- GitHub artifact upload for cost reports
- New outputs: `report-json`, `summary-json`, `recommendations-json`
- Support for NDJSON streaming format
- Workflow-consumable outputs for downstream jobs

### v1.4.0 - Forecasting & Trends

Focus: Predictive cost intelligence.

| Issue | Title | Status |
|-------|-------|--------|
| #19 | Cost forecasting and trend analysis | Open |

**Key deliverables:**

- Month-over-month growth rate calculation
- 3-month and 6-month cost projections
- Trend direction detection (increasing/decreasing/stable)
- Budget runway calculation
- ASCII sparkline visualization in PR comments

## Backlog / Icebox

Ideas not yet prioritized (require further research or upstream finfocus features):

### Developer Experience

- **Action UI / Job Summaries**: Rich visualization using GitHub Actions Job Summaries
- **Custom Templates**: User-provided Handlebars/Liquid templates for PR comments
- **Enhanced Caching**: Plugin and binary caching to reduce execution time

### Enterprise Features

- **Multi-Stack Support**: Analyze multiple Pulumi stacks in one run
- **Baseline Comparisons**: Compare against specific baseline files (not just preview state)
- **Compliance Reports**: Export to PDF/CSV for audit purposes
- **External Budget APIs**: Integration with AWS Budgets, Azure Cost Management

### Ecosystem

- **Monorepo Support**: Detect and analyze multiple projects
- **Slack/Teams Notifications**: Direct notifications beyond PR comments
- **FOCUS Standard**: Export in FinOps Open Cost and Usage Specification format (blocked on finfocus #382)

## Dependencies on finfocus CLI

Some roadmap items depend on upstream finfocus features:

| Roadmap Item | finfocus Dependency |
|--------------|---------------------|
| FOCUS format export | finfocus #382 (JSON-LD export) |
| Advanced forecasting | finfocus #364 (Cost Time Machine) |
| Per-provider budgets | finfocus #263 (Budget scoping) |
| Budget health | finfocus #267 (Budget health calculation) |

## Maintenance

### Ongoing

- [x] #4 - Dependency Dashboard (Renovate) - Automated dependency updates

## How to Contribute

1. Check [CONTEXT.md](./CONTEXT.md) to ensure your idea fits within boundaries
2. Open an issue describing the feature and use case
3. Reference this roadmap section in discussions
4. PRs welcome for items in "Current Focus" or "Near-Term Vision"
