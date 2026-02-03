import {
  FinfocusReport,
  ActionConfiguration,
  RecommendationsReport,
  ActualCostReport,
  SustainabilityReport,
  EquivalencyMetrics,
  BudgetStatus,
  BudgetHealthReport,
} from './types.js';

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
 * Generate a TUI-style progress bar using block characters
 * @param percent - Percentage value (0-100+, can exceed 100%)
 * @param width - Width of the progress bar in characters (default: 30)
 * @returns Progress bar string with filled (█) and empty (░) blocks
 */
function generateTUIProgressBar(percent: number, width: number = 30): string {
  const filled = Math.min(width, Math.floor((percent / 100) * width));
  const empty = Math.max(0, width - filled);
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Format a line for TUI box with proper padding and borders
 * @param content - Content to display in the line
 * @param width - Width of the content area (default: 42)
 * @returns Formatted line with borders and padding
 */
function formatTUILine(content: string, width: number = 42): string {
  const contentLength = content.length;
  const padding = Math.max(0, width - contentLength);
  return `│ ${content}${' '.repeat(padding)} │`;
}

/**
 * Create a TUI box with borders around the provided lines
 * @param lines - Array of content lines to display in the box
 * @param width - Width of the content area (default: 42)
 * @returns Complete TUI box with top, bottom, and side borders
 */
function createTUIBox(lines: string[], width: number = 42): string {
  const top = '╭' + '─'.repeat(width + 2) + '╮';
  const bottom = '╰' + '─'.repeat(width + 2) + '╯';

  const formattedLines = lines.map((line) => formatTUILine(line, width));

  return [top, ...formattedLines, bottom].join('\n');
}

function formatBudgetSection(budgetStatus?: BudgetStatus): string {
  if (!budgetStatus || !budgetStatus.configured) {
    return '';
  }

  const { amount, period, spent, percentUsed, alerts, currency } = budgetStatus;
  const currencySymbol = getCurrencySymbol(currency);

  // Determine status message
  let statusMessage = '';
  if (percentUsed !== undefined) {
    if (percentUsed >= 100) {
      statusMessage = '⚠ CRITICAL - budget exceeded';
    } else if (percentUsed >= 80) {
      statusMessage = '⚠ WARNING - spend exceeds 80% threshold';
    }
  }

  // Build TUI box content
  const lines: string[] = [];
  lines.push('BUDGET STATUS');
  lines.push('────────────────────────────────────');
  lines.push(`Budget: ${currencySymbol}${amount?.toFixed(2) ?? 'N/A'}/${period ?? 'monthly'}`);

  if (spent !== undefined && percentUsed !== undefined) {
    lines.push(`Current Spend: ${currencySymbol}${spent.toFixed(2)} (${percentUsed.toFixed(1)}%)`);
  }

  lines.push(''); // Empty line

  // Progress bar with block characters
  if (percentUsed !== undefined) {
    const progressBar = generateTUIProgressBar(percentUsed);
    lines.push(`${progressBar} ${percentUsed.toFixed(0)}%`);
  }

  if (statusMessage) {
    lines.push(statusMessage);
  }

  // Add triggered alerts to the TUI box
  if (alerts && alerts.length > 0) {
    const triggeredAlerts = alerts.filter((a) => a.triggered);
    if (triggeredAlerts.length > 0) {
      lines.push(''); // Empty line before alerts
      triggeredAlerts.forEach((a) => {
        const icon = a.type === 'actual' ? '💰' : '📊';
        lines.push(`${icon} ${a.threshold}% ${a.type} threshold exceeded`);
      });
    }
  }

  // Wrap in TUI box and code block for GitHub
  return '\n```\n' + createTUIBox(lines) + '\n```\n';
}

/**
 * Get status icon for budget health status
 */
function getHealthStatusIcon(status: string): string {
  const icons: Record<string, string> = {
    healthy: '🟢',
    warning: '🟡',
    critical: '🔴',
    exceeded: '⛔',
  };
  return icons[status] || '❓';
}

/**
 * Format budget health section with visual indicators.
 * Displays health score, forecast, runway, and progress bar.
 */
function formatBudgetHealthSection(
  budgetHealth: BudgetHealthReport,
  config?: ActionConfiguration,
): string {
  if (!budgetHealth || !budgetHealth.configured) {
    return '';
  }

  const { amount, period, spent, percentUsed, alerts, currency, healthScore, forecast, runwayDays, healthStatus } = budgetHealth;
  const currencySymbol = getCurrencySymbol(currency);
  const statusIcon = getHealthStatusIcon(healthStatus);

  // Build TUI box content
  const lines: string[] = [];
  lines.push('BUDGET HEALTH');
  lines.push('────────────────────────────────────────');

  // Health score with visual indicator
  if (healthScore !== undefined) {
    lines.push(`Health Score: ${statusIcon} ${healthScore}/100`);
  } else {
    lines.push(`Status: ${statusIcon} ${healthStatus}`);
  }

  lines.push(`Budget: ${currencySymbol}${amount?.toFixed(2) ?? 'N/A'}/${period ?? 'monthly'}`);

  if (spent !== undefined && percentUsed !== undefined) {
    lines.push(`Spent: ${currencySymbol}${spent.toFixed(2)} (${percentUsed.toFixed(0)}%)`);
  }

  // Forecast (if enabled and available)
  const showForecast = config?.showBudgetForecast !== false;
  if (showForecast && forecast) {
    lines.push(`Forecast: ${forecast} (end of period)`);
  }

  // Runway
  if (runwayDays !== undefined) {
    const runwayText = runwayDays === Infinity || runwayDays < 0
      ? 'Unlimited'
      : `${runwayDays} days remaining`;
    lines.push(`Runway: ${runwayText}`);
  }

  lines.push(''); // Empty line

  // Progress bar with block characters
  if (percentUsed !== undefined) {
    const progressBar = generateTUIProgressBar(percentUsed);
    lines.push(`${progressBar} ${percentUsed.toFixed(0)}%`);
  }

  // Determine status message based on health status
  if (healthStatus === 'exceeded') {
    lines.push('⚠ CRITICAL - budget exceeded');
  } else if (healthStatus === 'critical') {
    lines.push('⚠ CRITICAL - budget health critical');
  } else if (healthStatus === 'warning') {
    lines.push('⚠ WARNING - budget health warning');
  } else if (percentUsed !== undefined && percentUsed >= 100) {
    lines.push('⚠ CRITICAL - budget exceeded');
  } else if (percentUsed !== undefined && percentUsed >= (config?.budgetAlertThreshold ?? 80)) {
    lines.push(`⚠ WARNING - spend exceeds ${config?.budgetAlertThreshold ?? 80}% threshold`);
  }

  // Add triggered alerts to the TUI box
  if (alerts && alerts.length > 0) {
    const triggeredAlerts = alerts.filter((a) => a.triggered);
    if (triggeredAlerts.length > 0) {
      lines.push(''); // Empty line before alerts
      triggeredAlerts.forEach((a) => {
        const icon = a.type === 'actual' ? '💰' : '📊';
        lines.push(`${icon} ${a.threshold}% ${a.type} threshold exceeded`);
      });
    }
  }

  // Wrap in TUI box and code block for GitHub
  return '\n```\n' + createTUIBox(lines) + '\n```\n';
}

function formatSustainabilitySection(
  report: SustainabilityReport,
  config?: ActionConfiguration,
  finfocusReport?: FinfocusReport,
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
  const resources = finfocusReport?.resources ?? finfocusReport?.summary?.resources ?? [];
  
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
  report: FinfocusReport,
  config?: ActionConfiguration,
  recommendationsReport?: RecommendationsReport,
  actualCostReport?: ActualCostReport,
  sustainabilityReport?: SustainabilityReport,
  budgetStatus?: BudgetStatus,
  budgetHealth?: BudgetHealthReport,
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

  // Use budget health section if available, otherwise fall back to basic budget status
  const budgetSection = budgetHealth
    ? formatBudgetHealthSection(budgetHealth, config)
    : formatBudgetSection(budgetStatus);

  return `## 💰 Cloud Cost Estimate

| Metric | Value |
| :--- | ---: |
| **Projected Monthly** | ${total} ${currency} |
${actualCostRow ? actualCostRow + '\n' : ''}| **Cost Diff** | ${diffText} |
| **% Change** | ${percent}% |
${budgetSection}${resourceTable}${providerBreakdown}${actualCostSection}${recommendationsSection}${sustainabilitySection}${detailNote}

*Estimates calculated by [finfocus](https://github.com/rshade/finfocus)*
`;
}
