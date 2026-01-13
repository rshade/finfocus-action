import * as exec from '@actions/exec';
import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { IPluginManager, ActionConfiguration } from './types.js';

export class PluginManager implements IPluginManager {
  async installPlugins(plugins: string[], config?: ActionConfiguration): Promise<void> {
    const debug = config?.debug === true;
    
    if (debug) {
      core.info(`=== PluginManager: Starting plugin installation ===`);
      core.info(`  Plugins to install: [${plugins.map(p => `"${p}"`).join(', ')}]`);
    }
    
    if (plugins.length === 0) {
      if (debug) core.info(`  No plugins to install`);
      return;
    }

    const pluginDir = path.join(os.homedir(), '.pulumicost', 'plugins');
    if (debug) {
      core.info(`  Plugin directory: ${pluginDir}`);
      core.info(`  Plugin directory exists: ${fs.existsSync(pluginDir)}`);
    }

    for (let i = 0; i < plugins.length; i++) {
      const plugin = plugins[i];
      const trimmedPlugin = plugin.trim();
      
      if (debug) core.info(`=== Installing plugin ${i + 1}/${plugins.length}: "${trimmedPlugin}" ===`);
      else core.info(`Installing pulumicost plugin: "${trimmedPlugin}"`);
      
      if (!trimmedPlugin) {
        if (debug) core.info(`  Skipping empty plugin name`);
        continue;
      }

      // We avoid the progress bar in logs by using silent mode in exec
      const args = ['plugin', 'install', trimmedPlugin];
      
      if (debug) core.info(`  Command: pulumicost ${args.join(' ')}`);

      try {
        const installStart = Date.now();
        const output = await exec.getExecOutput('pulumicost', args, {
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
              `Stdout: ${output.stdout}`
          );
        }

        if (debug) core.info(`  Plugin "${trimmedPlugin}" installed successfully`);
      } catch (err) {
        core.error(`  Plugin installation threw exception`);
        core.error(`  Error message: ${err instanceof Error ? err.message : String(err)}`);
        throw new Error(
          `Error installing plugin ${trimmedPlugin}: ${err instanceof Error ? err.message : String(err)}`
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

  private async listInstalledPlugins(debug: boolean): Promise<void> {
    try {
      if (debug) core.info(`  Running: pulumicost plugin list`);
      const output = await exec.getExecOutput('pulumicost', ['plugin', 'list'], {
        silent: !debug,
        ignoreReturnCode: true,
      });
      if (debug) {
        core.info(`  Exit code: ${output.exitCode}`);
        core.info(`  Stdout:\n${output.stdout || '(empty)'}`);
      }
    } catch (err) {
      if (debug) core.warning(`  Could not list plugins: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
