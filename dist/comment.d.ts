import { ICommenter, FinfocusReport, ActionConfiguration, RecommendationsReport, ActualCostReport, SustainabilityReport, BudgetStatus, EstimateReport } from './types.js';
export declare class Commenter implements ICommenter {
    private readonly marker;
    upsertComment(report: FinfocusReport, token: string, config?: ActionConfiguration, recommendationsReport?: RecommendationsReport, actualCostReport?: ActualCostReport, sustainabilityReport?: SustainabilityReport, budgetStatus?: BudgetStatus, estimateReport?: EstimateReport): Promise<void>;
}
