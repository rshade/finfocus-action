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

## Compatibility

The action is tested against **finfocus v0.4.0** (pinned) and **latest** on
every pull request and daily via the contract job in
`.github/workflows/test.yml`, which runs `scripts/contract.sh` against the real
released binaries.

- `finfocus-version: latest` follows the newest finfocus release, **including
  breaking changes** (for example, the v0.4.0 exit-code change where
  validation errors exit 2). Pin `finfocus-version` (e.g. `v0.4.0`) if you
  need a stable target.
- Budget threshold enforcement requires finfocus with `--exit-on-threshold`
  support (v0.2.5+; verified on v0.4.0). Older versions fall back to JSON
  parsing of the cost diff.

## Outputs

| Output                   | Description                                                       |
| :----------------------- | :---------------------------------------------------------------- |
| `total-monthly-cost`     | The absolute projected monthly cost.                              |
| `cost-diff`              | The difference in cost compared to the base state.                |
| `currency`               | The currency code (e.g., USD).                                    |
| `report-json-path`       | Path to the generated full JSON report.                           |
| `actual-total-cost`      | Total actual cost for the specified period.                       |
| `actual-cost-period`     | The date range for actual costs (e.g., 2025-01-01 to 2025-01-07). |
| `total-carbon-footprint` | Total estimated CO2 emissions (kgCO2e/month).                     |
| `carbon-intensity`       | Carbon intensity per dollar spent (gCO2e/USD).                    |
| `budget-spent`           | Current budget spend amount.                                      |
| `budget-remaining`       | Remaining budget amount.                                          |
| `budget-percent-used`    | Percentage of budget used.                                        |

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
