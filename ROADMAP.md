# finfocus-action Strategic Roadmap

> **Constitution**: See [CONTEXT.md](./CONTEXT.md) for architectural
> boundaries and design principles.

## Overview

finfocus-action provides cloud cost visibility and sustainability metrics in
GitHub Pull Request comments. It wraps the
[finfocus](https://github.com/rshade/finfocus) CLI to bring FinOps and GreenOps
practices into the PR workflow.

Shipped releases: v1.1.0 and v1.2.x (2026-Q1), v2.0.0 and v2.1.0 (2026-Q4).
The contract job verifies the action against finfocus v0.4.0, v0.4.3, and
v0.5.1.

## Immediate Focus

- [ ] #139 Let a PR label bypass the fail-on-* gates, with a recorded marker [L]

  The action is the only place a cost, budget, or carbon gate is actually
  enforced, so a sanctioned bypass belongs here rather than in the finfocus CLI
  (rshade/finfocus#365 was closed for that reason). A PR label is applied by
  someone with triage or write access, which is a different permission from
  editing the workflow, and it is re-checked on every run. This delivers the
  "budget override mechanism via PR labels" deliverable from the original
  v1.2.0 plan.

  - New inputs `bypass-label` (off by default) and `bypass-min-permission`
  - Evaluate all three gates, collect failures, then fail closed unless the
    labeling user meets the permission bar
  - One bypass marker rendered to the job log, step summary, PR comment, and
    outputs (`gate-bypassed`, `gate-bypass-actor`, `gate-failures`)
  - `behavior-on-error` failures are never bypassed

## Near-Term Vision

No issues are planned for the next release yet. Candidates come from Future
Vision below once they have an issue.

## Future Vision (Long-Term)

Ideas not yet prioritized. None has an issue yet; most need research or an
upstream finfocus feature first.

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
- **External Budget APIs**: Integration with AWS Budgets, Azure Cost
  Management. *Boundary: the action calls no cloud APIs; needs a finfocus
  plugin.*
- **Team Attribution**: Cost allocation by team/owner tags
- **Approval Workflows**: Required cost review before merge. *Boundary: the
  action does not approve PRs; use a required check plus the #139 bypass
  label.*

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

- **Anomaly Detection**: Flag unusual cost spikes or drops. *Boundary: needs
  history the action may not persist; source it from `cost actual`.*
- **What-If Scenarios**: Simulate cost impact of configuration changes.
  Single-resource estimates shipped in #89 (`estimate-spec`); plan-based
  `--modify` is not exposed
- **Resource Rightsizing**: Intelligent instance type recommendations.
  *Boundary: recommendation logic belongs in finfocus plugins; the action
  displays it.*
- **Commitment Analysis**: RI/savings plan utilization tracking. *Boundary:
  billing data comes through a finfocus plugin.*

## Completed Milestones

### 2026-Q4

- [x] #112 `docs`: README pins and what-if $0.00 baseline fixed.
  Closed 2026-10-22. [S]
- [x] #111 `sustainability`: carbon 1000x too high; carbon gate never fired.
  Closed 2026-10-22. [S]
- [x] #110 `guardrails`: fail-on-cost-increase value was ignored.
  Closed 2026-10-22. [M]
- [x] #109 `budget`: write budget to config.hujson so thresholds fire.
  Closed 2026-10-22. [M]
- [x] #88 `ci`: contract job runs action against real finfocus releases.
  Closed 2026-10-22. [M]
- [x] #87 `guardrails`: v0.4.0 exit codes no longer misread as breaches.
  Closed 2026-10-22. [M]
- [x] #86 `budget`: drop nonexistent `budget status` health and scoped budgets.
  Closed 2026-10-22. [M]
- [x] #49 `output`: NDJSON artifact format and display cap.
  Closed 2026-10-22. [M]
- [x] #21 `output`: JSON artifact output for downstream processing.
  Closed 2026-10-22. [M]
- [x] #19 `forecast`: cost forecasting and trend analysis.
  Closed 2026-10-22. [M]
- [x] #20 `display`: resource filtering and comment grouping options.
  Closed 2026-10-05. [M]
- [x] #89 `analyze`: expose finfocus v0.3.0-v0.4.0 features.
  Closed 2026-10-05. [L]
- [x] #76 `examples`: migrate finfocus-demo into examples (not planned).
  Closed 2026-10-03. [M]

### 2026-Q1

- [x] #58 `ci`: release-please changelog duplication and dist timing.
  Closed 2026-02-05. [S]
- [x] #47 `budget`: scoped budgets per provider, type, and tag.
  Closed 2026-02-04. [L]
- [x] #46 `budget`: budget health suite from finfocus v0.2.5.
  Closed 2026-02-03. [L]
- [x] #48 `guardrails`: finfocus native exit codes for budget thresholds.
  Closed 2026-02-03. [M]
- [x] #50 `docs`: roadmap dependency status for v0.2.5/v0.2.6.
  Closed 2026-02-02. [S]
- [x] #18 `budget`: budget thresholds and cost governance controls.
  Closed 2026-01-21. [L]
- [x] #17 `sustainability`: carbon footprint metrics (GreenOps).
  Closed 2026-01-14. [M]
- [x] #16 `analyze`: historical cost tracking with `cost actual`.
  Closed 2026-01-13. [M]
- [x] #15 `analyze`: cost optimization recommendations in PR comments.
  Closed 2026-01-13. [M]
- [x] #1 `action`: finfocus-action GitHub Action scaffolding.
  Closed 2026-01-09. [L]

## Boundary Safeguards

From [CONTEXT.md](./CONTEXT.md). A roadmap item that crosses one of these
belongs in the finfocus CLI or a plugin instead:

- Does NOT call cloud provider or billing APIs directly
- Does NOT implement cost calculation or carbon footprint logic
- Does NOT manage infrastructure or run Pulumi commands
- Does NOT persist state between runs (tool caching only)
- Does NOT enforce budgets itself: it writes config and finfocus enforces
- Does NOT approve or reject PRs: guardrails fail the workflow
- Does NOT provide custom pricing engines: extend through finfocus plugins

## Dependencies on finfocus CLI

Some roadmap items depend on upstream finfocus features:

| Roadmap Item | finfocus Issue | Status |
| --- | --- | --- |
| FOCUS format export | #382 JSON-LD export | Planned |
| OpenCost mapping | #383 OpenCost | Planned |
| Advanced forecasting | #364 Cost Time Machine | Available v0.2.5 (note 1) |
| Budget exit codes | #496 Native exit codes | Shipped (note 2) |
| NDJSON streaming | #488 NDJSON output | Shipped (#49) |
| Budget health | #267 Budget health | Removed in v0.4.0 (#86) |
| Per-provider budgets | #263 Budget scoping | Removed in v0.4.0 (#86) |

Issue numbers in this table are in the finfocus repository.

1. The action has no historical cost series, so its forecast growth rate is 0
   and every model holds the current monthly total.
2. The action passes `--exit-on-threshold --exit-code 10`; exit 10 is
   action-owned.

## Maintenance

### Ongoing

- Renovate Dependency Dashboard (#4) keeps dependencies current. It is excluded
  from roadmap tracking with `roadmap/exclude`.
- Regular finfocus CLI version updates, verified by the contract job
- TypeScript/ESLint/Jest version compatibility
- GitHub Actions toolkit updates
- Security vulnerability monitoring

## Release Philosophy

**Versioning Strategy:**

- **Major (v2.0)**: Breaking changes to inputs/outputs or finfocus CLI
  compatibility
- **Minor (v2.x)**: New features, backward-compatible enhancements
- **Patch (v2.x.y)**: Bug fixes, dependency updates, documentation

**Release Cadence:**

- **Patch releases**: As needed for bug fixes and dependencies (Renovate
  automated)
- **Minor releases**: Monthly or when significant features complete
- **Major releases**: Coordinated with finfocus CLI breaking changes

## How to Contribute

1. Check [CONTEXT.md](./CONTEXT.md) to ensure your idea fits within boundaries
2. Open an issue describing the feature and use case
3. Reference this roadmap section in discussions
4. PRs welcome for items in "Immediate Focus" or "Near-Term Vision"
5. For "Future Vision" items, discuss prioritization in issue comments

## Roadmap Sync

This roadmap is synchronized with GitHub issues and labels:

- `roadmap/current` - Items in "Immediate Focus"
- `roadmap/next` - Items in "Near-Term Vision"
- `roadmap/future` - Items in "Future Vision (Long-Term)"
- `roadmap/exclude` - Bot-managed or operational issues kept off the roadmap
- `effort/small`, `effort/medium`, `effort/large` - Level of effort, shown as
  `[S]`, `[M]`, `[L]`

Use `/roadmap sync` to update labels and detect discrepancies.

## Differentiation

- Pulumi-native with analyzer integration
- Sustainability-first (carbon footprint as primary feature)
- Plugin ecosystem for extensibility
- Budget tracking and governance controls
- Actual cost comparison (projected vs real spending)
