export type GrowthModel = 'linear' | 'exponential' | 'average';
/**
 * Project a monthly cost.
 * `monthlyGrowthRate` is a fraction (0.1 is 10% per month).
 * With no history the caller passes 0, and every model holds the current total.
 */
export declare function projectMonthlyCost(current: number, monthlyGrowthRate: number, months: number, model: GrowthModel): number;
