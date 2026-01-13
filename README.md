# finfocus-action

[![Test](https://github.com/rshade/finfocus-action/actions/workflows/test.yml/badge.svg)](https://github.com/rshade/finfocus-action/actions/workflows/test.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

GitHub Action for integrating **[pulumicost-core](https://github.com/rshade/pulumicost-core)** into CI/CD workflows. It empowers developers to visualize, track, and enforce cloud cost estimates directly within their Pull Requests.

## Features

- 💰 **PR Cost Visibility**: Posts a sticky comment with cost estimates directly on your Pull Requests.
- 🛡️ **Cost Guardrails**: Automatically fail CI pipelines if cloud cost increases exceed your defined threshold.
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
    install-plugins: |
      aws-plugin
      kubecost
    fail-on-cost-increase: "100USD" # Fail if increase > $100
```

### Analyzer Mode

In this mode, the action sets up `pulumicost` as a [Pulumi Analyzer](https://www.pulumi.com/docs/concepts/config/analyzers/). Subsequent `pulumi preview` commands will automatically trigger cost estimation.

```yaml
- uses: rshade/finfocus-action@v1
  with:
    analyzer-mode: true
    install-plugins: aws-plugin

- name: Pulumi Preview (with analyzer)
  run: pulumi preview
  env:
    PULUMI_ACCESS_TOKEN: ${{ secrets.PULUMI_ACCESS_TOKEN }}
```

## Inputs

| Input | Description | Required | Default |
| :--- | :--- | :---: | :---: |
| `pulumi-plan-json` | Path to the `pulumi preview --json` output. | Yes | `plan.json` |
| `github-token` | GitHub Token for posting comments. | No | `${{ github.token }}` |
| `pulumicost-version` | Version of `pulumicost` to install. | No | `latest` |
| `install-plugins` | List of plugins to install. Supports comma-separated or multiline. | No | `""` |
| `behavior-on-error` | Behavior when error occurs (`fail`, `warn`, `silent`). | No | `fail` |
| `post-comment` | Whether to post a comment to the PR. | No | `true` |
| `fail-on-cost-increase` | Threshold string (e.g., "100USD") to fail build if diff exceeds. | No | `""` |
| `analyzer-mode` | Enable Pulumi Analyzer integration. | No | `false` |

## Outputs

| Output | Description |
| :--- | :--- |
| `total-monthly-cost` | The absolute projected monthly cost. |
| `cost-diff` | The difference in cost compared to the base state. |
| `currency` | The currency code (e.g., USD). |
| `report-json-path` | Path to the generated full JSON report. |

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