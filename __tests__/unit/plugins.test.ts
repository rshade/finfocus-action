import * as exec from '@actions/exec';
import * as core from '@actions/core';
import { PluginManager } from '../../src/plugins.js';

jest.mock('@actions/exec');
jest.mock('@actions/core');

describe('PluginManager', () => {
  let pluginManager: PluginManager;

  beforeEach(() => {
    pluginManager = new PluginManager();
    jest.clearAllMocks();
  });

  it('should skip if no plugins provided', async () => {
    await pluginManager.installPlugins([]);
    expect(exec.exec).not.toHaveBeenCalled();
    expect(core.info).toHaveBeenCalledWith('No plugins to install');
  });

  it('should install plugins correctly', async () => {
    await pluginManager.installPlugins(['aws-plugin', ' kubecost ']);
    
    expect(exec.exec).toHaveBeenCalledTimes(2);
    expect(exec.exec).toHaveBeenCalledWith('pulumicost', ['plugin', 'install', 'aws-plugin']);
    expect(exec.exec).toHaveBeenCalledWith('pulumicost', ['plugin', 'install', 'kubecost']);
  });

  it('should skip empty strings', async () => {
    await pluginManager.installPlugins(['', '  ']);
    expect(exec.exec).not.toHaveBeenCalled();
  });
});
