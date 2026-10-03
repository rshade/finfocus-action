import { ActionConfiguration } from './types.js';
export interface IConfigManager {
    writeConfig(config: ActionConfiguration): Promise<void>;
}
export declare class ConfigManager implements IConfigManager {
    writeConfig(config: ActionConfiguration): Promise<void>;
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
