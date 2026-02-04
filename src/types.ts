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
  includeSustainability: boolean;
  utilizationRate: string;
  sustainabilityEquivalents: boolean;
  failOnCarbonIncrease: string | null;
  budgetAmount?: number;
  budgetCurrency?: string;
  budgetPeriod?: string;
  budgetAlerts?: string;
  /** Percentage threshold to trigger budget alert (default: 80) */
  budgetAlertThreshold?: number;
  /** Health score threshold to fail action (optional) */
  failOnBudgetHealth?: number;
  /** Whether to show budget forecast in PR comment (default: true) */
  showBudgetForecast?: boolean;
  /** Scoped budget configuration as YAML multiline string */
  budgetScopes?: string;
  /** Fail action if any scope exceeds budget */
  failOnBudgetScopeBreach?: boolean;
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

/**
 * Budget health status levels.
 * Used to classify the overall health of budget consumption.
 */
export type BudgetHealthStatus = 'healthy' | 'warning' | 'critical' | 'exceeded';

/**
 * Budget health report extending BudgetStatus with health-specific fields.
 * Returned from finfocus v0.2.5+ or calculated locally for older versions.
 */
export interface BudgetHealthReport extends BudgetStatus {
  /** Health score from 0-100 (100 = fully healthy) */
  healthScore?: number;
  /** Projected end-of-period spend (formatted string, e.g., "$1,890.00") */
  forecast?: string;
  /** Forecast as raw number for calculations */
  forecastAmount?: number;
  /** Days until budget exhausted at current burn rate */
  runwayDays?: number;
  /** Computed status based on health score and spend */
  healthStatus: BudgetHealthStatus;
}

/**
 * Raw JSON response from `finfocus budget status --output json` (v0.2.5+).
 */
export interface FinfocusBudgetStatusResponse {
  health_score: number;
  status: string;
  spent: number;
  remaining: number;
  percent_used: number;
  forecast: number;
  runway_days: number;
  budget: {
    amount: number;
    currency: string;
    period: string;
  };
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
  trees: number; // Annual offset
  milesDriven: number;
  homeElectricityDays: number;
}

export interface SustainabilityReport {
  totalCO2e: number; // kgCO2e/month
  totalCO2eDiff: number; // kgCO2e/month
  carbonIntensity: number; // gCO2e/USD
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

export interface FinfocusReport {
  summary: FinfocusSummary;
  resources?: FinfocusResource[];
  // Legacy fields for backward compatibility
  projected_monthly_cost?: number;
  currency?: string;
  diff?: {
    monthly_cost_change: number;
    percent_change: number;
  };
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
  runRecommendations(
    planPath: string,
    config?: ActionConfiguration,
  ): Promise<RecommendationsReport>;
  runActualCosts(config: ActionConfiguration): Promise<ActualCostReport>;
  setupAnalyzerMode(config?: ActionConfiguration): Promise<void>;
  calculateSustainabilityMetrics(report: FinfocusReport): {
    totalCO2e: number;
    totalCO2eDiff: number;
    carbonIntensity: number;
  };
  calculateBudgetStatus(
    config: ActionConfiguration,
    report: FinfocusReport,
  ): BudgetStatus | undefined;
  extractBudgetStatus(stdout: string): BudgetStatus | undefined;
  runBudgetStatus(config: ActionConfiguration): Promise<BudgetHealthReport | undefined>;
  runScopedBudgetStatus(config: ActionConfiguration): Promise<ScopedBudgetReport | undefined>;
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

export interface ICommenter {
  upsertComment(
    report: FinfocusReport,
    token: string,
    config?: ActionConfiguration,
    recommendationsReport?: RecommendationsReport,
    actualCostReport?: ActualCostReport,
    sustainabilityReport?: SustainabilityReport,
    budgetStatus?: BudgetStatus,
    budgetHealth?: BudgetHealthReport,
    scopedBudgetReport?: ScopedBudgetReport,
  ): Promise<void>;
}

/**
 * Exit codes returned by finfocus CLI for budget threshold checks.
 * Only applicable for finfocus v0.2.5 and above.
 */
export enum BudgetExitCode {
  /** All thresholds passed */
  PASS = 0,
  /** Warning threshold breached */
  WARNING = 1,
  /** Critical threshold breached */
  CRITICAL = 2,
  /** Budget exceeded */
  EXCEEDED = 3,
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

// ============================================================================
// Scoped Budgets Types (finfocus v0.2.6+)
// ============================================================================

/**
 * Type of budget scope.
 * - provider: Cloud provider (aws, gcp, azure)
 * - type: Resource type (compute, storage, networking)
 * - tag: Cost allocation tag (key:value format)
 */
export type BudgetScopeType = 'provider' | 'type' | 'tag';

/**
 * A single scoped budget configuration parsed from user input.
 */
export interface BudgetScope {
  /** Full scope identifier (e.g., "provider/aws", "tag/env:prod") */
  scope: string;

  /** Scope category */
  scopeType: BudgetScopeType;

  /** Scope key within category (e.g., "aws", "compute", "env:prod") */
  scopeKey: string;

  /** Budget limit amount */
  amount: number;
}

/**
 * Alert configuration and status for a scope.
 */
export interface ScopedBudgetAlert {
  /** Threshold percentage */
  threshold: number;

  /** Alert type */
  type: 'actual' | 'forecasted';

  /** Whether alert is triggered */
  triggered: boolean;
}

/**
 * Status of a single scoped budget returned from finfocus CLI.
 */
export interface ScopedBudgetStatus {
  /** Full scope identifier */
  scope: string;

  /** Scope category */
  scopeType: BudgetScopeType;

  /** Scope key within category */
  scopeKey: string;

  /** Amount spent in this scope */
  spent: number;

  /** Budget limit for this scope */
  budget: number;

  /** Currency code */
  currency: string;

  /** Percentage of budget used (0-100+) */
  percentUsed: number;

  /** Health status */
  status: BudgetHealthStatus;

  /** Triggered alerts for this scope */
  alerts: ScopedBudgetAlert[];
}

/**
 * Represents a scope that failed to process.
 */
export interface ScopedBudgetFailure {
  /** Scope that failed */
  scope: string;

  /** Error message */
  error: string;
}

/**
 * Collection of all scope statuses returned from finfocus CLI.
 */
export interface ScopedBudgetReport {
  /** Array of scope statuses */
  scopes: ScopedBudgetStatus[];

  /** Scopes that failed to process */
  failed: ScopedBudgetFailure[];
}

/**
 * Raw scope entry from finfocus CLI v0.2.6+ JSON response.
 */
export interface FinfocusScopeEntry {
  scope: string;
  type: string;
  key: string;
  spent: number;
  budget: number;
  currency: string;
  percent_used: number;
  status: string;
  alerts?: Array<{
    threshold: number;
    type: string;
    triggered: boolean;
  }>;
}

/**
 * Raw JSON response from `finfocus budget status --output json` (v0.2.6+) with scopes.
 */
export interface FinfocusScopedBudgetResponse {
  finfocus?: {
    scopes?: FinfocusScopeEntry[];
    errors?: Array<{
      scope: string;
      error: string;
    }>;
  };
  scopes?: FinfocusScopeEntry[];
  errors?: Array<{
    scope: string;
    error: string;
  }>;
}
