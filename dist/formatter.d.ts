import { FinfocusReport, ActionConfiguration, RecommendationsReport, ActualCostReport, SustainabilityReport, EquivalencyMetrics, BudgetStatus, BudgetHealthReport, Recommendation, ScopedBudgetReport, BudgetHealthStatus } from './types.js';
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
export declare function calculateAchievableSavings(recommendations: Recommendation[] | undefined): number;
/**
 * Get currency symbol for display formatting.
 * @param currency - Currency code (e.g., 'USD', 'EUR')
 * @returns Currency symbol (e.g., '$', '€') or the code itself if unknown
 */
export declare function getCurrencySymbol(currency?: string): string;
/**
 * Converts a total CO2e amount into illustrative environmental equivalents.
 *
 * @param totalCO2e - Total greenhouse gas emissions in kilograms of CO2e
 * @returns An object with:
 *  - `trees`: estimated number of trees required to sequester the given CO2e (approximate, based on ~22 kg CO2/year per tree),
 *  - `milesDriven`: estimated miles driven equivalent (approximate, based on ~0.4 kg CO2 per mile),
 *  - `homeElectricityDays`: estimated number of average home electricity days equivalent (approximate, using ~30 kWh/day and ~0.42 kg CO2/kWh)
 */
export declare function calculateEquivalents(totalCO2e: number): EquivalencyMetrics;
/**
 * Get status icon for scoped budget based on health status.
 * @param status - Health status value
 * @returns Emoji icon for the status
 */
export declare function getScopeStatusIcon(status: BudgetHealthStatus): string;
/**
 * Format the scoped budget section for PR comments.
 * Displays a "Budget Status by Scope" table sorted by percentUsed descending.
 *
 * @param report - Scoped budget report from finfocus CLI
 * @returns Markdown string with scope budget table, or empty string if no scopes/failures
 */
export declare function formatScopedBudgetSection(report: ScopedBudgetReport | undefined): string;
/**
 * Assembles a markdown-formatted cloud cost comment combining cost, resource, budget, recommendation, actuals, and sustainability data.
 *
 * @param report - Primary finfocus report containing summary, resources, diffs, and provider breakdown
 * @param config - Optional action configuration that controls formatting and which sections to show
 * @param recommendationsReport - Optional recommendations with estimated savings to include in the comment
 * @param actualCostReport - Optional actual cost data (time window, items, totals) to include alongside estimates
 * @param sustainabilityReport - Optional sustainability metrics (CO2e and related details) to include
 * @param budgetStatus - Optional basic budget status used when detailed budget health is not provided
 * @param budgetHealth - Optional detailed budget health report used in preference to budgetStatus
 * @param scopedBudgetReport - Optional scoped budget report with per-scope status (finfocus v0.2.6+)
 * @returns A markdown string containing the assembled comment body with sections for projected monthly cost, cost diff and percent change, budget/budget health, resource and provider breakdowns, actual costs, recommendations, sustainability, and an optional detailed note.
 */
export declare function formatCommentBody(report: FinfocusReport, config?: ActionConfiguration, recommendationsReport?: RecommendationsReport, actualCostReport?: ActualCostReport, sustainabilityReport?: SustainabilityReport, budgetStatus?: BudgetStatus, budgetHealth?: BudgetHealthReport, scopedBudgetReport?: ScopedBudgetReport): string;
