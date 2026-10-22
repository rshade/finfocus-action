import { ActionConfiguration } from './types.js';
export interface IConfigManager {
    writeConfig(config: ActionConfiguration): Promise<void>;
    writeScoringConfig(config: ActionConfiguration): Promise<void>;
}
export declare class ConfigManager implements IConfigManager {
    writeConfig(config: ActionConfiguration): Promise<void>;
    /**
     * Opt in to Jev recommendation scoring. finfocus reads `scoring.enabled` and
     * `scoring.plugin` from config.hujson. The action does not write
     * TYPESAFE_API_KEY; the workflow must pass that secret in the environment.
     * An existing scoring section is left unchanged.
     */
    writeScoringConfig(config: ActionConfiguration): Promise<void>;
    /**
     * Directory finfocus reads, in the same order as ResolveConfigDir:
     * FINFOCUS_HOME, then $PULUMI_HOME/finfocus, then ~/.finfocus.
     */
    private configDir;
    private readDocument;
    private parseDocument;
    private mergeBudget;
    private writeDocument;
    private parseBudgetConfig;
    private validatePeriod;
    private parseAlerts;
}
