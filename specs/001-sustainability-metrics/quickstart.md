# Quickstart: Sustainability Metrics

Enable carbon footprint estimation for your infrastructure changes.

## Prerequisites

- `pulumicost` v0.1.3 or higher (handled by action default `latest`).
- Cloud provider plugins that support sustainability data (e.g., `aws-public`).

## Configuration

Add the following inputs to your workflow step:

```yaml
- uses: rshade/finfocus-action@v1
  with:
    pulumi-plan-json: ./plan.json
    github-token: ${{ secrets.GITHUB_TOKEN }}
    # Enable sustainability metrics
    include-sustainability: true
    # Optional: Adjust utilization rate (default 1.0)
    utilization-rate: 0.8
    # Optional: Fail if carbon footprint increases by more than 10kg
    fail-on-carbon-increase: 10kg
```

## Output

The PR comment will now include a **Sustainability Impact** section:

> ### 🌱 Sustainability Impact
>
> | Metric | Value |
> | :--- | ---: |
> | **Carbon Footprint** | 125.5 kgCO₂e/month |
> | **Carbon Change** | +15.2 kgCO₂e/month |
> | **Carbon Intensity** | 2.95 gCO₂e/USD |
>
> <details>
> <summary>Environmental Equivalents</summary>
>
> - 🌲 Equivalent to planting **2.5 trees** annually to offset
> - 🚗 Equivalent to driving **312 miles** per month
> - 💡 Equivalent to **42 days** of home electricity use
> </details>

## Troubleshooting

- **No Data?**: Ensure your resource types are supported by the `pulumicost` sustainability engine.
- **Unexpected Values?**: Check your `utilization-rate`. Default is 100% (1.0), which may overestimate emissions for idle resources.
