import { ActionConfiguration } from './types.js';
export interface IConfigManager {
    writeConfig(config: ActionConfiguration): Promise<void>;
    writeScoringConfig(config: ActionConfiguration): Promise<void>;
}
export declare class ConfigManager implements IConfigManager {
    writeConfig(config: ActionConfiguration): Promise<void>;
    /**
     * Opt in to Jev recommendation scoring. finfocus reads `scoring.enabled` and
     * `scoring.plugin` from ~/.finfocus/config.yaml. The action does not write
     * TYPESAFE_API_KEY; the workflow must pass that secret in the environment.
     * An existing scoring section is left unchanged.
     */
    writeScoringConfig(config: ActionConfiguration): Promise<void>;
    private parseBudgetConfig;
    private validatePeriod;
    private parseAlerts;
    /**
     * Generate the finfocus config.yaml content.
     *
     * finfocus v0.4.0 reads budgets from `cost.budgets` using the scoped schema;
     * a top-level `budget:` key is ignored. The action writes a single `global`
     * budget so `cost projected` prints the BUDGET STATUS block and honors
     * `--exit-on-threshold`.
     */
    private generateYaml;
}
