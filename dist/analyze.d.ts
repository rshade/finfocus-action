import { IAnalyzer, FinfocusReport, ActionConfiguration, RecommendationsReport, ActualCostReport, BudgetStatus, EstimateReport } from './types.js';
export declare class Analyzer implements IAnalyzer {
    runAnalysis(planPath: string, config?: ActionConfiguration): Promise<FinfocusReport>;
    calculateSustainabilityMetrics(report: FinfocusReport): {
        totalCO2e: number;
        totalCO2eDiff: number;
        carbonIntensity: number;
    };
    runRecommendations(planPath: string, config?: ActionConfiguration): Promise<RecommendationsReport>;
    runActualCosts(config: ActionConfiguration): Promise<ActualCostReport>;
    runEstimate(config: ActionConfiguration): Promise<EstimateReport | undefined>;
    private parseEstimateSpec;
    private getDateRange;
    private isValidPeriodFormat;
    private parseAndValidateCustomDate;
    setupAnalyzerMode(config?: ActionConfiguration): Promise<void>;
    calculateBudgetStatus(config: ActionConfiguration, report: FinfocusReport): BudgetStatus | undefined;
    private parseAlerts;
    extractBudgetStatus(stdout: string): BudgetStatus | undefined;
    private findBinary;
}
