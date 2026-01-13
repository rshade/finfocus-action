import { FinfocusReport, ActionConfiguration, RecommendationsReport, ActualCostReport, SustainabilityReport, EquivalencyMetrics, BudgetStatus } from './types.js';
export declare function calculateEquivalents(totalCO2e: number): EquivalencyMetrics;
export declare function formatCommentBody(report: FinfocusReport, config?: ActionConfiguration, recommendationsReport?: RecommendationsReport, actualCostReport?: ActualCostReport, sustainabilityReport?: SustainabilityReport, budgetStatus?: BudgetStatus): string;
