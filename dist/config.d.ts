import { ActionConfiguration } from './types.js';
export interface IConfigManager {
    writeConfig(config: ActionConfiguration): Promise<void>;
}
export declare class ConfigManager implements IConfigManager {
    writeConfig(config: ActionConfiguration): Promise<void>;
    private parseBudgetConfig;
    private validatePeriod;
    private parseAlerts;
    private generateYaml;
}
