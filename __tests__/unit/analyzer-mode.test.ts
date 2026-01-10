import * as fs from 'fs';
import * as os from 'os';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { Analyzer } from '../../src/analyze.js';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  copyFileSync: jest.fn(),
  chmodSync: jest.fn(),
}));
jest.mock('os');
jest.mock('@actions/core');
jest.mock('@actions/exec');

describe('Analyzer Mode', () => {
  let analyzer: Analyzer;

  beforeEach(() => {
    analyzer = new Analyzer();
    jest.clearAllMocks();
    (os.homedir as jest.Mock).mockReturnValue('/home/user');
  });

  it('should setup analyzer mode correctly', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    // Mock exec calls:
    // 1. pulumicost version
    // 2. which pulumicost
    (exec.getExecOutput as jest.Mock)
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: 'v1.2.3\n',
        stderr: '',
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: '/usr/local/bin/pulumicost\n',
        stderr: '',
      });

    await analyzer.setupAnalyzerMode();

    // Verify version check
    expect(exec.getExecOutput).toHaveBeenNthCalledWith(
      1,
      'pulumicost',
      ['version'],
      { silent: true }
    );

    // Verify plugin directory creation
    // Path should be ~/.pulumi/plugins/analyzer-cost-v1.2.3
    const expectedPluginDir = '/home/user/.pulumi/plugins/analyzer-cost-v1.2.3';
    expect(fs.mkdirSync).toHaveBeenCalledWith(expectedPluginDir, { recursive: true });

    // Verify finding binary
    expect(exec.getExecOutput).toHaveBeenNthCalledWith(
      2,
      'which',
      ['pulumicost'],
      { silent: true }
    );

    // Verify copy
    const expectedBinaryPath = `${expectedPluginDir}/pulumi-analyzer-cost`;
    expect(fs.copyFileSync).toHaveBeenCalledWith(
      '/usr/local/bin/pulumicost',
      expectedBinaryPath
    );

    // Verify chmod
    expect(fs.chmodSync).toHaveBeenCalledWith(expectedBinaryPath, 0o755);

    // Verify NO policy pack stuff
    expect(fs.writeFileSync).not.toHaveBeenCalled(); // No PulumiPolicy.yaml
    expect(core.exportVariable).not.toHaveBeenCalled(); // No PULUMI_POLICY_PACK_PATH
  });

  it('should throw error if pulumicost binary not found', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    
    // Mock version check success, but binary search fail
    (exec.getExecOutput as jest.Mock)
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: 'v0.1.0',
        stderr: '',
      })
      .mockResolvedValueOnce({
        exitCode: 1,
        stdout: '',
        stderr: 'not found',
      });

    await expect(analyzer.setupAnalyzerMode()).rejects.toThrow(
      'Could not find pulumicost binary in PATH'
    );
  });
});