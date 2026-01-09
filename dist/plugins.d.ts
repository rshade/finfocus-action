import { IPluginManager } from './types.js';
export declare class PluginManager implements IPluginManager {
    installPlugins(plugins: string[]): Promise<void>;
    private listInstalledPlugins;
}
