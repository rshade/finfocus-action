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

export interface ICommenter {
  upsertComment(
    report: FinfocusReport,
    token: string,
    config?: ActionConfiguration,
    recommendationsReport?: RecommendationsReport,
    actualCostReport?: ActualCostReport,
    sustainabilityReport?: SustainabilityReport,
    budgetStatus?: BudgetStatus,
  ): Promise<void>;
}
