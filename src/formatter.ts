import {
  FinfocusReport,
  ActionConfiguration,
  RecommendationsReport,
  ActualCostReport,
  SustainabilityReport,
  EquivalencyMetrics,
  BudgetStatus,
  Recommendation,
  EstimateReport,
  FinfocusReportError,
  isV041Diff,
} from './types.js';

/**
 * Calculate achievable savings from recommendations by taking the max per resource+action_type group.
 *
 * finfocus CLI returns multiple options per resource_id + action_type to give users choices
 * (e.g., resize to medium vs resize to small). Since users can only pick ONE option per
 * resource/action, summing all options inflates the total. This function groups by
 * resource_id + action_type and takes the max savings per group for an accurate total.
 *
 * @param recommendations - Array of recommendations from finfocus, or undefined
 * @returns Total achievable savings (max per resource+action_type group)
 */
export function calculateAchievableSavings(recommendations: Recommendation[] | undefined): number {
  if (!recommendations || recommendations.length === 0) {
    return 0;
  }

  const groups = new Map<string, number>();

  for (const rec of recommendations) {
    const key = `${rec.resource_id}::${rec.action_type}`;
    const current = groups.get(key) ?? 0;
    groups.set(key, Math.max(current, rec.estimated_savings));
  }

  return Array.from(groups.values()).reduce((sum, val) => sum + val, 0);
}

/**
 * Get currency symbol for display formatting.
 * @param currency - Currency code (e.g., 'USD', 'EUR')
 * @returns Currency symbol (e.g., '$', '€') or the code itself if unknown
 */
export function getCurrencySymbol(currency: string = 'USD'): string {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CNY: '¥',
  };
  return symbols[currency.toUpperCase()] || currency;
}

/**
 * Converts a total CO2e amount into illustrative environmental equivalents.
 *
 * @param totalCO2e - Total greenhouse gas emissions in kilograms of CO2e
 * @returns An object with:
 *  - `trees`: estimated number of trees required to sequester the given CO2e (approximate, based on ~22 kg CO2/year per tree),
 *  - `milesDriven`: estimated miles driven equivalent (approximate, based on ~0.4 kg CO2 per mile),
 *  - `homeElectricityDays`: estimated number of average home electricity days equivalent (approximate, using ~30 kWh/day and ~0.42 kg CO2/kWh)
 */
export function calculateEquivalents(totalCO2e: number): EquivalencyMetrics {
  // Source: EPA Greenhouse Gas Equivalencies Calculator
  // Note: These are approximations for illustrative purposes.

  // Trees: 1 tree absorbs ~22 kg CO₂/year (Illustrative; varies by species/age/location)
  const trees = (totalCO2e * 12) / 22;

  // Miles driven: ~0.4 kg CO₂/mile (Approx. based on average passenger vehicle)
  const milesDriven = totalCO2e / 0.4;

  // Home electricity: ~0.42 kg CO₂/kWh (Approx; EPA US avg is 0.394 kg/kWh), avg home uses ~30 kWh/day
  const homeElectricityDays = totalCO2e / (30 * 0.42);

  return {
    trees,
    milesDriven,
    homeElectricityDays,
  };
}

/**
 * Generate a simple text-based progress bar using Unicode blocks
 * @param percent - Percentage value (0-100+, can exceed 100%)
 * @param width - Width of the progress bar in characters (default: 10)
 * @returns Progress bar string with filled (▓) and empty (░) blocks
 */
function generateProgressBar(percent: number, width: number = 10): string {
  const capped = Math.min(100, percent);
  const filled = Math.floor((capped / 100) * width);
  const empty = width - filled;
  return '▓'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Get status icon for the dashboard based on budget percentage
 * @param percentUsed - Budget usage percentage
 * @returns Status icon emoji
 */
function getDashboardStatusIcon(percentUsed?: number): string {
  if (percentUsed === undefined) return '—';
  if (percentUsed >= 100) return '⛔';
  if (percentUsed >= 80) return '🔴';
  if (percentUsed >= 50) return '🟡';
  return '🟢';
}

/**
 * Formats the dashboard summary row - a 3-column at-a-glance status table
 * Shows: Monthly Cost | Budget Status | Potential Savings
 *
 * @param totalMonthly - Projected monthly cost
 * @param currency - Currency code
 * @param percentUsed - Budget usage percentage (optional)
 * @param totalSavings - Total potential savings from recommendations (optional)
 * @returns Markdown table string
 */
function formatDashboardSummary(
  totalMonthly: number,
  currency: string,
  percentUsed?: number,
  totalSavings?: number,
): string {
  const currencySymbol = getCurrencySymbol(currency);

  // Monthly cost column
  const costDisplay = `**${currencySymbol}${totalMonthly.toFixed(2)}** ${currency}`;

  // Budget status column
  let budgetDisplay = '—';
  if (percentUsed !== undefined) {
    const icon = getDashboardStatusIcon(percentUsed);
    budgetDisplay = `${icon} **${percentUsed.toFixed(0)}%** used`;
  }

  // Savings column
  let savingsDisplay = '—';
  if (totalSavings !== undefined && totalSavings > 0) {
    savingsDisplay = `**${currencySymbol}${totalSavings.toFixed(2)}**/mo`;
  }

  return `| 💰 Monthly Cost | 📊 Budget Status | 💡 Potential Savings |
|:---------------:|:----------------:|:--------------------:|
| ${costDisplay} | ${budgetDisplay} | ${savingsDisplay} |
`;
}

/**
 * Get GitHub alert type based on budget health status
 * Uses GitHub's blockquote alert syntax: [!NOTE], [!WARNING], [!CAUTION]
 * @param status - Health status or percentage
 * @returns GitHub alert type string
 */
function getAlertType(status: string | number): 'NOTE' | 'WARNING' | 'CAUTION' {
  if (typeof status === 'number') {
    if (status >= 100) return 'CAUTION';
    if (status >= 80) return 'WARNING';
    return 'NOTE';
  }
  switch (status) {
    case 'exceeded':
    case 'critical':
      return 'CAUTION';
    case 'warning':
      return 'WARNING';
    default:
      return 'NOTE';
  }
}

/**
 * Renders budget status using GitHub's native alert syntax for better visual impact.
 *
 * Uses [!CAUTION] for exceeded/critical, [!WARNING] for warning state, [!NOTE] otherwise.
 * Displays budget amount, current spend, progress bar, and any triggered alerts.
 *
 * @param budgetStatus - Budget status data; returns empty string if not configured
 * @returns Markdown string with GitHub alert syntax, or empty string when budget not configured
 */
function formatBudgetSection(budgetStatus?: BudgetStatus): string {
  if (!budgetStatus || !budgetStatus.configured) {
    return '';
  }

  const { amount, period, spent, percentUsed, alerts, currency } = budgetStatus;
  const currencySymbol = getCurrencySymbol(currency);
  const alertType = getAlertType(percentUsed ?? 0);

  // Build status title
  let statusTitle = 'Budget Status';
  if (percentUsed !== undefined) {
    if (percentUsed >= 100) {
      statusTitle = 'Budget Exceeded';
    } else if (percentUsed >= 80) {
      statusTitle = 'Budget Warning';
    }
  }

  // Build content lines
  const lines: string[] = [];
  lines.push(`> [!${alertType}]`);
  lines.push(`> **${statusTitle}**`);
  lines.push(`>`);

  const budgetLine = `> **Budget:** ${currencySymbol}${amount?.toFixed(2) ?? 'N/A'}/${period ?? 'monthly'}`;
  lines.push(budgetLine);

  if (spent !== undefined && percentUsed !== undefined) {
    const progressBar = generateProgressBar(percentUsed);
    lines.push(
      `> **Spent:** ${currencySymbol}${spent.toFixed(2)} (${percentUsed.toFixed(0)}%) ${progressBar}`,
    );
  }

  // Add triggered alerts
  if (alerts && alerts.length > 0) {
    const triggeredAlerts = alerts.filter((a) => a.triggered);
    if (triggeredAlerts.length > 0) {
      lines.push(`>`);
      triggeredAlerts.forEach((a) => {
        lines.push(`> - ${a.threshold}% ${a.type} threshold exceeded`);
      });
    }
  }

  return '\n' + lines.join('\n') + '\n';
}

/**
 * Render the Sustainability section as a Markdown string for inclusion in the comment body.
 *
 * Builds a "Sustainability Impact" block showing total carbon, month-over-month change, and carbon intensity.
 * When enabled via config, includes environmental equivalents (trees, miles driven, home electricity days).
 * When a finfocusReport with resource data is provided, includes a top-10 resources-by-carbon table.
 *
 * @param report - Sustainability metrics (must include `totalCO2e`, `totalCO2eDiff`, and `carbonIntensity`)
 * @param config - Optional action configuration; honors `includeSustainability` and `sustainabilityEquivalents` flags
 * @param finfocusReport - Optional finfocus report used to generate a Resources by Carbon Impact table when present
 * @returns A Markdown string containing the formatted Sustainability section, or an empty string if sustainability is not enabled
 */
function formatSustainabilitySection(
  report: SustainabilityReport,
  config?: ActionConfiguration,
  finfocusReport?: FinfocusReport,
): string {
  if (!config?.includeSustainability) return '';

  const { totalCO2e, totalCO2eDiff, carbonIntensity } = report;
  const equivalents = config.sustainabilityEquivalents
    ? calculateEquivalents(totalCO2e)
    : undefined;

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
  const resources = finfocusReport?.resources ?? finfocusReport?.summary?.resources ?? [];

  if (resources.length > 0) {
    const resourcesWithCarbon = resources
      .filter(
        (r) =>
          r.sustainability?.carbon_footprint?.value && r.sustainability.carbon_footprint.value > 0,
      )
      .sort(
        (a, b) =>
          b.sustainability!.carbon_footprint.value - a.sustainability!.carbon_footprint.value,
      );

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

<details>
<summary><strong>🌱 Sustainability</strong> — ${totalCO2e.toFixed(2)} kgCO₂e/month</summary>

| Metric | Value |
| :--- | ---: |
| **Carbon Footprint** | ${totalCO2e.toFixed(2)} kgCO₂e/month |
| **Carbon Change** | ${diffText} |
| **Carbon Intensity** | ${carbonIntensity.toFixed(2)} gCO₂e/USD |
${equivalentsSection}${resourceTable}
</details>
`;
}

/**
 * Render the What-If Cost Estimate section as Markdown for the PR comment.
 *
 * Shows the estimated resource (type, provider, region), a Baseline vs Modified
 * monthly cost table, the total change, and the per-property deltas from
 * `finfocus cost estimate` (single-resource mode, finfocus v0.4.0).
 *
 * @param report - Estimate report from `Analyzer.runEstimate`
 * @returns Markdown string for the estimate section
 */
export function formatEstimateSection(report: EstimateReport): string {
  const currency = report.modified.currency || 'USD';
  const currencySymbol = getCurrencySymbol(currency);
  const region = report.resource.properties?.region;

  const detailParts = [`**Provider:** \`${report.resource.provider}\``];
  if (typeof region === 'string' && region !== '') {
    detailParts.push(`**Region:** \`${region}\``);
  }

  const changeText =
    report.totalChange > 0
      ? `+${currencySymbol}${report.totalChange.toFixed(2)}`
      : `${currencySymbol}${report.totalChange.toFixed(2)}`;

  let deltasTable = '';
  if (report.deltas.length > 0) {
    const deltaRows = report.deltas
      .map((d) => {
        const original = d.originalValue === '' ? '—' : d.originalValue;
        const delta =
          d.costChange > 0
            ? `+${currencySymbol}${d.costChange.toFixed(2)}`
            : `${currencySymbol}${d.costChange.toFixed(2)}`;
        return `| ${d.property} | ${original} | ${d.newValue} | ${delta} |`;
      })
      .join('\n');

    deltasTable = `
| Property | Original | New | Cost Change |
| :--- | :--- | :--- | ---: |
${deltaRows}
`;
  }

  return `

## 🔮 What-If Cost Estimate

**Resource:** \`${report.resource.type}\`
${detailParts.join(' · ')}

| Metric | Baseline | Modified |
| :--- | ---: | ---: |
| **Monthly Cost** | ${currencySymbol}${report.baseline.monthly.toFixed(2)} | ${currencySymbol}${report.modified.monthly.toFixed(2)} |
| **Hourly Cost** | ${currencySymbol}${report.baseline.hourly.toFixed(4)} | ${currencySymbol}${report.modified.hourly.toFixed(4)} |

**Total Change:** ${changeText} ${currency}/month
${deltasTable}`;
}

/**
 * Extract monthly cost change from diff, handling both v0.4.0 (legacy) and v0.4.1 formats.
 * Uses type guard to safely access the correct format.
 * @param diff - The diff object from the report
 * @returns The monthly cost change, or 0 if not available
 */
function extractMonthlyCostChange(diff?: any): number {
  if (!diff) return 0;
  if (isV041Diff(diff)) {
    return diff.totalDelta;
  }
  // v0.4.0 format: monthly_cost_change
  if ('monthly_cost_change' in diff) {
    return diff.monthly_cost_change;
  }
  return 0;
}

/**
 * Extract percent change from diff, handling both v0.4.0 (legacy) and v0.4.1 formats.
 * Uses type guard to safely access the correct format.
 * @param diff - The diff object from the report
 * @returns The percent change, or 0 if not available
 */
function extractPercentChange(diff?: any): number {
  if (!diff) return 0;
  if (isV041Diff(diff)) {
    // v0.4.1: calculate from totalBefore/totalAfter
    if (diff.totalBefore === 0) return diff.totalAfter > 0 ? 100 : 0;
    return ((diff.totalAfter - diff.totalBefore) / diff.totalBefore) * 100;
  }
  // v0.4.0 format: percent_change
  if ('percent_change' in diff) {
    return diff.percent_change;
  }
  return 0;
}

/**
 * Format the unpriced resources section when resources could not be priced.
 * Renders a table showing resource type, resource ID (short form), plugin name, and error message.
 * Includes a note that these resources are NOT included in the total cost.
 *
 * @param errors - Array of FinfocusReportError entries, or null/empty
 * @returns Markdown string with the unpriced resources section, or empty string if no errors
 */
function formatUnpricedResourcesSection(errors?: FinfocusReportError[] | null): string {
  if (!errors || errors.length === 0) {
    return '';
  }

  const displayErrors = errors.slice(0, 20);
  const truncated = errors.length > 20 ? errors.length - 20 : 0;

  const errorRows = displayErrors
    .map((err) => {
      const resourceIdShort = err.resourceId.split('::').pop() || err.resourceId;
      return `| ${err.resourceType} | ${resourceIdShort} | ${err.pluginName} | ${err.message} |`;
    })
    .join('\n');

  const truncatedNote = truncated > 0 ? `\nand ${truncated} more` : '';

  return `
<details>
<summary><strong>⚠️ Resources Not Priced</strong> (${errors.length} ${errors.length === 1 ? 'resource' : 'resources'})</summary>

| Type | Resource | Plugin | Reason |
| :--- | :--- | :--- | :--- |
${errorRows}${truncatedNote}

*These resources could not be priced and are not included in the cost total above.*

</details>`;
}

/**
 * Assembles a markdown-formatted cloud cost comment combining cost, resource, budget, recommendation, actuals, and sustainability data.
 *
 * @param report - Primary finfocus report containing summary, resources, diffs, and provider breakdown
 * @param config - Optional action configuration that controls formatting and which sections to show
 * @param recommendationsReport - Optional recommendations with estimated savings to include in the comment
 * @param actualCostReport - Optional actual cost data (time window, items, totals) to include alongside estimates
 * @param sustainabilityReport - Optional sustainability metrics (CO2e and related details) to include
 * @param budgetStatus - Optional budget status rendered via GitHub alert syntax
 * @param estimateReport - Optional what-if estimate report to include
 * @returns A markdown string containing the assembled comment body with sections for projected monthly cost, cost diff and percent change, budget status, resource and provider breakdowns, actual costs, recommendations, what-if estimate, sustainability, and an optional detailed note.
 */
export function formatCommentBody(
  report: FinfocusReport,
  config?: ActionConfiguration,
  recommendationsReport?: RecommendationsReport,
  actualCostReport?: ActualCostReport,
  sustainabilityReport?: SustainabilityReport,
  budgetStatus?: BudgetStatus,
  estimateReport?: EstimateReport,
): string {
  // Handle both new and legacy report formats
  const currency = report.summary?.currency ?? report.currency ?? 'USD';
  const totalMonthly = report.summary?.totalMonthly ?? report.projected_monthly_cost ?? 0;
  const total = totalMonthly.toFixed(2);

  const monthlyCostChange = extractMonthlyCostChange(report.diff);
  const percentChange = extractPercentChange(report.diff);
  const diff = monthlyCostChange.toFixed(2);
  const percent = percentChange.toFixed(2);

  let diffText = `${diff} ${currency}`;
  if (report.diff) {
    if (monthlyCostChange > 0) {
      diffText = `📈 +${diffText}`;
    } else if (monthlyCostChange < 0) {
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

<details>
<summary><strong>📋 Full Resource Breakdown</strong> (${sortedResources.length} resources)</summary>

| Resource | Type | Monthly Cost | Notes |
| :--- | :--- | ---: | :--- |
${resourceRows}

</details>
`;
    } else if (resources.length <= 20) {
      // Standard view: Top resources in collapsible section
      const topResources = sortedResources.filter((r) => r.monthly > 0).slice(0, 10);
      const resourceRows = topResources
        .map((r) => {
          const name = r.resourceId.split('::').pop() || r.resourceId;
          return `| ${name} | ${r.resourceType} | ${r.monthly.toFixed(2)} ${currency} |`;
        })
        .join('\n');

      if (resourceRows) {
        resourceTable = `

<details>
<summary><strong>📊 Top Resources</strong> (${topResources.length} of ${resources.length})</summary>

| Resource | Type | Monthly Cost |
| :--- | :--- | ---: |
${resourceRows}

</details>
`;
      }
    }
  }

  // Build provider breakdown only if multiple providers
  let providerBreakdown = '';
  if (report.summary?.byProvider && Object.keys(report.summary.byProvider).length > 1) {
    const providerRows = Object.entries(report.summary.byProvider)
      .filter(([, cost]) => cost > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([provider, cost]) => `| ${provider} | ${cost.toFixed(2)} ${currency} |`)
      .join('\n');

    if (providerRows) {
      providerBreakdown = `

<details>
<summary><strong>☁️ Cost by Provider</strong></summary>

| Provider | Monthly Cost |
| :--- | ---: |
${providerRows}

</details>
`;
    }
  }

  // Build Actual Cost Section
  let actualCostSection = '';
  let actualCostRow = '';

  if (actualCostReport && actualCostReport.total > 0) {
    const actualTotal = actualCostReport.total.toFixed(2);
    actualCostRow = `| **Actual (${config?.actualCostsPeriod || '7d'})** | ${actualTotal} ${actualCostReport.currency} |`;

    // Actual Costs Breakdown Table (collapsible)
    if (actualCostReport.items.length > 0) {
      const actualRows = actualCostReport.items
        .sort((a, b) => b.cost - a.cost)
        .map((item) => `| ${item.name} | ${item.cost.toFixed(2)} ${item.currency} |`)
        .join('\n');

      actualCostSection = `

<details>
<summary><strong>💵 Actual Costs</strong> (${actualCostReport.startDate} to ${actualCostReport.endDate})</summary>

| ${config?.actualCostsGroupBy || 'Provider'} | Cost |
| :--- | ---: |
| **Total** | **${actualTotal} ${actualCostReport.currency}** |
${actualRows}

</details>
`;
    }
  }

  const detailNote = isDetailed ? '\n*Detailed breakdown enabled*' : '';

  // Recommendations section - prominent since it's actionable
  let recommendationsSection = '';
  if (recommendationsReport && recommendationsReport.recommendations.length > 0) {
    const totalSavings = recommendationsReport.summary.total_savings;
    const savingsCurrency = recommendationsReport.summary.currency;
    const recRows = recommendationsReport.recommendations
      .map((r) => {
        const name = r.resource_id.split('::').pop() || r.resource_id;
        return `| ${name} | ${r.description} | ${r.estimated_savings.toFixed(2)} ${r.currency} |`;
      })
      .join('\n');

    recommendationsSection = `

<details open>
<summary><strong>💡 Optimization Opportunities</strong> — Save up to <strong>${totalSavings.toFixed(2)} ${savingsCurrency}/mo</strong></summary>

| Resource | Recommendation | Savings |
| :--- | :--- | ---: |
${recRows}

</details>
`;
  }

  const sustainabilitySection = sustainabilityReport
    ? formatSustainabilitySection(sustainabilityReport, config, report)
    : '';

  const estimateSection = estimateReport ? formatEstimateSection(estimateReport) : '';

  const unpricedResourcesSection = formatUnpricedResourcesSection(report.errors);

  // Basic budget status section (local math; finfocus has no budget status command)
  const budgetSection = formatBudgetSection(budgetStatus);

  // Calculate percent used for dashboard from budget status
  const percentUsed = budgetStatus?.percentUsed;

  // Calculate achievable savings for dashboard (max per resource+action_type group)
  // This avoids inflating the total by summing mutually exclusive options
  const achievableSavings =
    calculateAchievableSavings(recommendationsReport?.recommendations) || undefined;

  // Build dashboard summary row
  const dashboardSummary = formatDashboardSummary(
    totalMonthly,
    currency,
    percentUsed,
    achievableSavings,
  );

  return `## Cloud Cost Estimate

${dashboardSummary}
${budgetSection}
<details>
<summary><strong>📈 Cost Details</strong></summary>

| Metric | Value |
| :--- | ---: |
| **Projected Monthly** | ${total} ${currency} |
${actualCostRow ? actualCostRow + '\n' : ''}| **Cost Diff** | ${diffText} |
| **% Change** | ${percent}% |

</details>
${resourceTable}${providerBreakdown}${actualCostSection}${unpricedResourcesSection}${recommendationsSection}${estimateSection}${sustainabilitySection}${detailNote}

---
<sub>Estimates by [finfocus](https://github.com/rshade/finfocus)</sub>
`;
}
