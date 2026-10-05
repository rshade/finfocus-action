/**
 * Plugin specifiers accepted by `finfocus plugin install` (finfocus v0.4.0+).
 * Registry names, including `kubernetes` and `jev`, come from
 * `finfocus plugin list --available`. GitHub specifiers are accepted as-is.
 */

const REGISTRY_NAME = /^[a-z0-9][a-z0-9-]*$/;
const VERSION = /^[A-Za-z0-9._+-]+$/;
const GITHUB_SPEC =
  /^(?:https:\/\/)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:@[A-Za-z0-9._+-]+)?$/;

export interface PluginSpec {
  raw: string;
  /** Registry name, without a version. Empty for a GitHub specifier. */
  name: string;
  github: boolean;
}

export function parsePluginSpec(raw: string): PluginSpec {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Plugin name is empty.');
  }
  if (GITHUB_SPEC.test(trimmed)) {
    return { raw: trimmed, name: '', github: true };
  }

  const at = trimmed.indexOf('@');
  const name = at === -1 ? trimmed : trimmed.slice(0, at);
  const version = at === -1 ? '' : trimmed.slice(at + 1);
  if (!REGISTRY_NAME.test(name) || (version !== '' && !VERSION.test(version))) {
    throw new Error(
      `Invalid plugin name "${trimmed}". ` +
        `Use a registry name such as kubernetes or jev, an optional @version, ` +
        `or a github.com/owner/repo specifier.`,
    );
  }
  return { raw: trimmed, name, github: false };
}

/**
 * Names from `finfocus plugin list --available --output json`.
 * The v0.4.0 registry returns a JSON array of `{ name }` objects.
 */
export function registryNamesFromList(stdout: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch (err) {
    throw new Error(
      `finfocus plugin list --available did not return JSON: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  const list = Array.isArray(parsed)
    ? parsed
    : parsed &&
        typeof parsed === 'object' &&
        Array.isArray((parsed as { plugins?: unknown }).plugins)
      ? (parsed as { plugins: unknown[] }).plugins
      : undefined;
  if (!list) {
    throw new Error('finfocus plugin list --available did not return a JSON array of plugins.');
  }

  const names: string[] = [];
  for (const entry of list) {
    if (typeof entry === 'string' && entry) {
      names.push(entry);
    } else if (
      entry &&
      typeof entry === 'object' &&
      typeof (entry as { name?: unknown }).name === 'string'
    ) {
      names.push((entry as { name: string }).name);
    }
  }
  if (names.length === 0) {
    throw new Error('finfocus plugin list --available returned no plugin names.');
  }
  return names;
}

export function assertInstallablePlugin(spec: PluginSpec, registryNames: readonly string[]): void {
  if (spec.github) {
    return;
  }
  if (registryNames.includes(spec.name)) {
    return;
  }
  throw new Error(
    `Plugin "${spec.raw}" is not in the finfocus registry. ` +
      `Known plugins: ${registryNames.join(', ')}. ` +
      `Custom plugins must use a github.com/owner/repo specifier.`,
  );
}
