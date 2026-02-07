import { IAnalyzer, FinfocusReport, ActionConfiguration, RecommendationsReport, ActualCostReport, BudgetStatus, BudgetHealthReport, ScopedBudgetReport } from './types.js';
export declare class Analyzer implements IAnalyzer {
    runAnalysis(planPath: string, config?: ActionConfiguration): Promise<FinfocusReport>;
    calculateSustainabilityMetrics(report: FinfocusReport): {
        totalCO2e: number;
        totalCO2eDiff: number;
        carbonIntensity: number;
    };
    runRecommendations(planPath: string, config?: ActionConfiguration): Promise<RecommendationsReport>;
    runActualCosts(config: ActionConfiguration): Promise<ActualCostReport>;
    private getDateRange;
    private isValidPeriodFormat;
    private parseAndValidateCustomDate;
    setupAnalyzerMode(config?: ActionConfiguration): Promise<void>;
    calculateBudgetStatus(config: ActionConfiguration, report: FinfocusReport): BudgetStatus | undefined;
    private parseAlerts;
    extractBudgetStatus(stdout: string): BudgetStatus | undefined;
    private findBinary;
    /**
     * Run budget status analysis using finfocus CLI.
     * Returns BudgetHealthReport with health score, forecast, and runway.
     * Falls back to local calculation for finfocus < 0.2.5.
     */
    runBudgetStatus(config: ActionConfiguration): Promise<BudgetHealthReport | undefined>;
    /**
     * Parse the JSON response from finfocus budget status command.
     */
    private parseBudgetStatusResponse;
    /**
     * Calculate budget health locally when finfocus < 0.2.5.
     * Returns undefined since we cannot determine actual health metrics without CLI support.
     * This causes the PR comment to fall back to the basic budget status section instead.
     */
    private calculateBudgetHealthFallback;
    /**
     * Compute health status based on health score and spend vs budget.
     */
    private computeHealthStatus;
    /**
     * Run scoped budget status analysis using finfocus CLI.
     * Returns ScopedBudgetReport with status for each configured scope.
     * Returns undefined if no scopes are configured or CLI version is too old.
     */
    runScopedBudgetStatus(config: ActionConfiguration): Promise<ScopedBudgetReport | undefined>;
    /**
     * Parse the JSON response from finfocus budget status command for scoped budgets.
     * Handles both wrapped (finfocus key) and unwrapped formats.
     */
    parseScopedBudgetResponse(stdout: string, config?: ActionConfiguration): ScopedBudgetReport;
}
