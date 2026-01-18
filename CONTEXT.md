# finfocus-action Context & Boundaries

## Core Architectural Identity

**finfocus-action** is a **GitHub Action** that provides cloud cost visibility and sustainability metrics in Pull Request comments. It is a **thin orchestration layer** that delegates all cost calculation, recommendation generation, and sustainability analysis to the [finfocus](https://github.com/rshade/finfocus) CLI tool.

The action's primary role is to:

1. Install and manage the finfocus binary
2. Execute finfocus commands with appropriate configuration
3. Format results as readable PR comments
4. Enforce cost and carbon guardrails

It is **not** a cost calculation engine, cloud billing adapter, or IaC tool - it is purely a GitHub Actions integration wrapper.

## Technical Boundaries ("Hard No's")

### What finfocus-action Does NOT Do

| Boundary | Rationale |
|----------|-----------|
| **Does NOT calculate costs** | All cost logic lives in finfocus CLI. Action only parses JSON output. |
| **Does NOT call cloud billing APIs** | Billing integration is handled by finfocus plugins (aws-public, kubecost, etc.) |
| **Does NOT modify infrastructure** | Read-only; never changes Pulumi state, IaC code, or cloud resources |
| **Does NOT persist historical data** | Each run is independent; no database, artifact storage, or state between runs |
| **Does NOT support non-GitHub CI** | Tightly coupled to GitHub Actions context, Octokit, and PR commenting |
| **Does NOT implement custom cost models** | Uses finfocus pricing data and algorithms exclusively |
| **Does NOT validate infrastructure correctness** | Only provides cost/sustainability visibility, not policy enforcement beyond thresholds |
| **Does NOT replace Pulumi CLI** | In analyzer mode, it *sets up* finfocus as an analyzer; Pulumi still runs the preview |

### Extension Philosophy

When a feature request would violate these boundaries:

1. **First choice**: Implement in [finfocus](https://github.com/rshade/finfocus) CLI
2. **Second choice**: Create a finfocus plugin for the capability
3. **Third choice**: Suggest a separate GitHub Action that composes with this one

## Data Source of Truth

| Data Type | Authoritative Source |
|-----------|---------------------|
| **Cost estimates** | finfocus CLI (`cost projected` output) |
| **Recommendations** | finfocus CLI (`cost recommendations` output) |
| **Actual costs** | finfocus CLI (`cost actual` output) via plugins |
| **Sustainability metrics** | finfocus CLI (resource-level `sustainability.carbon_footprint`) |
| **PR context** | GitHub Actions context (`github.context`) |
| **Configuration** | Action inputs (`core.getInput()`) |

## Interaction Model

### Inbound (Inputs)

```text
Workflow YAML → action.yml inputs → main.ts configuration
                                         ↓
                        Pulumi plan JSON (plan.json)
                        Pulumi state JSON (optional)
```

### Outbound (Outputs & Side Effects)

```text
main.ts → finfocus CLI execution → JSON parsing
            ↓
        PR Comment (via GitHub API)
        GitHub Action outputs (total-monthly-cost, etc.)
        GitHub Action status (pass/fail based on guardrails)
```

### External Dependencies

| Dependency | Type | Required |
|------------|------|----------|
| GitHub API | Runtime | Yes (if posting comments) |
| GitHub Releases (rshade/finfocus) | Download | Yes (binary installation) |
| finfocus CLI | Runtime | Yes |
| finfocus plugins | Runtime | Optional (for enhanced cost data) |
| Pulumi | Workflow | Yes (provides plan JSON) |

## Verification Checklist

Use this checklist when evaluating new feature proposals:

- [ ] Does the feature require calling cloud APIs directly? → **Violates boundary** (delegate to finfocus plugin)
- [ ] Does the feature require persisting data between runs? → **Violates boundary** (use external storage/artifacts)
- [ ] Does the feature modify infrastructure? → **Violates boundary** (out of scope)
- [ ] Does the feature implement cost calculation logic? → **Violates boundary** (belongs in finfocus CLI)
- [ ] Does the feature work only with GitHub Actions? → **OK** (expected coupling)
- [ ] Does the feature format or present finfocus output? → **OK** (core responsibility)
- [ ] Does the feature configure finfocus CLI behavior? → **OK** (orchestration role)

## Competitive Positioning

finfocus-action is similar to [Infracost](https://www.infracost.io/) but:

- **Pulumi-native**: Built specifically for Pulumi workflows (not Terraform)
- **Sustainability-first**: Carbon footprint metrics are a primary feature, not an afterthought
- **Plugin ecosystem**: Cost data sources are modular and extensible via finfocus plugins
- **Analyzer integration**: Can run as a Pulumi Policy Analyzer for deeper integration

## Version Compatibility

| Component | Minimum Version | Notes |
|-----------|-----------------|-------|
| Node.js | 20.x | ES2022 features required |
| finfocus CLI | 0.1.0+ | Sustainability metrics require 0.1.3+ |
| Pulumi | 3.x | Plan JSON format compatibility |
| GitHub Actions | N/A | Standard actions toolkit |
