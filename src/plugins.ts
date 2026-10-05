import * as exec from '@actions/exec';
import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { IPluginManager, ActionConfiguration } from './types.js';
import { assertInstallablePlugin, parsePluginSpec, registryNamesFromList } from './plugin-specs.js';

export class PluginManager implements IPluginManager {
  async installPlugins(plugins: string[], config?: ActionConfiguration): Promise<void> {
    const debug = config?.debug === true;

    if (debug) {
      core.info(`=== PluginManager: Starting plugin installation ===`);
      core.info(`  Plugins to install: [${plugins.map((p) => `"${p}"`).join(', ')}]`);
    }

    const requested = plugins.map((plugin) => plugin.trim()).filter((plugin) => plugin.length > 0);
    if (requested.length === 0) {
      if (debug) core.info(`  No plugins to install`);
      return;
    }

    const registryNames = await this.availablePluginNames(debug);
    for (const plugin of requested) {
      assertInstallablePlugin(parsePluginSpec(plugin), registryNames);
    }

    const pluginDir = path.join(os.homedir(), '.finfocus', 'plugins');
    if (debug) {
      core.info(`  Plugin directory: ${pluginDir}`);
      core.info(`  Plugin directory exists: ${fs.existsSync(pluginDir)}`);
    }

    for (let i = 0; i < requested.length; i++) {
      const trimmedPlugin = requested[i];

      if (debug)
        core.info(`=== Installing plugin ${i + 1}/${requested.length}: "${trimmedPlugin}" ===`);
      else core.info(`Installing finfocus plugin: "${trimmedPlugin}"`);

      // We avoid the progress bar in logs by using silent mode in exec
      const args = ['plugin', 'install', trimmedPlugin];

      if (debug) core.info(`  Command: finfocus ${args.join(' ')}`);

      try {
        const installStart = Date.now();
        const output = await exec.getExecOutput('finfocus', args, {
          silent: !debug,
          ignoreReturnCode: true,
        });

        if (debug) {
          core.info(`  Installation took: ${Date.now() - installStart}ms`);
          core.info(`  Exit code: ${output.exitCode}`);
          core.info(`  Stdout length: ${output.stdout.length} chars`);

          if (output.stdout) {
            core.info(`  Stdout:\n${output.stdout}`);
          }

          if (output.stderr) {
            core.info(`  Stderr:\n${output.stderr}`);
          }
        }

        if (output.exitCode !== 0) {
          core.error(`  Plugin installation FAILED with exit code ${output.exitCode}`);
          throw new Error(
            `Failed to install plugin ${trimmedPlugin}.\n` +
              `Exit code: ${output.exitCode}\n` +
              `Stderr: ${output.stderr}\n` +
              `Stdout: ${output.stdout}`,
          );
        }

        if (debug) core.info(`  Plugin "${trimmedPlugin}" installed successfully`);
      } catch (err) {
        core.error(`  Plugin installation threw exception`);
        core.error(`  Error message: ${err instanceof Error ? err.message : String(err)}`);
        throw new Error(
          `Error installing plugin ${trimmedPlugin}: ${err instanceof Error ? err.message : String(err)}`,
          { cause: err },
        );
      }
    }

    if (debug) {
      core.info(`=== Listing installed plugins ===`);
      await this.listInstalledPlugins(debug);

      core.info(`=== Checking plugin directory contents ===`);
      if (fs.existsSync(pluginDir)) {
        const contents = fs.readdirSync(pluginDir);
        core.info(`  Plugin directory contents: ${contents.join(', ') || '(empty)'}`);
      }
    }
  }

  private async availablePluginNames(debug: boolean): Promise<string[]> {
    if (debug) core.info(`  Running: finfocus plugin list --available --output json`);
    const output = await exec.getExecOutput(
      'finfocus',
      ['plugin', 'list', '--available', '--output', 'json'],
      { silent: !debug, ignoreReturnCode: true },
    );
    if (output.exitCode !== 0) {
      throw new Error(
        `Failed to list registry plugins.\n` +
          `Exit code: ${output.exitCode}\n` +
          `Stderr: ${output.stderr}\n` +
          `Stdout: ${output.stdout}`,
      );
    }
    const names = registryNamesFromList(output.stdout);
    if (debug) core.info(`  Registry plugins: ${names.join(', ')}`);
    return names;
  }

  private async listInstalledPlugins(debug: boolean): Promise<void> {
    try {
      if (debug) core.info(`  Running: finfocus plugin list`);
      const output = await exec.getExecOutput('finfocus', ['plugin', 'list'], {
        silent: !debug,
        ignoreReturnCode: true,
      });
      if (debug) {
        core.info(`  Exit code: ${output.exitCode}`);
        core.info(`  Stdout:\n${output.stdout || '(empty)'}`);
      }
    } catch (err) {
      if (debug)
        core.warning(
          `  Could not list plugins: ${err instanceof Error ? err.message : String(err)}`,
        );
    }
  }
}
