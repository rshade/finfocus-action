import {
  PulumicostReport,
  ActionConfiguration,
  RecommendationsReport,
  ActualCostReport,
  SustainabilityReport,
  EquivalencyMetrics,
} from './types.js';

export function calculateEquivalents(totalCO2e: number): EquivalencyMetrics {
  // Trees: 1 tree absorbs ~22 kg CO₂/year -> kgCO2e * 12 / 22
  const trees = (totalCO2e * 12) / 22;

  // Miles driven: ~0.4 kg CO₂/mile -> kgCO2e / 0.4
  const milesDriven = totalCO2e / 0.4;

  // Home electricity: ~0.42 kg CO₂/kWh, avg home uses ~30 kWh/day -> kgCO2e / (30 * 0.42)
  const homeElectricityDays = totalCO2e / (30 * 0.42);

  return {
    trees,
    milesDriven,
    homeElectricityDays,
  };
}

function formatSustainabilitySection(
  report: SustainabilityReport,
  config?: ActionConfiguration,
  pulumicostReport?: PulumicostReport,
): string {
  if (!config?.includeSustainability) return '';

  const { totalCO2e, totalCO2eDiff, carbonIntensity } = report;
  const equivalents = config.sustainabilityEquivalents ? calculateEquivalents(totalCO2e) : undefined;

  let diffText = `${totalCO2eDiff.toFixed(2)} kgCO₂e/month`;
  if (totalCO2eDiff > 0) diffText = `+${diffText}`;

  let equivalentsSection = '';
  if (equivalents) {
    equivalentsSection = `
<details>
<summary>Environmental Equivalents</summary>

- 🌲 Equivalent to planting **${equivalents.trees.toFixed(2)} trees** annually to offset
- 🚗 Equivalent to driving **${equivalents.milesDriven.toFixed(2)} miles** per month
- 💡 Equivalent to **${equivalents.homeElectricityDays.toFixed(2)} days** of home electricity use
</details>
`;
  }

  // Build Resource Breakdown by Carbon Impact
  let resourceTable = '';
  const resources = pulumicostReport?.resources ?? pulumicostReport?.summary?.resources ?? [];
  
  if (resources.length > 0) {
    const resourcesWithCarbon = resources
      .filter(r => r.sustainability?.carbon_footprint?.value && r.sustainability.carbon_footprint.value > 0)
      .sort((a, b) => (b.sustainability!.carbon_footprint.value) - (a.sustainability!.carbon_footprint.value));

    if (resourcesWithCarbon.length > 0) {
      const resourceRows = resourcesWithCarbon
        .slice(0, 10) // Top 10 by carbon
        .map((r) => {
          const name = r.resourceId.split('::').pop() || r.resourceId;
          const carbon = r.sustainability!.carbon_footprint.value.toFixed(2);
          const unit = r.sustainability!.carbon_footprint.unit;
          return `| ${name} | ${r.resourceType} | ${carbon} ${unit} |`;
        })
        .join('\n');

      if (resourceRows) {
        resourceTable = `
### Resources by Carbon Impact

| Resource | Type | CO₂/month |
| :--- | :--- | ---: |
${resourceRows}
`;
      }
    }
  }

  return `
### 🌱 Sustainability Impact

| Metric | Value |
| :--- | ---: |
| **Carbon Footprint** | ${totalCO2e.toFixed(2)} kgCO₂e/month |
| **Carbon Change** | ${diffText} |
| **Carbon Intensity** | ${carbonIntensity.toFixed(2)} gCO₂e/USD |
${equivalentsSection}${resourceTable}
`;
}

export function formatCommentBody(
  report: PulumicostReport,
  config?: ActionConfiguration,
  recommendationsReport?: RecommendationsReport,
  actualCostReport?: ActualCostReport,
  sustainabilityReport?: SustainabilityReport,
): string {
  // Handle both new and legacy report formats
  const currency = report.summary?.currency ?? report.currency ?? 'USD';
  const totalMonthly = report.summary?.totalMonthly ?? report.projected_monthly_cost ?? 0;
  const total = totalMonthly.toFixed(2);

  const diff = report.diff ? report.diff.monthly_cost_change.toFixed(2) : '0.00';
  const percent = report.diff ? report.diff.percent_change.toFixed(2) : '0.00';

  let diffText = `${diff} ${currency}`;
  if (report.diff) {
    if (report.diff.monthly_cost_change > 0) {
      diffText = `📈 +${diffText}`;
    } else if (report.diff.monthly_cost_change < 0) {
      diffText = `📉 ${diffText}`;
    }
  }

  // Build resource breakdown if available
  const resources = report.resources ?? report.summary?.resources ?? [];
  let resourceTable = '';

  const isDetailed = config?.detailedComment === true;

  if (resources.length > 0) {
    const sortedResources = [...resources].sort((a, b) => b.monthly - a.monthly);

    if (isDetailed) {
      // Detailed view: All resources with notes and breakdown
      const resourceRows = sortedResources
        .map((r) => {
          const name = r.resourceId.split('::').pop() || r.resourceId;
          const notes = r.notes ? `<br/>*${r.notes}*` : '';
          return `| ${name} | ${r.resourceType} | ${r.monthly.toFixed(2)} ${currency} | ${notes} |`;
        })
        .join('\n');

      resourceTable = `

### 📋 Full Resource Breakdown

| Resource | Type | Monthly Cost | Notes |
| :--- | :--- | ---: | :--- |
${resourceRows}
`;
    } else if (resources.length <= 20) {
      // Standard view: Top 10 resources
      const resourceRows = sortedResources
        .filter((r) => r.monthly > 0)
        .slice(0, 10)
        .map((r) => {
          const name = r.resourceId.split('::').pop() || r.resourceId;
          return `| ${name} | ${r.resourceType} | ${r.monthly.toFixed(2)} ${currency} |`;
        })
        .join('\n');

      if (resourceRows) {
        resourceTable = `

### Top Resources by Cost

| Resource | Type | Monthly Cost |
| :--- | :--- | ---: |
${resourceRows}
`;
      }
    }
  }

  // Build provider breakdown if available
  let providerBreakdown = '';
  if (report.summary?.byProvider && Object.keys(report.summary.byProvider).length > 0) {
    const providerRows = Object.entries(report.summary.byProvider)
      .filter(([, cost]) => cost > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([provider, cost]) => `| ${provider} | ${cost.toFixed(2)} ${currency} |`)
      .join('\n');

    if (providerRows) {
      providerBreakdown = `

### Cost by Provider

| Provider | Monthly Cost |
| :--- | ---: |
${providerRows}
`;
    }
  }

  // Build Actual Cost Section
  let actualCostSection = '';
  let actualCostRow = '';

  if (actualCostReport && actualCostReport.total > 0) {
    const actualTotal = actualCostReport.total.toFixed(2);
    actualCostRow = `| **Actual (${config?.actualCostsPeriod || '7d'})** | ${actualTotal} ${actualCostReport.currency} |`;

    // Actual Costs Breakdown Table
    if (actualCostReport.items.length > 0) {
      const actualRows = actualCostReport.items
        .sort((a, b) => b.cost - a.cost)
        .map((item) => `| ${item.name} | ${item.cost.toFixed(2)} ${item.currency} |`)
        .join('\n');

      actualCostSection = `
### Actual Costs by ${config?.actualCostsGroupBy || 'provider'} (${actualCostReport.startDate} to ${actualCostReport.endDate})

| Name | Cost |
| :--- | ---: |
| **Total** | **${actualTotal} ${actualCostReport.currency}** |
${actualRows}
`;
    }
  }

  const detailNote = isDetailed ? '\n*Detailed breakdown enabled*' : '';

  let recommendationsSection = '';
  if (recommendationsReport && recommendationsReport.recommendations.length > 0) {
    const recRows = recommendationsReport.recommendations
      .map((r) => {
        const name = r.resource_id.split('::').pop() || r.resource_id;
        return `| ${name} | ${r.description} | ${r.estimated_savings.toFixed(2)} ${r.currency} |`;
      })
      .join('\n');

    recommendationsSection = `

## 💡 Cost Optimization Recommendations

| Resource | Recommendation | Monthly Savings |
| :--- | :--- | ---: |
${recRows}

**Potential Monthly Savings: ${recommendationsReport.summary.total_savings.toFixed(2)} ${recommendationsReport.summary.currency}**
`;
  }

  const sustainabilitySection = sustainabilityReport 
    ? formatSustainabilitySection(sustainabilityReport, config, report) 
    : '';

  return `## 💰 Cloud Cost Estimate

| Metric | Value |
| :--- | ---: |
| **Projected Monthly** | ${total} ${currency} |
${actualCostRow ? actualCostRow + '\n' : ''}| **Cost Diff** | ${diffText} |
| **% Change** | ${percent}% |
${resourceTable}${providerBreakdown}${actualCostSection}${recommendationsSection}${sustainabilitySection}${detailNote}

*Estimates calculated by [pulumicost](https://github.com/rshade/pulumicost-core)*
`;
}
