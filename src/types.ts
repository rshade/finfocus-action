export interface ActionConfiguration {
  pulumiPlanJsonPath: string;
  githubToken: string;
  pulumicostVersion: string;
  installPlugins: string[];
  behaviorOnError: 'fail' | 'warn' | 'silent';
  postComment: boolean;
  threshold: string | null;
  analyzerMode: boolean;
}

export interface PulumicostReport {
  projected_monthly_cost: number;
  currency: string;
  diff?: {
    monthly_cost_change: number;
    percent_change: number;
  };
  resources?: Array<{
    urn: string;
    monthly_cost: number;
  }>;
}

export interface CostAssessment {
  totalMonthlyCost: number;
  monthlyCostDiff: number;
  currency: string;
  reportPath: string;
  failedThreshold: boolean;
}

export interface IInstaller {
  install(version: string): Promise<string>;
}

export interface IPluginManager {
  installPlugins(plugins: string[]): Promise<void>;
}

export interface IAnalyzer {
  runAnalysis(planPath: string): Promise<PulumicostReport>;
  setupAnalyzerMode(): Promise<void>;
}

export interface ICommenter {
  upsertComment(report: PulumicostReport, token: string): Promise<void>;
}
