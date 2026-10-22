export type GrowthModel = 'linear' | 'exponential' | 'average';

/**
 * Project a monthly cost.
 * `monthlyGrowthRate` is a fraction (0.1 is 10% per month).
 * With no history the caller passes 0, and every model holds the current total.
 */
export function projectMonthlyCost(
  current: number,
  monthlyGrowthRate: number,
  months: number,
  model: GrowthModel,
): number {
  const periods = Math.max(0, Math.floor(months));
  if (model === 'exponential') {
    return current * (1 + monthlyGrowthRate) ** periods;
  }
  if (model === 'average') {
    return current * (1 + monthlyGrowthRate);
  }
  return current * (1 + monthlyGrowthRate * periods);
}
