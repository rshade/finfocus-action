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

### Budget Threshold Exit Codes (finfocus v0.2.5+)

When using finfocus v0.2.5 or higher with budget thresholds, the action interprets CLI exit codes for precise budget status:

| Exit Code | Status | Description |
| :-------- | :----- | :---------- |
| 0 | Pass | All budget thresholds passed |
| 1 | Warning | Approaching budget threshold |
| 2 | Critical | Budget threshold breached |
| 3 | Exceeded | Budget has been exceeded |

For older finfocus versions (< 0.2.5), the action falls back to JSON parsing for threshold checks, maintaining backward compatibility.

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
