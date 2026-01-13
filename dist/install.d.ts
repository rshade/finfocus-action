import { IInstaller, ActionConfiguration } from './types.js';
export declare class Installer implements IInstaller {
    install(version: string, config?: ActionConfiguration): Promise<string>;
    private verifyInstallation;
    private resolveVersion;
    private getPlatform;
    private getArch;
    protected getBinaryName(): string;
}
