# finfocus-action

GitHub Action for integrating [pulumicost-core](https://github.com/rshade/finfocus-action) into CI/CD workflows.

## Features

- **PR Cost Visibility**: Posts a sticky comment with cost estimates directly on your Pull Requests.
- **Cost Guardrails**: Automatically fail CI pipelines if cloud cost increases exceed your defined threshold.
- **Pulumi Analyzer Mode**: Integrate deeply with the Pulumi engine for policy enforcement.

## Usage

### Prerequisites

You need to generate a Pulumi plan JSON file before running this action.

```yaml
- name: Generate Plan JSON
  run: pulumi preview --json > plan.json
  env:
    PULUMI_ACCESS_TOKEN: ${{ secrets.PULUMI_ACCESS_TOKEN }}
```

### Standard Configuration

```yaml
- uses: rshade/finfocus-action@v1
  with:
    pulumi-plan-json: plan.json
    github-token: ${{ secrets.GITHUB_TOKEN }}
    fail-on-cost-increase: "100USD" # Fail if increase > $100
```

### Analyzer Mode

```yaml
- uses: rshade/finfocus-action@v1
  with:
    analyzer-mode: true

- name: Pulumi Preview (with analyzer)
  run: pulumi preview
```

## Inputs

| Input | Description | Required | Default |
| :--- | :--- | :---: | :---: |
| `pulumi-plan-json` | Path to the `pulumi preview --json` output. | Yes | `plan.json` |
| `github-token` | GitHub Token for posting comments. | No | `${{ github.token }}` |
| `pulumicost-version` | Version of `pulumicost` to install. | No | `latest` |
| `install-plugins` | List of plugins to install (comma-separated). | No | `""` |
| `behavior-on-error` | Behavior when error occurs (`fail`, `warn`, `silent`). | No | `fail` |
| `post-comment` | Whether to post a comment to the PR. | No | `true` |
| `fail-on-cost-increase` | Threshold string (e.g., "100USD") to fail build. | No | `""` |
| `analyzer-mode` | Enable Pulumi Analyzer integration. | No | `false` |

## Outputs

| Output | Description |
| :--- | :--- |
| `total-monthly-cost` | The absolute projected monthly cost. |
| `cost-diff` | The difference in cost compared to the base state. |
| `currency` | The currency code (e.g., USD). |
| `report-json-path` | Path to the generated full JSON report. |

## License

MIT
