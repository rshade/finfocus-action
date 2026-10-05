/**
 * Plugin specifiers accepted by `finfocus plugin install` (finfocus v0.4.0+).
 * Registry names, including `kubernetes` and `jev`, come from
 * `finfocus plugin list --available`. GitHub specifiers are accepted as-is.
 */
export interface PluginSpec {
    raw: string;
    /** Registry name, without a version. Empty for a GitHub specifier. */
    name: string;
    github: boolean;
}
export declare function parsePluginSpec(raw: string): PluginSpec;
/**
 * Names from `finfocus plugin list --available --output json`.
 * The v0.4.0 registry returns a JSON array of `{ name }` objects.
 */
export declare function registryNamesFromList(stdout: string): string[];
export declare function assertInstallablePlugin(spec: PluginSpec, registryNames: readonly string[]): void;
