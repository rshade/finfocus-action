export interface ActionConfiguration {
  pulumiPlanJsonPath: string;
  githubToken: string;
  pulumicostVersion: string;
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

export interface PulumicostSustainabilityMetric {
  value: number;
  unit: string;
}

export interface PulumicostSustainabilityData {
  gCO2e: PulumicostSustainabilityMetric;
  carbon_footprint: PulumicostSustainabilityMetric;
}

export interface PulumicostResource {
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
  sustainability?: PulumicostSustainabilityData;
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

export interface PulumicostSummary {
  totalMonthly: number;
  totalHourly: number;
  currency: string;
  byProvider?: Record<string, number>;
  byService?: Record<string, number>;
  byAdapter?: Record<string, number>;
  resources?: PulumicostResource[];
}

export interface PulumicostReport {
  summary: PulumicostSummary;
  resources?: PulumicostResource[];
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
  runAnalysis(planPath: string, config?: ActionConfiguration): Promise<PulumicostReport>;
  runRecommendations(
    planPath: string,
    config?: ActionConfiguration,
  ): Promise<RecommendationsReport>;
  runActualCosts(config: ActionConfiguration): Promise<ActualCostReport>;
  setupAnalyzerMode(config?: ActionConfiguration): Promise<void>;
  calculateSustainabilityMetrics(report: PulumicostReport): {
    totalCO2e: number;
    totalCO2eDiff: number;
    carbonIntensity: number;
  };
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
    report: PulumicostReport,
    token: string,
    config?: ActionConfiguration,
    recommendationsReport?: RecommendationsReport,
    actualCostReport?: ActualCostReport,
    sustainabilityReport?: SustainabilityReport,
  ): Promise<void>;
}
