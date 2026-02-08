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
/**
 * Check if the given version supports scoped budgets.
 * Requires finfocus v0.2.6 or higher.
 */
export declare function supportsScopedBudgets(version: string): boolean;
/**
 * Require a minimum finfocus version for scoped budgets.
 * Throws an error if the installed version is below v0.2.6.
 *
 * @param version - The installed finfocus version
 * @throws Error if version is below minimum required for scoped budgets
 */
export declare function requiresScopedBudgetVersion(version: string): void;
export declare class Installer implements IInstaller {
    install(version: string, config?: ActionConfiguration): Promise<string>;
    private verifyInstallation;
    private resolveVersion;
    private getPlatform;
    private getArch;
    protected getBinaryName(): string;
}
