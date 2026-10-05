# finfocus-action

[![Test](https://github.com/rshade/finfocus-action/actions/workflows/test.yml/badge.svg)](https://github.com/rshade/finfocus-action/actions/workflows/test.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

GitHub Action for integrating **[finfocus](https://github.com/rshade/finfocus)** into CI/CD
workflows. It empowers developers to visualize, track, and enforce cloud cost estimates directly
within their Pull Requests.

- 💰 **PR Cost Visibility**: Posts a sticky comment with cost estimates directly on your Pull Requests.
- 🌱 **Sustainability Impact**: Visualize the carbon footprint (CO2e) of your infrastructure changes.
- 🛡️ **Cost & Carbon Guardrails**: Automatically fail CI pipelines if cloud cost or carbon footprint
  increases exceed your defined thresholds.
- 🔍 **Pulumi Analyzer Mode**: Integrate deeply with the Pulumi engine for policy enforcement during
  `preview`.
- 🔌 **Plugin Support**: Support for various cloud providers and cost estimation plugins.

## Usage

### Standard Configuration (PR Commenter)

This mode runs after you've generated a Pulumi plan JSON. It parses the plan, calculates costs, and
posts a comment to the PR.

```yaml
- name: Generate Plan JSON
  run: pulumi preview --json > plan.json
  env:
    PULUMI_ACCESS_TOKEN: ${{ secrets.PULUMI_ACCESS_TOKEN }}

- uses: rshade/finfocus-action@v1
  with:
    pulumi-plan-json: plan.json
    github-token: ${{ secrets.GITHUB_TOKEN }}
    include-sustainability: true # Enable carbon footprint metrics
    fail-on-cost-increase: '100USD' # Fail if cost increase > $100
    fail-on-carbon-increase: '10kg' # Fail if carbon increase > 10kg
    install-plugins: aws-plugin
```

### Configuration with Actual Costs

To display actual (historical) cloud costs alongside your estimates, or to enable sustainability
metrics, configure the following inputs.

| Input | Description | Required | Default |
| :--- | :--- | :--- | :--- |
| `include-actual-costs` | Include actual/historical costs in PR comment (`true`/`false`). | No | `false` |
| `actual-costs-period` | Time period for actual costs: `7d`, `30d`, `mtd` (month-to-date), or custom `YYYY-MM-DD`. | No | `7d` |
| `actual-costs-group-by` | Group actual costs by: `resource`, `type`, `provider`, `daily`, `monthly`. | No | `provider` |
| `include-sustainability`| Include carbon footprint and sustainability metrics (`true`/`false`). | No | `true` |
| `utilization-rate` | Assumed utilization rate for sustainability calculations (0.0 to 1.0). | No | `1.0` |
| `sustainability-equivalents` | Show impact equivalents like trees, miles driven (`true`/`false`). | No | `true` |
| `fail-on-carbon-increase` | Threshold (e.g., "10%", "10kg") to fail if carbon footprint increases. | No | `""` |

### Budget Tracking

Track your cloud spending against monthly, quarterly, or yearly budgets with automated alerts when
thresholds are exceeded.

```yaml
- uses: rshade/finfocus-action@v1
  with:
    pulumi-plan-json: plan.json
    github-token: ${{ secrets.GITHUB_TOKEN }}
    budget-amount: 1000
    budget-currency: USD
    budget-period: monthly
    budget-alerts: '[{"threshold": 80, "type": "actual"}, {"threshold": 100, "type": "forecasted"}]'
```

| Input | Description | Required | Default |
| :--- | :--- | :--- | :--- |
| `budget-amount` | Budget amount for cost tracking (e.g., 1000). | No | `""` |
| `budget-currency` | Budget currency code (e.g., USD). | No | `USD` |
| `budget-period` | Budget period: `monthly`, `quarterly`, `yearly`. | No | `monthly` |
| `budget-alerts` | Budget alerts in JSON format with threshold and type. | No | `""` |

**Budget Alerts Format:**

```json
[
  {"threshold": 80, "type": "actual"},
  {"threshold": 100, "type": "forecasted"}
]
```

- `threshold`: Percentage of budget (0-100+)
- `type`: `actual` (current spend) or `forecasted` (projected spend)

When configured, the PR comment includes a budget status section showing current spend vs. budget,
remaining budget, usage percentage with a visual progress bar, and triggered alert notifications.

> **Note:** The budget health and scoped-budget features were removed because finfocus has no
> `budget status` command in v0.4.0. Budget enforcement works via `--exit-on-threshold` with the
> action-owned exit code 10, and the action writes the budget as `cost.budgets.global` to
> `~/.finfocus/config.yaml`.

**Removed inputs and outputs (breaking):**

The following inputs and outputs were removed because the `finfocus budget status`
command does not exist in finfocus v0.4.0:

**Removed Inputs:**

- `budget-alert-threshold` (was: percentage to trigger alert)
- `fail-on-budget-health` (was: fail if health score below threshold)
- `show-budget-forecast` (was: enable/disable forecast display)
- `budget-scopes` (was: scoped budget configuration)
- `fail-on-budget-scope-breach` (was: fail on scope breach)

**Removed Outputs:**

- `budget-health-score` (was: numeric health score 0-100)
- `budget-forecast` (was: projected end-of-period spend)
- `budget-runway-days` (was: days until exhaustion)
- `budget-status` (was: health status string)
- `budget-scopes-status` (was: scoped status array)

The action still supports budget tracking via `budget-amount`, `budget-currency`,
`budget-period`, and `budget-alerts` inputs, which are written to finfocus config
and enforced through `--exit-on-threshold`.

### Budget Threshold Exit Codes

finfocus v0.4.0 reserves exit codes 0 (success), 1 (`internal_error`) and 2
(`validation_error`, e.g. a bad plan path or flag). Because of this, the action
does not interpret finfocus exit codes as budget severities. Instead it runs
`finfocus cost projected --pulumi-json <plan> --exit-on-threshold --exit-code 10`:

| Exit Code | Meaning | Action behavior |
| :-------- | :------ | :-------------- |
| 0 | All budget thresholds passed | Continue |
| 10 | Budget threshold breached (code owned by the action) | Fail with "Budget exceeded" |
| 1, 2, other | The finfocus call itself failed | Fail with the `message` from the finfocus error envelope on stderr |

For older finfocus versions (< 0.2.5), the action falls back to JSON parsing for threshold checks,
maintaining backward compatibility.

### Terraform State Input (finfocus v0.4.0)

Non-Pulumi users can point the action at a Terraform state file instead of a
Pulumi plan. The action passes it to `finfocus cost projected
--terraform-state`, which is mutually exclusive with `--pulumi-json`:

```yaml
- uses: rshade/finfocus-action@v1
  with:
    terraform-state: terraform.tfstate
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

When both `terraform-state` and an existing Pulumi plan file are present, the
action warns and uses the Terraform state.

### What-If Cost Estimates

Estimate the cost of a single resource with specific properties — without changing any Pulumi
code — by setting the `estimate-spec` input. The action runs `finfocus cost estimate` in its
single-resource mode and adds a "What-If Cost Estimate" section to the PR comment showing the
baseline vs modified monthly cost and the per-property deltas.

```yaml
- uses: rshade/finfocus-action@v1
  with:
    pulumi-plan-json: plan.json
    github-token: ${{ secrets.GITHUB_TOKEN }}
    estimate-spec: >
      {"provider":"aws","resource_type":"aws:ec2/instance:Instance",
       "properties":{"instanceType":"m5.large"},"region":"us-east-1"}
```

| Input | Description | Required | Default |
| :--- | :--- | :--- | :--- |
| `estimate-spec` | JSON object with `provider` and `resource_type` (Pulumi type token), plus optional `properties` (string:string map) and `region`. Empty disables the feature. | No | `""` |

Invalid JSON or a spec missing `provider`/`resource_type` logs a warning and skips the estimate
without failing the action. The feature is tested against **finfocus v0.4.0**. The plan-based
`--modify` mode is not exposed: in v0.4.0 it cannot match Pulumi URNs (resource IDs contain
colons, which the modify parser splits on).

### Cluster costs (finfocus v0.4.0+)

`include-cluster-costs` runs `finfocus cost cluster` and adds a cluster section to the
PR comment. The runner needs a kubeconfig and the `kubernetes` plugin. Group with
`cluster-group-by`: `namespace` (default), `controller`, `pod`, `node`, `pulumi-stack`,
or `label:<key>`.

```yaml
- uses: rshade/finfocus-action@v1
  with:
    pulumi-plan-json: plan.json
    install-plugins: aws-public,kubernetes
    include-cluster-costs: true
    cluster-group-by: namespace
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

`cluster-namespace` limits the report to one namespace (idle is omitted).
`cluster-context` selects a kubeconfig context. `cluster-selector` is a
comma-separated list of `key=value` pod selectors. The output `cluster-total-cost`
is the monthly total.

### Jev recommendation scoring (finfocus v0.4.0+)

`enable-jev-scoring` writes this block to `~/.finfocus/config.yaml` and leaves
`--no-scoring` off the recommendations command:

```yaml
scoring:
  enabled: true
  plugin: jev
  identifier_mode: pseudonymized
```

Install the `jev` plugin and pass `TYPESAFE_API_KEY` as an environment variable.
The action does not put that key in an input or in the config file. Scores
(risk, worth acting) show up on the recommendation table. They rank work for
review. They do not dismiss a recommendation. An existing `scoring:` section in
the config file is left as it is.

```yaml
- uses: rshade/finfocus-action@v1
  env:
    TYPESAFE_API_KEY: ${{ secrets.TYPESAFE_API_KEY }}
  with:
    pulumi-plan-json: plan.json
    install-plugins: aws-public,jev
    enable-jev-scoring: true
```

### Dismissals and snoozes (finfocus v0.4.0+)

By default the action does not pass `--include-dismissed`, and it drops any
recommendation whose status is `Dismissed` or `Snoozed`. A PR comment does not
repeat them.

To record a dismissal or snooze on the runner before the comment is built:

```yaml
- uses: rshade/finfocus-action@v1
  with:
    pulumi-plan-json: plan.json
    dismiss-recommendations: >
      [{"id":"rec-123","reason":"business-constraint"}]
    snooze-recommendations: >
      [{"id":"rec-456","until":"2026-04-01","reason":"deferred"}]
```

Reasons are `not-applicable`, `already-implemented`, `business-constraint`,
`technical-constraint`, `deferred`, `inaccurate`, and `other`. `other` requires
`note`. `until` is `YYYY-MM-DD` or RFC3339. Set
`include-dismissed-recommendations: true` to show them anyway.

### State-only overview (finfocus v0.3.5+, tested on v0.4.0 and v0.4.3)

`--state-only` is a flag on `finfocus overview`, not on `cost projected`. It
skips `pulumi preview` and prices the exported stack state. Set `state-only`
and `pulumi-state-json`. The output `state-projected-monthly` is the overview
total. When no Pulumi plan and no Terraform state file exist, that total is
also the comment total. Recommendations are skipped in that case because
`cost recommendations` requires `--pulumi-json`.

```yaml
- uses: rshade/finfocus-action@v1
  with:
    state-only: true
    pulumi-state-json: state.json
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Plugin names

`install-plugins` is checked against `finfocus plugin list --available` after
the CLI is installed. `kubernetes` and `jev` are registry names as of finfocus
v0.4.0. A plugin that is not in the registry must be a `github.com/owner/repo`
specifier (optional `@version`).

### Plugin decline reasons (finfocus v0.4.0+)

When a plugin `Supports()` call declines a resource, finfocus puts the reason
in the resource `notes` field, for example
`(declined by kubernetes: type not served)`. The comment lists those notes
under **Plugin declines** instead of showing the resource as an unexplained $0.
Pricing errors in the report `errors` array stay in **Resources Not Priced**.

Pagination, NDJSON output, resource filtering, and cost forecasting are not
part of this action yet.

## Compatibility

The action is tested against **finfocus v0.4.0** (pinned) and **latest** on
every pull request and daily via the contract job in
`.github/workflows/test.yml`, which runs `scripts/contract.sh` against the real
released binaries. Latest at the time cluster costs, Jev scoring, dismissals,
and `overview --state-only` were added was **v0.4.3**. Those commands are also
present on the v0.4.0 release.

- `finfocus-version: latest` resolves to the newest stable CLI release matching
  `v<major>.<minor>.<patch>` (e.g., `v0.4.1`), excluding plugin releases
  (`kubernetes-*`, `jev-*`), prerelease, and draft tags. This may include
  breaking changes (for example, the v0.4.0 exit-code change where
  validation errors exit 2). Pin `finfocus-version` (e.g. `v0.4.0`) if you
  need a stable target.
- Budget threshold enforcement requires finfocus with `--exit-on-threshold`
  support (v0.2.5+; verified on v0.4.0). Older versions fall back to JSON
  parsing of the cost diff.

## Outputs

| Output                    | Description                                                       |
| :------------------------ | :---------------------------------------------------------------- |
| `total-monthly-cost`      | The absolute projected monthly cost.                              |
| `cost-diff`               | The difference in cost compared to the base state.                |
| `currency`                | The currency code (e.g., USD).                                    |
| `report-json-path`        | Path to the generated full JSON report.                           |
| `actual-total-cost`       | Total actual cost for the specified period.                       |
| `actual-cost-period`      | The date range for actual costs (e.g., 2025-01-01 to 2025-01-07). |
| `total-carbon-footprint`  | Total estimated CO2 emissions (kgCO2e/month).                     |
| `carbon-intensity`        | Carbon intensity per dollar spent (gCO2e/USD).                    |
| `budget-spent`            | Current budget spend amount.                                      |
| `budget-remaining`        | Remaining budget amount.                                          |
| `budget-percent-used`     | Percentage of budget used.                                        |
| `unpriced-resource-count` | Number of resources that could not be priced.                     |
| `cluster-total-cost`      | Monthly cluster cost when `include-cluster-costs` is true.        |
| `state-projected-monthly` | Projected monthly cost from `overview --state-only`.              |

### Unpriced Resources in PR Comments

When the finfocus report includes resources that could not be priced (e.g., due to
missing configuration or unsupported resource types), the action displays a
"Resources Not Priced" section in the PR comment. This collapsible section lists:

- Resource type
- Resource ID (short form)
- Plugin name that attempted to price it
- Error message

The section includes a note: *"These resources could not be priced and are not
included in the cost total above."* This helps users understand that the total
cost estimate may not include all resources in the plan.

## Release Workflow

Releases are automated via [release-please](https://github.com/googleapis/release-please-action).
The workflow has three jobs:

1. **release-please**: Creates or updates a release PR with version bumps and changelog
2. **update-dist**: When a release PR exists, checks out the PR branch, builds `dist/`, and commits
   it back. This ensures the compiled action is included in the release without creating orphaned
   commits
3. **update-tags**: After a release is published, updates the floating `v1` and `v1.x` tags so
   consumers using `@v1` get the latest release

### Prerequisites

A Personal Access Token (PAT) named `RELEASE_PLEASE_TOKEN` must be configured as a repository secret
with:

- `contents: write` permission
- `workflows` scope (required to push commits that modify workflow files)

### Important

Do not manually merge release PRs before the `update-dist` job completes. The job adds the compiled
`dist/` directory to the PR branch, and merging early would result in a release without the built
action.

## Development

```bash
# Install dependencies
npm install

# Build the action
npm run build

# Run tests
npm test
```

## License

Apache-2.0
