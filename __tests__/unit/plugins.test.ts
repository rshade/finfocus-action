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

const registryStdout = JSON.stringify([
  { name: 'aws-public' },
  { name: 'kubernetes' },
  { name: 'jev' },
  { name: 'kubecost' },
]);

describe('PluginManager', () => {
  let pluginManager: PluginManager;

  beforeEach(() => {
    pluginManager = new PluginManager();
    jest.clearAllMocks();
    (exec.getExecOutput as jest.Mock).mockImplementation(async (_cmd: string, args: string[]) => {
      if (args.includes('--available')) {
        return { exitCode: 0, stdout: registryStdout, stderr: '' };
      }
      return { exitCode: 0, stdout: 'installed', stderr: '' };
    });
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readdirSync as jest.Mock).mockReturnValue(['aws-plugin']);
    (fs.statSync as jest.Mock).mockReturnValue({ isDirectory: () => false, size: 100 });
  });

  it('should skip if no plugins provided', async () => {
    await pluginManager.installPlugins([]);
    expect(exec.getExecOutput).not.toHaveBeenCalledWith(
      'finfocus',
      expect.arrayContaining(['plugin', 'install']),
      expect.anything(),
    );
  });

  it('should install plugins correctly', async () => {
    await pluginManager.installPlugins(['aws-public', ' kubecost ']);

    expect(exec.getExecOutput).toHaveBeenCalledWith(
      'finfocus',
      ['plugin', 'install', 'aws-public'],
      expect.objectContaining({ silent: true, ignoreReturnCode: true }),
    );
    expect(exec.getExecOutput).toHaveBeenCalledWith(
      'finfocus',
      ['plugin', 'install', 'kubecost'],
      expect.objectContaining({ silent: true, ignoreReturnCode: true }),
    );
  });

  it('should accept kubernetes and jev registry names', async () => {
    await pluginManager.installPlugins(['kubernetes', 'jev@v1.2.3']);

    expect(exec.getExecOutput).toHaveBeenCalledWith(
      'finfocus',
      ['plugin', 'install', 'kubernetes'],
      expect.anything(),
    );
    expect(exec.getExecOutput).toHaveBeenCalledWith(
      'finfocus',
      ['plugin', 'install', 'jev@v1.2.3'],
      expect.anything(),
    );
  });

  it('should accept a github.com specifier that is not in the registry', async () => {
    await pluginManager.installPlugins(['github.com/rshade/finfocus-plugin-aws-public']);

    expect(exec.getExecOutput).toHaveBeenCalledWith(
      'finfocus',
      ['plugin', 'install', 'github.com/rshade/finfocus-plugin-aws-public'],
      expect.anything(),
    );
  });

  it('should reject a name that is not in the registry', async () => {
    await expect(pluginManager.installPlugins(['not-a-plugin'])).rejects.toThrow(
      'not in the finfocus registry',
    );
    expect(exec.getExecOutput).not.toHaveBeenCalledWith(
      'finfocus',
      ['plugin', 'install', 'not-a-plugin'],
      expect.anything(),
    );
  });

  it('should skip empty strings', async () => {
    await pluginManager.installPlugins(['', '  ']);

    const installCalls = (exec.getExecOutput as jest.Mock).mock.calls.filter(
      (call: unknown[]) => Array.isArray(call[1]) && call[1].includes('install'),
    );
    expect(installCalls).toHaveLength(0);
  });

  it('should throw error if plugin install fails', async () => {
    (exec.getExecOutput as jest.Mock).mockImplementation(async (_cmd: string, args: string[]) => {
      if (args.includes('--available')) {
        return { exitCode: 0, stdout: registryStdout, stderr: '' };
      }
      return { exitCode: 1, stdout: '', stderr: 'plugin not found' };
    });

    await expect(pluginManager.installPlugins(['aws-public'])).rejects.toThrow(
      'Failed to install plugin aws-public',
    );
  });

  it('should list installed plugins after installation', async () => {
    await pluginManager.installPlugins(['aws-public'], { debug: true } as any);

    expect(exec.getExecOutput).toHaveBeenCalledWith(
      'finfocus',
      ['plugin', 'list'],
      expect.objectContaining({ silent: false, ignoreReturnCode: true }),
    );
  });
});
