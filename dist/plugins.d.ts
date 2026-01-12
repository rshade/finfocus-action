import { IPluginManager, ActionConfiguration } from './types.js';
export declare class PluginManager implements IPluginManager {
    installPlugins(plugins: string[], config?: ActionConfiguration): Promise<void>;
    private listInstalledPlugins;
}
