import { PulumicostReport } from './types';

export function formatCommentBody(report: PulumicostReport): string {
  const currency = report.currency || 'USD';
  const total = report.projected_monthly_cost.toFixed(2);
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

  return `## 💰 Cloud Cost Estimate

| Total Monthly Cost | Cost Diff | % Change |
| :--- | :--- | :--- |
| **${total} ${currency}** | ${diffText} | ${percent}% |

*Estimates calculated by [pulumicost](https://github.com/rshade/pulumicost-core)*
`;
}
