import { IInstaller } from './types.js';
export declare class Installer implements IInstaller {
    install(version: string): Promise<string>;
    private verifyInstallation;
    private resolveVersion;
    private getPlatform;
    private getArch;
    private getBinaryName;
}
