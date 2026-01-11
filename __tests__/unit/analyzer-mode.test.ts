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

describe('Analyzer Mode', () => {
  let analyzer: Analyzer;

  beforeEach(() => {
    analyzer = new Analyzer();
    jest.clearAllMocks();
    (os.homedir as jest.Mock).mockReturnValue('/home/user');
    // Default mocks for exec
    (exec.getExecOutput as jest.Mock)
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'v1.2.3\n', stderr: '' }) // version
      .mockResolvedValueOnce({ exitCode: 0, stdout: '/bin/pulumicost\n', stderr: '' }); // which
  });

  it('should setup analyzer mode with wrapper script', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.readFileSync as jest.Mock).mockReturnValue('name: p\n');

    await analyzer.setupAnalyzerMode();

    const expectedPluginDir = '/home/user/.pulumi/plugins/analyzer-pulumicost-v1.2.3';
    
    // Verify real binary copy
    expect(fs.copyFileSync).toHaveBeenCalledWith(
      '/bin/pulumicost',
      `${expectedPluginDir}/pulumi-analyzer-pulumicost-real`
    );

    // Verify wrapper script creation
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      `${expectedPluginDir}/pulumi-analyzer-pulumicost`,
      expect.stringContaining('pulumi-analyzer-pulumicost-real')
    );
    
    // Verify chmod for both
    expect(fs.chmodSync).toHaveBeenCalledWith(`${expectedPluginDir}/pulumi-analyzer-pulumicost-real`, 0o755);
    expect(fs.chmodSync).toHaveBeenCalledWith(`${expectedPluginDir}/pulumi-analyzer-pulumicost`, 0o755);
  });

  it('should update Pulumi.yaml using yaml package', async () => {
    (fs.existsSync as jest.Mock).mockImplementation((path: string) => path.includes('Pulumi.yaml'));
    (fs.readFileSync as jest.Mock).mockReturnValue('name: my-project\n');

    await analyzer.setupAnalyzerMode();

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('Pulumi.yaml'),
      expect.stringContaining('plugins:\n  analyzers:\n    - name: pulumicost\n      path: /home/user/.pulumi/plugins/analyzer-pulumicost-v1.2.3/pulumi-analyzer-pulumicost')
    );
  });

  it('should remove legacy top-level analyzers and add plugins.analyzers', async () => {
    (fs.existsSync as jest.Mock).mockImplementation((path: string) => path.includes('Pulumi.yaml'));
    (fs.readFileSync as jest.Mock).mockReturnValue('name: p\nanalyzers:\n  - pulumicost\n');

    await analyzer.setupAnalyzerMode();

    const yamlCalls = (fs.writeFileSync as jest.Mock).mock.calls.filter(call => 
      call[0].includes('Pulumi.yaml')
    );
    expect(yamlCalls).toHaveLength(1);
    expect(yamlCalls[0][1]).not.toContain('analyzers:\n  - pulumicost');
    expect(yamlCalls[0][1]).toContain('plugins:\n  analyzers:');
  });
});
