# Quickstart: finfocus-action

## Usage

### Standard PR Comment Mode
Add this to your GitHub Actions workflow file (e.g., `.github/workflows/cost.yml`).

```yaml
jobs:
  cost-estimate:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write # Mandatory for commenting
    steps:
      - uses: actions/checkout@v4
      - name: Pulumi Preview
        run: pulumi preview --json > plan.json
      - uses: rshade/finfocus-action@v1
        with:
          pulumi-plan-json: plan.json
          github-token: ${{ secrets.GITHUB_TOKEN }}
          fail-on-cost-increase: "100USD"
```

### Analyzer Mode
Runs `pulumicost` as a policy pack integrated into the Pulumi engine.

```yaml
jobs:
  cost-policy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: rshade/finfocus-action@v1
        with:
          analyzer-mode: true
      - name: Pulumi Preview (Runs with analyzer)
        run: pulumi preview
```

## Development

1. Install dependencies: `npm install`
2. Build action: `npm run build` (compiles TS to `dist/index.js`)
3. Test logic: `npm test`
