import { PulumicostReport, ActionConfiguration } from './types.js';

export function formatCommentBody(report: PulumicostReport, config?: ActionConfiguration): string {
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
  const resourceLimit = isDetailed ? 100 : 10;
  
  if (resources.length > 0) {
    const sortedResources = [...resources].sort((a, b) => b.monthly - a.monthly);
    
    if (isDetailed) {
      // Detailed view: All resources with notes and breakdown
      const resourceRows = sortedResources
        .map(r => {
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
        .filter(r => r.monthly > 0)
        .slice(0, 10)
        .map(r => {
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

  const detailNote = isDetailed ? '\n*Detailed breakdown enabled*' : '';

  return `## 💰 Cloud Cost Estimate

| Total Monthly Cost | Cost Diff | % Change |
| :--- | :--- | :--- |
| **${total} ${currency}** | ${diffText} | ${percent}% |
${resourceTable}${providerBreakdown}${detailNote}

*Estimates calculated by [pulumicost](https://github.com/rshade/pulumicost-core)*
`;
}
