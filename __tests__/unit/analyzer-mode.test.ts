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
  readFileSync: jest.fn(),
}));
jest.mock('os');
jest.mock('@actions/core');
jest.mock('@actions/exec');

describe('Analyzer Mode (Policy Pack)', () => {
  let analyzer: Analyzer;

  beforeEach(() => {
    analyzer = new Analyzer();
    jest.clearAllMocks();
    (os.homedir as jest.Mock).mockReturnValue('/home/user');
  });

  it('should setup policy pack correctly', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (exec.getExecOutput as jest.Mock)
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'v0.1.2\n', stderr: '' }) // version
      .mockResolvedValueOnce({ exitCode: 0, stdout: '/bin/finfocus\n', stderr: '' }); // which

    await analyzer.setupAnalyzerMode();

    const expectedPolicyDir = '/home/user/.finfocus/analyzer';
    const expectedBinaryPath = `${expectedPolicyDir}/pulumi-analyzer-policy-finfocus`;
    const expectedPolicyYamlPath = `${expectedPolicyDir}/PulumiPolicy.yaml`;

    // 1. Verify directory creation
    expect(fs.mkdirSync).toHaveBeenCalledWith(expectedPolicyDir, { recursive: true });

    // 2. Verify PulumiPolicy.yaml creation with metadata
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expectedPolicyYamlPath,
      expect.stringContaining('runtime: finfocus')
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expectedPolicyYamlPath,
      expect.stringContaining('name: finfocus')
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expectedPolicyYamlPath,
      expect.stringContaining('version: v0.1.2')
    );

    // 3. Verify binary copy and chmod
    expect(fs.copyFileSync).toHaveBeenCalledWith(
      '/bin/finfocus',
      expectedBinaryPath
    );
    expect(fs.chmodSync).toHaveBeenCalledWith(expectedBinaryPath, 0o755);

    // 4. Verify PATH update
    expect(core.addPath).toHaveBeenCalledWith(expectedPolicyDir);

    // 5. Verify env var exports
    expect(core.exportVariable).toHaveBeenCalledWith('PULUMI_POLICY_PACK', expectedPolicyDir);
    expect(core.exportVariable).toHaveBeenCalledWith('PULUMI_POLICY_PACKS', expectedPolicyDir);
    expect(core.exportVariable).toHaveBeenCalledWith('PULUMI_POLICY_PACK_PATH', expectedPolicyDir);

    // 6. Verify output
    expect(core.setOutput).toHaveBeenCalledWith('policy-pack-path', expectedPolicyDir);
  });

  it('should export FINFOCUS_LOG_LEVEL if provided', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (exec.getExecOutput as jest.Mock)
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'v0.1.2\n', stderr: '' }) // version
      .mockResolvedValueOnce({ exitCode: 0, stdout: '/bin/finfocus\n', stderr: '' }); // which

    await analyzer.setupAnalyzerMode({
      logLevel: 'debug',
    } as any);

    expect(core.exportVariable).toHaveBeenCalledWith('FINFOCUS_LOG_LEVEL', 'debug');
  });
});
