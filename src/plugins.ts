import * as exec from '@actions/exec';
import * as core from '@actions/core';
import { IPluginManager } from './types.js';

export class PluginManager implements IPluginManager {
  async installPlugins(plugins: string[]): Promise<void> {
    if (plugins.length === 0) {
      core.debug('No plugins to install');
      return;
    }

    core.info(`Installing ${plugins.length} plugin(s): ${plugins.join(', ')}`);

    for (const plugin of plugins) {
      const trimmedPlugin = plugin.trim();
      if (trimmedPlugin) {
        core.info(`Installing plugin: ${trimmedPlugin}`);
        core.debug(`Running: pulumicost plugin install ${trimmedPlugin}`);

        try {
          const output = await exec.getExecOutput(
            'pulumicost',
            ['plugin', 'install', trimmedPlugin],
            { silent: false, ignoreReturnCode: true }
          );

          if (output.exitCode !== 0) {
            throw new Error(
              `Failed to install plugin ${trimmedPlugin}.\n` +
                `Exit code: ${output.exitCode}\n` +
                `Stderr: ${output.stderr}`
            );
          }

          core.debug(`Plugin ${trimmedPlugin} installed successfully`);
        } catch (err) {
          throw new Error(
            `Error installing plugin ${trimmedPlugin}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    }

    await this.listInstalledPlugins();
  }

  private async listInstalledPlugins(): Promise<void> {
    try {
      core.debug('Listing installed plugins...');
      const output = await exec.getExecOutput('pulumicost', ['plugin', 'list'], {
        silent: true,
      });
      core.debug(`Installed plugins:\n${output.stdout}`);
    } catch (err) {
      core.debug(`Could not list plugins: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
