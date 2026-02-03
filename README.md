# finfocus-action

[![Test](https://github.com/rshade/finfocus-action/actions/workflows/test.yml/badge.svg)](https://github.com/rshade/finfocus-action/actions/workflows/test.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

GitHub Action for integrating **[finfocus](https://github.com/rshade/finfocus)** into CI/CD workflows. It empowers developers to visualize, track, and enforce cloud cost estimates directly within their Pull Requests.

- 💰 **PR Cost Visibility**: Posts a sticky comment with cost estimates directly on your Pull Requests.
- 🌱 **Sustainability Impact**: Visualize the carbon footprint (CO2e) of your infrastructure changes.
- 🛡️ **Cost & Carbon Guardrails**: Automatically fail CI pipelines if cloud cost or carbon footprint increases exceed your defined thresholds.
- 🔍 **Pulumi Analyzer Mode**: Integrate deeply with the Pulumi engine for policy enforcement during `preview`.
- 🔌 **Plugin Support**: Support for various cloud providers and cost estimation plugins.

## Usage

### Standard Configuration (PR Commenter)

This mode runs after you've generated a Pulumi plan JSON. It parses the plan, calculates costs, and posts a comment to the PR.

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

To display actual (historical) cloud costs alongside your estimates, or to enable sustainability metrics, configure the following inputs.

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

Track your cloud spending against monthly, quarterly, or yearly budgets with automated alerts when thresholds are exceeded.

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

When configured, the PR comment will include a budget status section showing:

### Budget Health Suite (finfocus v0.2.5+)

The Budget Health Suite provides comprehensive budget monitoring with health scores, forecasting, and runway analysis. When enabled, the PR comment includes a TUI-style budget health display:

```text
╭────────────────────────────────────────────╮
│ BUDGET HEALTH                              │
│ ────────────────────────────────────────── │
│ Health Score: 🟢 85/100                    │
│ Budget: $2,000.00/monthly                  │
│ Spent: $1,234.56 (62%)                     │
│ Forecast: $1,890.00 (end of period)        │
│ Runway: 12 days remaining                  │
│                                            │
│ █████████████████████░░░░░░░░░ 62%         │
╰────────────────────────────────────────────╯
```

**Health Status Indicators:**

| Status | Icon | Health Score | Description |
| :----- | :--: | :----------- | :---------- |
| Healthy | 🟢 | 80-100 | Normal operation |
| Warning | 🟡 | 50-79 | Approaching limit |
| Critical | 🔴 | 1-49 | Budget concerns |
| Exceeded | ⛔ | 0 or spent > budget | Over budget |

**Budget Health Configuration:**

```yaml
- uses: rshade/finfocus-action@v1
  with:
    pulumi-plan-json: plan.json
    github-token: ${{ secrets.GITHUB_TOKEN }}
    budget-amount: 2000
    budget-currency: USD
    budget-period: monthly
    budget-alert-threshold: 80        # Trigger alert when usage exceeds 80%
    fail-on-budget-health: 50         # Fail build if health score drops below 50
    show-budget-forecast: true        # Show projected end-of-period spend
```

| Input | Description | Required | Default |
| :--- | :--- | :--- | :--- |
| `budget-alert-threshold` | Percentage threshold to trigger budget alert in PR comment. | No | `80` |
| `fail-on-budget-health` | Fail action if budget health score falls below this value (0-100). | No | `""` |
| `show-budget-forecast` | Display budget forecast in PR comment (`true`/`false`). | No | `true` |

**Budget Health Outputs:**

| Output | Description |
| :----- | :---------- |
| `budget-health-score` | Budget health score (0-100). |
| `budget-forecast` | Projected end-of-period spend (e.g., "$1,890.00"). |
| `budget-runway-days` | Days until budget exhausted at current rate. |
| `budget-status` | Budget health status: `healthy`, `warning`, `critical`, or `exceeded`. |

#### Example: Using Budget Health Outputs in Downstream Jobs

```yaml
jobs:
  cost-estimate:
    runs-on: ubuntu-latest
    outputs:
      health-score: ${{ steps.finfocus.outputs.budget-health-score }}
      status: ${{ steps.finfocus.outputs.budget-status }}
    steps:
      - uses: rshade/finfocus-action@v1
        id: finfocus
        with:
          pulumi-plan-json: plan.json
          github-token: ${{ secrets.GITHUB_TOKEN }}
          budget-amount: 2000

  notify:
    needs: cost-estimate
    runs-on: ubuntu-latest
    if: needs.cost-estimate.outputs.status == 'critical'
    steps:
      - run: |
          echo "Budget health is critical! Score: ${{ needs.cost-estimate.outputs.health-score }}"
          # Send notification to Slack, PagerDuty, etc.
```

### Budget Threshold Exit Codes (finfocus v0.2.5+)

When using finfocus v0.2.5 or higher with budget thresholds, the action interprets CLI exit codes for precise budget status:

| Exit Code | Status | Description |
| :-------- | :----- | :---------- |
| 0 | Pass | All budget thresholds passed |
| 1 | Warning | Approaching budget threshold |
| 2 | Critical | Budget threshold breached |
| 3 | Exceeded | Budget has been exceeded |

For older finfocus versions (< 0.2.5), the action falls back to JSON parsing for threshold checks, maintaining backward compatibility.

**Budget Status Display (when budget configured):**

- Current spend vs. budget
- Remaining budget
- Usage percentage with visual progress bar
- Triggered alert notifications

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
| `budget-health-score`    | Budget health score (0-100).                                      |
| `budget-forecast`        | Projected end-of-period spend.                                    |
| `budget-runway-days`     | Days until budget exhausted at current rate.                      |
| `budget-status`          | Budget health status: `healthy`, `warning`, `critical`, `exceeded`. |

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
