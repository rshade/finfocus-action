/**
 * Internal contracts for finfocus-action services.
 */

export interface IInstaller {
  /**
   * Downloads and installs finfocus binary.
   * @param version "latest" or semver string.
   */
  install(version: string): Promise<string>;
}

export interface IPluginManager {
  /**
   * Installs the specified finfocus plugins.
   */
  installPlugins(plugins: string[]): Promise<void>;
}

export interface IAnalyzer {
  /**
   * Executes cost analysis against a Pulumi JSON plan.
   */
  runAnalysis(planPath: string): Promise<FinfocusReport>;

  /**
   * Configures the environment for Pulumi Analyzer mode.
   */
  setupAnalyzerMode(): Promise<void>;
}

export interface ICommenter {
  /**
   * Posts or updates a PR comment with the cost report.
   */
  upsertComment(report: FinfocusReport, token: string): Promise<void>;
}

export interface FinfocusReport {
  projected_monthly_cost: number;
  currency: string;
  diff?: {
    monthly_cost_change: number;
    percent_change: number;
  };
}
