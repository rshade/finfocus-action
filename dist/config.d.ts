import { ActionConfiguration, BudgetScope } from './types.js';
/** Soft limit for number of scopes before warning is logged */
export declare const SCOPE_SOFT_LIMIT = 20;
/**
 * Parse budget scopes from YAML multiline input string.
 * Each line should be in format: "scope: amount"
 * Valid scope formats: provider/aws, type/compute, tag/env:prod
 *
 * Invalid scopes are logged as warnings and skipped.
 * A warning is logged if more than SCOPE_SOFT_LIMIT scopes are configured.
 *
 * @param input - YAML multiline string of scope:amount pairs
 * @returns Array of parsed BudgetScope objects
 */
export declare function parseBudgetScopes(input: string): BudgetScope[];
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
