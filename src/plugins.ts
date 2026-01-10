import * as exec from '@actions/exec';
import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { IPluginManager } from './types.js';

export class PluginManager implements IPluginManager {
  async installPlugins(plugins: string[]): Promise<void> {
    core.info(`=== PluginManager: Starting plugin installation ===`);
    core.info(`  Plugins to install: [${plugins.map(p => `"${p}"`).join(', ')}]`);
    
    if (plugins.length === 0) {
      core.info(`  No plugins to install`);
      return;
    }

    const pluginDir = path.join(os.homedir(), '.pulumicost', 'plugins');
    core.info(`  Plugin directory: ${pluginDir}`);
    core.info(`  Plugin directory exists: ${fs.existsSync(pluginDir)}`);

    for (let i = 0; i < plugins.length; i++) {
      const plugin = plugins[i];
      const trimmedPlugin = plugin.trim();
      
      core.info(`=== Installing plugin ${i + 1}/${plugins.length}: "${trimmedPlugin}" ===`);
      
      if (!trimmedPlugin) {
        core.info(`  Skipping empty plugin name`);
        continue;
      }

      const args = ['plugin', 'install', trimmedPlugin];
      core.info(`  Command: pulumicost ${args.join(' ')}`);

      try {
        const installStart = Date.now();
        const output = await exec.getExecOutput('pulumicost', args, {
          silent: false,
          ignoreReturnCode: true,
        });

        core.info(`  Installation took: ${Date.now() - installStart}ms`);
        core.info(`  Exit code: ${output.exitCode}`);
        core.info(`  Stdout length: ${output.stdout.length} chars`);
        
        if (output.stdout) {
          core.info(`  Stdout:\n${output.stdout}`);
        }
        
        if (output.stderr) {
          core.info(`  Stderr:\n${output.stderr}`);
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

        core.info(`  Plugin "${trimmedPlugin}" installed successfully`);
      } catch (err) {
        core.error(`  Plugin installation threw exception`);
        core.error(`  Error type: ${err instanceof Error ? err.name : typeof err}`);
        core.error(`  Error message: ${err instanceof Error ? err.message : String(err)}`);
        if (err instanceof Error && err.stack) {
          core.error(`  Stack: ${err.stack}`);
        }
        throw new Error(
          `Error installing plugin ${trimmedPlugin}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    core.info(`=== Listing installed plugins ===`);
    await this.listInstalledPlugins();
    
    core.info(`=== Checking plugin directory contents ===`);
    if (fs.existsSync(pluginDir)) {
      const contents = fs.readdirSync(pluginDir);
      core.info(`  Plugin directory contents: ${contents.join(', ') || '(empty)'}`);
      
      for (const item of contents) {
        const itemPath = path.join(pluginDir, item);
        const stat = fs.statSync(itemPath);
        if (stat.isDirectory()) {
          const subContents = fs.readdirSync(itemPath);
          core.info(`    ${item}/ -> ${subContents.join(', ')}`);
        } else {
          core.info(`    ${item} (${stat.size} bytes)`);
        }
      }
    } else {
      core.info(`  Plugin directory does not exist`);
    }
  }

  private async listInstalledPlugins(): Promise<void> {
    try {
      core.info(`  Running: pulumicost plugin list`);
      const output = await exec.getExecOutput('pulumicost', ['plugin', 'list'], {
        silent: false,
        ignoreReturnCode: true,
      });
      core.info(`  Exit code: ${output.exitCode}`);
      core.info(`  Stdout:\n${output.stdout || '(empty)'}`);
      if (output.stderr) {
        core.info(`  Stderr:\n${output.stderr}`);
      }
    } catch (err) {
      core.warning(`  Could not list plugins: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
