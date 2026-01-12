import * as exec from '@actions/exec';
import * as core from '@actions/core';
import * as fs from 'fs';
import { PluginManager } from '../../src/plugins.js';

jest.mock('@actions/exec');
jest.mock('@actions/core');
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readdirSync: jest.fn(),
  statSync: jest.fn(),
}));

describe('PluginManager', () => {
  let pluginManager: PluginManager;

  beforeEach(() => {
    pluginManager = new PluginManager();
    jest.clearAllMocks();
    (exec.getExecOutput as jest.Mock).mockResolvedValue({
      exitCode: 0,
      stdout: 'installed',
      stderr: '',
    });
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readdirSync as jest.Mock).mockReturnValue(['aws-plugin']);
    (fs.statSync as jest.Mock).mockReturnValue({ isDirectory: () => false, size: 100 });
  });

  it('should skip if no plugins provided', async () => {
    await pluginManager.installPlugins([]);
    expect(exec.getExecOutput).not.toHaveBeenCalledWith(
      'pulumicost',
      expect.arrayContaining(['plugin', 'install']),
      expect.anything()
    );
  });

  it('should install plugins correctly', async () => {
    await pluginManager.installPlugins(['aws-plugin', ' kubecost ']);

    expect(exec.getExecOutput).toHaveBeenCalledWith(
      'pulumicost',
      ['plugin', 'install', 'aws-plugin'],
      expect.objectContaining({ silent: true, ignoreReturnCode: true })
    );
    expect(exec.getExecOutput).toHaveBeenCalledWith(
      'pulumicost',
      ['plugin', 'install', 'kubecost'],
      expect.objectContaining({ silent: true, ignoreReturnCode: true })
    );
  });

  it('should skip empty strings', async () => {
    await pluginManager.installPlugins(['', '  ']);

    const installCalls = (exec.getExecOutput as jest.Mock).mock.calls.filter(
      (call: unknown[]) =>
        Array.isArray(call[1]) && call[1].includes('install')
    );
    expect(installCalls).toHaveLength(0);
  });

  it('should throw error if plugin install fails', async () => {
    (exec.getExecOutput as jest.Mock).mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'plugin not found',
    });

    await expect(pluginManager.installPlugins(['bad-plugin'])).rejects.toThrow(
      'Failed to install plugin bad-plugin'
    );
  });

  it('should list installed plugins after installation', async () => {
    await pluginManager.installPlugins(['aws-plugin'], { debug: true } as any);

    expect(exec.getExecOutput).toHaveBeenCalledWith(
      'pulumicost',
      ['plugin', 'list'],
      expect.objectContaining({ silent: false, ignoreReturnCode: true })
    );
  });
});