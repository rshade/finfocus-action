import { ICommenter, FinfocusReport, ActionConfiguration, RecommendationsReport, ActualCostReport, SustainabilityReport, BudgetStatus, EstimateReport, ClusterReport, StateOnlyReport } from './types.js';
export declare class Commenter implements ICommenter {
    private readonly marker;
    /**
     * Write the PR comment body without calling GitHub.
     * The contract job sets FINFOCUS_COMMENT_PATH so CI can assert the comment.
     */
    writeCommentFile(filePath: string, report: FinfocusReport, config?: ActionConfiguration, recommendationsReport?: RecommendationsReport, actualCostReport?: ActualCostReport, sustainabilityReport?: SustainabilityReport, budgetStatus?: BudgetStatus, estimateReport?: EstimateReport, clusterReport?: ClusterReport, stateOnlyReport?: StateOnlyReport): void;
    upsertComment(report: FinfocusReport, token: string, config?: ActionConfiguration, recommendationsReport?: RecommendationsReport, actualCostReport?: ActualCostReport, sustainabilityReport?: SustainabilityReport, budgetStatus?: BudgetStatus, estimateReport?: EstimateReport, clusterReport?: ClusterReport, stateOnlyReport?: StateOnlyReport): Promise<void>;
    private commentBody;
}
