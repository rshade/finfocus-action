export interface ActionConfiguration {
    pulumiPlanJsonPath: string;
    githubToken: string;
    finfocusVersion: string;
    installPlugins: string[];
    behaviorOnError: 'fail' | 'warn' | 'silent';
    postComment: boolean;
    threshold: string | null;
    analyzerMode: boolean;
    detailedComment: boolean;
    includeRecommendations: boolean;
    logLevel: string;
    debug: boolean;
    includeActualCosts: boolean;
    actualCostsPeriod: string;
    pulumiStateJsonPath: string;
    actualCostsGroupBy: string;
    /** Path to a Terraform state file for cost projected (mutually exclusive with the Pulumi plan) */
    terraformStatePath?: string;
    includeSustainability: boolean;
    utilizationRate: string;
    sustainabilityEquivalents: boolean;
    failOnCarbonIncrease: string | null;
    budgetAmount?: number;
    budgetCurrency?: string;
    budgetPeriod?: string;
    budgetAlerts?: string;
    estimateSpec?: string;
}
export interface BudgetAlert {
    threshold: number;
    type: 'actual' | 'forecasted';
}
export interface BudgetConfiguration {
    amount: number;
    currency: string;
    period: 'monthly' | 'quarterly' | 'yearly';
    alerts: BudgetAlert[];
}
export interface BudgetStatus {
    configured: boolean;
    amount?: number;
    currency?: string;
    period?: string;
    spent?: number;
    remaining?: number;
    percentUsed?: number;
    alerts?: Array<{
        threshold: number;
        type: string;
        triggered: boolean;
    }>;
}
export interface ActualCostItem {
    name: string;
    cost: number;
    currency: string;
}
export interface ActualCostReport {
    total: number;
    currency: string;
    startDate: string;
    endDate: string;
    items: ActualCostItem[];
}
export interface FinfocusSustainabilityMetric {
    value: number;
    unit: string;
}
export interface FinfocusSustainabilityData {
    gCO2e: FinfocusSustainabilityMetric;
    carbon_footprint: FinfocusSustainabilityMetric;
}
export interface FinfocusResource {
    resourceType: string;
    resourceId: string;
    adapter: string;
    currency: string;
    monthly: number;
    hourly: number;
    notes?: string;
    breakdown?: unknown;
    startDate?: string;
    endDate?: string;
    sustainability?: FinfocusSustainabilityData;
}
export interface EquivalencyMetrics {
    trees: number;
    milesDriven: number;
    homeElectricityDays: number;
}
export interface SustainabilityReport {
    totalCO2e: number;
    totalCO2eDiff: number;
    carbonIntensity: number;
    equivalents?: EquivalencyMetrics;
}
export interface FinfocusSummary {
    totalMonthly: number;
    totalHourly: number;
    currency: string;
    byProvider?: Record<string, number>;
    byService?: Record<string, number>;
    byAdapter?: Record<string, number>;
    resources?: FinfocusResource[];
}
export interface FinfocusReportError {
    resourceType: string;
    resourceId: string;
    pluginName: string;
    message: string;
}
export interface FinfocusReportDiff {
    totalBefore: number;
    totalAfter: number;
    totalDelta: number;
    currency: string;
    creates: number;
    updates: number;
    deletes: number;
    unchanged: number;
}
/**
 * Type guard to detect finfocus v0.4.1 diff format vs legacy v0.4.0 format.
 * v0.4.1: { totalBefore, totalAfter, totalDelta, currency, creates, updates, deletes, unchanged }
 * v0.4.0: { monthly_cost_change, percent_change }
 */
export declare function isV041Diff(diff: any): diff is FinfocusReportDiff;
export interface FinfocusReport {
    summary: FinfocusSummary;
    resources?: FinfocusResource[];
    errors?: FinfocusReportError[] | null;
    diff?: FinfocusReportDiff | {
        monthly_cost_change: number;
        percent_change: number;
    };
    projected_monthly_cost?: number;
    currency?: string;
}
export interface CostAssessment {
    totalMonthlyCost: number;
    monthlyCostDiff: number;
    currency: string;
    reportPath: string;
    failedThreshold: boolean;
    totalCarbonFootprint?: number;
    carbonIntensity?: number;
    failedCarbonThreshold?: boolean;
}
export interface IInstaller {
    install(version: string, config?: ActionConfiguration): Promise<string>;
}
export interface IPluginManager {
    installPlugins(plugins: string[], config?: ActionConfiguration): Promise<void>;
}
export interface IAnalyzer {
    runAnalysis(planPath: string, config?: ActionConfiguration): Promise<FinfocusReport>;
    runRecommendations(planPath: string, config?: ActionConfiguration): Promise<RecommendationsReport>;
    runActualCosts(config: ActionConfiguration): Promise<ActualCostReport>;
    runEstimate(config: ActionConfiguration): Promise<EstimateReport | undefined>;
    setupAnalyzerMode(config?: ActionConfiguration): Promise<void>;
    calculateSustainabilityMetrics(report: FinfocusReport): {
        totalCO2e: number;
        totalCO2eDiff: number;
        carbonIntensity: number;
    };
    calculateBudgetStatus(config: ActionConfiguration, report: FinfocusReport): BudgetStatus | undefined;
    extractBudgetStatus(stdout: string): BudgetStatus | undefined;
}
export interface RecommendationsSummary {
    total_count: number;
    total_savings: number;
    currency: string;
    count_by_action_type: Record<string, number>;
}
export interface Recommendation {
    resource_id: string;
    action_type: string;
    description: string;
    estimated_savings: number;
    currency: string;
}
export interface RecommendationsReport {
    summary: RecommendationsSummary;
    recommendations: Recommendation[];
}
/**
 * Parsed `estimate-spec` action input: a single-resource what-if estimate
 * for `finfocus cost estimate` (single-resource mode).
 */
export interface EstimateSpec {
    provider: string;
    resource_type: string;
    properties?: Record<string, string>;
    region?: string;
}
export interface EstimateDelta {
    property: string;
    originalValue: string;
    newValue: string;
    costChange: number;
}
export interface EstimateCostData {
    resourceType: string;
    resourceId: string;
    adapter: string;
    currency: string;
    monthly: number;
    hourly: number;
    notes?: string;
}
/**
 * JSON output of `finfocus cost estimate ... --output json` (finfocus v0.4.0).
 */
export interface EstimateReport {
    resource: {
        type: string;
        id: string;
        provider: string;
        properties?: Record<string, unknown>;
    };
    baseline: EstimateCostData;
    modified: EstimateCostData;
    totalChange: number;
    deltas: EstimateDelta[];
}
export interface ICommenter {
    upsertComment(report: FinfocusReport, token: string, config?: ActionConfiguration, recommendationsReport?: RecommendationsReport, actualCostReport?: ActualCostReport, sustainabilityReport?: SustainabilityReport, budgetStatus?: BudgetStatus, estimateReport?: EstimateReport): Promise<void>;
}
/**
 * Exit codes the action uses when checking budget thresholds.
 *
 * finfocus v0.4.0 reserves 0 (success), 1 (internal_error) and 2
 * (validation_error). The action passes `--exit-code 10` with
 * `--exit-on-threshold`, so THRESHOLD_BREACH is owned by the action and cannot
 * be confused with a finfocus error exit.
 */
export declare enum BudgetExitCode {
    /** All thresholds passed */
    PASS = 0,
    /** Budget threshold breached (action-owned code passed via --exit-code) */
    THRESHOLD_BREACH = 10
}
/**
 * JSON error envelope printed by finfocus on stderr for non-zero exits (v0.4.0).
 * See __tests__/fixtures/finfocus-v0.4.0/exit2-validation-error.json.
 */
export interface FinfocusErrorEnvelope {
    error_code: string;
    message: string;
    trace_id?: string;
    tool?: string;
    version?: string;
    schema_version?: string;
}
/**
 * Result of a budget threshold check.
 */
export interface BudgetThresholdResult {
    /** Whether the threshold check passed */
    passed: boolean;
    /** Severity level if threshold was breached */
    severity: 'none' | 'warning' | 'critical' | 'exceeded';
    /** The exit code returned by finfocus (if exit code method used) */
    exitCode?: number;
    /** Human-readable message for the result */
    message: string;
}
