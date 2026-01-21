# finfocus-action Strategic Roadmap

> **Constitution**: See [CONTEXT.md](./CONTEXT.md) for architectural
> boundaries and design principles.

## Overview

finfocus-action provides cloud cost visibility and sustainability metrics in
GitHub Pull Request comments. It wraps the
[finfocus](https://github.com/rshade/finfocus) CLI to bring FinOps and GreenOps
practices into the PR workflow.

## Completed Work

### v1.0.0 - Foundation (January 2026)

Initial release with core functionality:

- [x] #1 - GitHub Action scaffolding with TypeScript
- [x] Cross-platform binary installation (linux, macos, windows; amd64, arm64)
- [x] PR commenting engine with sticky comments (upsert behavior)
- [x] Basic cost guardrails (`fail-on-cost-increase` threshold)
- [x] Pulumi Analyzer integration mode (`analyzer-mode: true`)
- [x] Plugin installation support (`install-plugins` input)
- [x] Provider breakdown in PR comments

### v1.1.0 - Enhanced Analysis (January 2026)

- [x] #15 - Cost optimization recommendations in PR comments
- [x] #16 - Historical cost tracking with `finfocus cost actual`
- [x] #17 - Sustainability/carbon footprint metrics (GreenOps)
- [x] Carbon guardrails (`fail-on-carbon-increase` threshold)
- [x] Environmental impact equivalents (trees, miles, electricity days)
- [x] Resource-level sustainability breakdown
- [x] TUI-style budget display with Unicode box-drawing characters

## Current Focus

### v1.2.0 - Cost Governance & Filtering

Focus: Budget controls, filtering, and better cost breakdowns.

| Issue | Title | Status | Priority |
|-------|-------|--------|----------|
| #18 | Budget thresholds and cost governance controls | Open | High |
| #20 | Resource filtering and grouping options | Open | High |

**Key deliverables:**

- Percentage-based thresholds (`fail-on-cost-increase: 20%`)
- Monthly budget limits with warning mode
- Budget override mechanism via PR labels
- Budget utilization tracking and alerts
- Filter costs by resource type, tag, or provider
- Group-by options (provider, service, type, tag)
- Show-only-changes mode for focused PR comments
- Min-cost threshold to hide low-value resources

**Technical Notes:**

- Budget tracking uses config delegation pattern (writes YAML, finfocus
  enforces)
- Filter syntax follows finfocus CLI conventions (`type=aws:ec2/*`,
  `tag:env=prod`)
- Grouping respects CONTEXT.md boundaries (no custom aggregation logic)

## Near-Term Vision

### v1.3.0 - Interoperability & Artifacts

Focus: Enable downstream integrations and data export.

| Issue | Title | Status | Priority |
|-------|-------|--------|----------|
| #21 | JSON/artifact output for downstream processing | Open | Medium |

**Key deliverables:**

- Generate structured JSON reports with full metadata
- GitHub artifact upload for cost reports
- New outputs: `report-json`, `summary-json`, `recommendations-json`,
  `sustainability-json`
- Support for NDJSON streaming format
- Workflow-consumable outputs for downstream jobs
- Artifact retention policy configuration

**Use Cases:**

- Feed cost data to Grafana, Datadog, or custom dashboards
- Store historical snapshots in S3, BigQuery, or databases
- Trigger PagerDuty/Slack alerts based on cost changes
- Integrate with FinOps platforms (Vantage, Kubecost, CloudHealth)

**Technical Notes:**

- Uses `@actions/artifact` for artifact upload
- JSON schema includes workflow metadata (PR, commit, branch, timestamp)
- Respects "no state persistence" boundary (artifacts are read-only outputs)

### v1.4.0 - Forecasting & Trends

Focus: Predictive cost intelligence.

| Issue | Title | Status | Priority |
|-------|-------|--------|----------|
| #19 | Cost forecasting and trend analysis | Open | Medium |

**Key deliverables:**

- Month-over-month growth rate calculation
- 3-month and 6-month cost projections
- Trend direction detection (increasing/decreasing/stable)
- Budget runway calculation (months until budget exceeded)
- ASCII sparkline visualization in PR comments
- Support for linear, exponential, and average growth models

**Dependencies:**

- Requires historical cost data (via `cost actual` or stored snapshots)
- Future: Will benefit from finfocus-core Cost Time Machine features (#364)

**Technical Notes:**

- Forecasts shown as estimates with accuracy disclaimers
- Budget runway integrates with v1.2.0 budget tracking
- Graceful handling when insufficient historical data available

## Backlog / Icebox

Ideas not yet prioritized (require further research or upstream finfocus
features):

### Developer Experience

- **Action UI / Job Summaries**: Rich visualization using GitHub Actions Job
  Summaries
- **Custom Templates**: User-provided Handlebars/Liquid templates for PR
  comments
- **Enhanced Caching**: Plugin and binary caching to reduce execution time
- **Parallel Analysis**: Concurrent analysis of multiple plan files
- **Diff Visualization**: Side-by-side cost comparison table

### Enterprise Features

- **Multi-Stack Support**: Analyze multiple Pulumi stacks in one run
- **Baseline Comparisons**: Compare against specific baseline files (not just
  preview state)
- **Compliance Reports**: Export to PDF/CSV for audit purposes
- **External Budget APIs**: Integration with AWS Budgets, Azure Cost Management
- **Team Attribution**: Cost allocation by team/owner tags
- **Approval Workflows**: Required cost review before merge

### Ecosystem

- **Monorepo Support**: Detect and analyze multiple projects
- **Slack/Teams Notifications**: Direct notifications beyond PR comments
- **FOCUS Standard**: Export in FinOps Open Cost and Usage Specification format
  (blocked on finfocus #382)
- **OpenCost Compatibility**: Mapping to OpenCost data model (blocked on
  finfocus #383)
- **GitLab CI Support**: Adapter for GitLab merge request comments (new
  project)

### Advanced Analytics

- **Anomaly Detection**: Flag unusual cost spikes or drops
- **What-If Scenarios**: Simulate cost impact of configuration changes
- **Resource Rightsizing**: Intelligent instance type recommendations
- **Commitment Analysis**: RI/savings plan utilization tracking

## Dependencies on finfocus CLI

Some roadmap items depend on upstream finfocus features:

| Roadmap Item | finfocus Dependency | Status |
|--------------|---------------------|--------|
| FOCUS format export | finfocus #382 (JSON-LD export) | Planned |
| Advanced forecasting | finfocus #364 (Cost Time Machine) | Planned v0.3.0 |
| Per-provider budgets | finfocus #263 (Budget scoping) | Planned v0.3.0 |
| Budget health | finfocus #267 (Budget health calculation) | Planned v0.3.0 |
| OpenCost mapping | finfocus #383 (OpenCost compatibility) | Planned |

## Maintenance

### Ongoing

- [x] #4 - Dependency Dashboard (Renovate) - Automated dependency updates
- Regular finfocus CLI version updates
- TypeScript/ESLint/Jest version compatibility
- GitHub Actions toolkit updates
- Security vulnerability monitoring

## Release Philosophy

**Versioning Strategy:**

- **Major (v2.0)**: Breaking changes to inputs/outputs or finfocus CLI
  compatibility
- **Minor (v1.x)**: New features, backward-compatible enhancements
- **Patch (v1.x.y)**: Bug fixes, dependency updates, documentation

**Release Cadence:**

- **Patch releases**: As needed for bug fixes and dependencies (Renovate
  automated)
- **Minor releases**: Monthly or when significant features complete
- **Major releases**: Coordinated with finfocus CLI breaking changes

## How to Contribute

1. Check [CONTEXT.md](./CONTEXT.md) to ensure your idea fits within boundaries
2. Open an issue describing the feature and use case
3. Reference this roadmap section in discussions
4. PRs welcome for items in "Current Focus" or "Near-Term Vision"
5. For "Backlog" items, discuss prioritization in issue comments

## Roadmap Sync

This roadmap is synchronized with GitHub issues and labels:

- `roadmap/current` - Items in "Current Focus" section
- `roadmap/next` - Items in "Near-Term Vision" section
- `roadmap/future` - Items in "Backlog / Icebox" section

Use `/roadmap sync` to update labels and detect discrepancies.

## Market Context

**Competitors:**

- [Infracost](https://www.infracost.io/) (Terraform, 1100+ resources, 2-second
  estimates)
- [Cloudcostify](https://github.com/Cloudcostify/pulumi-cost-estimation-cli)
  (Pulumi CLI competitor)

**Our Differentiation:**

- Pulumi-native with analyzer integration
- Sustainability-first (carbon footprint as primary feature)
- Plugin ecosystem for extensibility
- Budget tracking and governance controls
- Actual cost comparison (projected vs real spending)
