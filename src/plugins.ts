import * as exec from '@actions/exec';
import * as core from '@actions/core';
import { IPluginManager } from './types';

export class PluginManager implements IPluginManager {
  async installPlugins(plugins: string[]): Promise<void> {
    if (plugins.length === 0) {
      core.info('No plugins to install');
      return;
    }

    for (const plugin of plugins) {
      const trimmedPlugin = plugin.trim();
      if (trimmedPlugin) {
        core.info(`Installing plugin: ${trimmedPlugin}`);
        await exec.exec('pulumicost', ['plugin', 'install', trimmedPlugin]);
      }
    }
  }
}
