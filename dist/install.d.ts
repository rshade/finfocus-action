import { IInstaller, ActionConfiguration } from './types.js';
/**
 * Get the installed finfocus version by running `finfocus --version`.
 * Returns '0.0.0' if version cannot be determined.
 */
export declare function getFinfocusVersion(): Promise<string>;
/**
 * Check if the given version supports exit codes for budget threshold checks.
 * Requires finfocus v0.2.5 or higher.
 */
export declare function supportsExitCodes(version: string): boolean;
export declare class Installer implements IInstaller {
    install(version: string, config?: ActionConfiguration): Promise<string>;
    private verifyInstallation;
    private resolveVersion;
    private getPlatform;
    private getArch;
    protected getBinaryName(): string;
}
