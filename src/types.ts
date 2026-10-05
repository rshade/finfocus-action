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
  /** Opt-in `finfocus cost cluster` (v0.4.0+). Needs the kubernetes plugin and a kubeconfig. */
  includeClusterCosts?: boolean;
  /** `cost cluster --group-by`. Default namespace. */
  clusterGroupBy?: string;
  clusterNamespace?: string;
  clusterContext?: string;
  /** Comma-separated `key=value` pairs passed as repeatable `--selector`. */
  clusterSelector?: string;
  /** Opt-in Jev scoring. Writes `scoring.enabled` and `scoring.plugin: jev`. Needs TYPESAFE_API_KEY. */
  enableJevScoring?: boolean;
  /** Pass `cost recommendations --include-dismissed`. Default false, so dismissals stay out of the comment. */
  includeDismissedRecommendations?: boolean;
  /** JSON array of `{id, reason, note?}` applied with `cost recommendations dismiss` before the comment. */
  dismissRecommendations?: string;
  /** JSON array of `{id, until, reason?, note?}` applied with `cost recommendations snooze`. */
  snoozeRecommendations?: string;
  /**
   * Run `finfocus overview --state-only --pulumi-state`. The flag skips pulumi preview.
   * It is an overview flag, not a `cost projected` flag.
   */
  stateOnly?: boolean;
  /** finfocus `--filter` expressions (`type=ec2`, `tag:env=prod`). Passed to cost projected and cost actual. */
  resourceFilters?: string[];
  /** Comment grouping: resource, type, provider, service, or tag:<key>. */
  groupBy?: string;
  /** Hide resources whose monthly cost is below this amount. 0 keeps them. */
  minCostThreshold?: number;
  /** Maximum resource rows in the comment. 0 shows every row. */
  maxResourcesDisplayed?: number;
  /** Limit the resource table to resources whose Pulumi plan op is a change. */
  showOnlyChanges?: boolean;
  /** Resource table sort: cost, name, type, or change. */
  sortBy?: 'cost' | 'name' | 'type' | 'change';
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
  /** Pulumi plan op joined by resource urn. Set only for comment display. */
  change?: string;
  /** Pulumi plan tags joined by resource urn. Set only for comment display. */
  tags?: Record<string, string>;
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
export function isV041Diff(diff: any): diff is FinfocusReportDiff {
  return diff && typeof diff === 'object' && 'totalDelta' in diff;
}

export interface FinfocusReport {
  summary: FinfocusSummary;
  resources?: FinfocusResource[];
  // New fields for v0.4.1
  errors?: FinfocusReportError[] | null;
  diff?:
    | FinfocusReportDiff
    | {
        monthly_cost_change: number;
        percent_change: number;
      };
  // Legacy fields for backward compatibility
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
  runRecommendations(
    planPath: string,
    config?: ActionConfiguration,
  ): Promise<RecommendationsReport>;
  runActualCosts(config: ActionConfiguration): Promise<ActualCostReport>;
  runEstimate(config: ActionConfiguration): Promise<EstimateReport | undefined>;
  runCluster(config: ActionConfiguration): Promise<ClusterReport>;
  runStateOnly(config: ActionConfiguration): Promise<StateOnlyReport>;
  applyRecommendationLifecycle(
    planPath: string | undefined,
    config: ActionConfiguration,
  ): Promise<void>;
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
}

export interface RecommendationsSummary {
  total_count: number;
  total_savings: number;
  currency: string;
  count_by_action_type: Record<string, number>;
}

export interface RecommendationScores {
  risk?: number;
  false_positive?: number;
  worth_acting?: number;
  priority?: number;
  insufficient_evidence?: number;
  duplicate_group_id?: string;
  needs_review?: boolean;
}

export interface ScoringSummary {
  scorer?: string;
  model?: string;
  calibration?: string;
  requested: number;
  scored: number;
  unscored?: number;
  warnings?: string[];
}

export interface Recommendation {
  resource_id: string;
  action_type: string;
  description: string;
  estimated_savings: number;
  currency: string;
  /** finfocus recommendation id, used by dismiss and snooze. */
  id?: string;
  /** Active, Dismissed, or Snoozed. */
  status?: string;
  scores?: RecommendationScores;
}

export interface RecommendationsReport {
  summary: RecommendationsSummary;
  recommendations: Recommendation[];
  scoring?: ScoringSummary;
}

/** JSON output of `finfocus cost cluster --output json` (finfocus v0.4.0+). */
export interface ClusterGroup {
  key: string;
  cpu_cost: number;
  mem_cost: number;
  total_cost: number;
  rows: number;
  notes?: string[];
}

export interface ClusterReport {
  mode: string;
  period: string;
  currency: string;
  group_by: string;
  total: number;
  idle?: number;
  namespace_scoped: boolean;
  incomplete: boolean;
  groups: ClusterGroup[];
  warnings?: string[];
}

/** Summary of `finfocus overview --output json`. */
export interface StateOnlyReport {
  summary: {
    totalActualMTD: number;
    projectedMonthly: number;
    projectedDelta: number;
    potentialSavings: number;
    currency: string;
  };
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
  upsertComment(
    report: FinfocusReport,
    token: string,
    config?: ActionConfiguration,
    recommendationsReport?: RecommendationsReport,
    actualCostReport?: ActualCostReport,
    sustainabilityReport?: SustainabilityReport,
    budgetStatus?: BudgetStatus,
    estimateReport?: EstimateReport,
    clusterReport?: ClusterReport,
    stateOnlyReport?: StateOnlyReport,
  ): Promise<void>;
}

/**
 * Exit codes the action uses when checking budget thresholds.
 *
 * finfocus v0.4.0 reserves 0 (success), 1 (internal_error) and 2
 * (validation_error). The action passes `--exit-code 10` with
 * `--exit-on-threshold`, so THRESHOLD_BREACH is owned by the action and cannot
 * be confused with a finfocus error exit.
 */
export enum BudgetExitCode {
  /** All thresholds passed */
  PASS = 0,
  /** Budget threshold breached (action-owned code passed via --exit-code) */
  THRESHOLD_BREACH = 10,
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
