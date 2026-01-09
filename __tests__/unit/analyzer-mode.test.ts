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
    (exec.getExecOutput as jest.Mock).mockResolvedValue({
      exitCode: 0,
      stdout: '/usr/local/bin/pulumicost\n',
      stderr: '',
    });
  });

  it('should setup analyzer mode correctly', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    await analyzer.setupAnalyzerMode();

    expect(fs.mkdirSync).toHaveBeenCalledWith(
      expect.stringContaining('.pulumicost/analyzer'),
      { recursive: true }
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('PulumiPolicy.yaml'),
      expect.stringContaining('runtime: pulumicost')
    );
    expect(exec.getExecOutput).toHaveBeenCalledWith('which', ['pulumicost'], { silent: true });
    expect(fs.copyFileSync).toHaveBeenCalledWith(
      '/usr/local/bin/pulumicost',
      expect.stringContaining('pulumi-analyzer-policy-pulumicost')
    );
    expect(fs.chmodSync).toHaveBeenCalledWith(
      expect.stringContaining('pulumi-analyzer-policy-pulumicost'),
      0o755
    );
    expect(core.exportVariable).toHaveBeenCalledWith(
      'PULUMI_POLICY_PACK_PATH',
      expect.stringContaining('.pulumicost/analyzer')
    );
  });

  it('should throw error if pulumicost binary not found', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (exec.getExecOutput as jest.Mock).mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'not found',
    });

    await expect(analyzer.setupAnalyzerMode()).rejects.toThrow(
      'Could not find pulumicost binary in PATH'
    );
  });
});
