import { ICommenter, FinfocusReport, ActionConfiguration, RecommendationsReport, ActualCostReport, SustainabilityReport, BudgetStatus, BudgetHealthReport, ScopedBudgetReport } from './types.js';
export declare class Commenter implements ICommenter {
    private readonly marker;
    upsertComment(report: FinfocusReport, token: string, config?: ActionConfiguration, recommendationsReport?: RecommendationsReport, actualCostReport?: ActualCostReport, sustainabilityReport?: SustainabilityReport, budgetStatus?: BudgetStatus, budgetHealth?: BudgetHealthReport, scopedBudgetReport?: ScopedBudgetReport): Promise<void>;
}
