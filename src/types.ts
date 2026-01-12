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
  logLevel: string;
  debug: boolean;
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
}

export interface IInstaller {
  install(version: string, config?: ActionConfiguration): Promise<string>;
}

export interface IPluginManager {
  installPlugins(plugins: string[], config?: ActionConfiguration): Promise<void>;
}

export interface IAnalyzer {
  runAnalysis(planPath: string, config?: ActionConfiguration): Promise<PulumicostReport>;
  setupAnalyzerMode(config?: ActionConfiguration): Promise<void>;
}

export interface ICommenter {
  upsertComment(report: PulumicostReport, token: string, config?: ActionConfiguration): Promise<void>;
}
