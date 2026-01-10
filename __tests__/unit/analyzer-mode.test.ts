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

  it('should setup analyzer mode and update Pulumi.yaml if missing analyzers', async () => {
    // Mock Pulumi.yaml existence
    (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
      if (path.includes('Pulumi.yaml')) return true;
      return false; // Plugin dir etc
    });
    
    // Mock Pulumi.yaml content
    (fs.readFileSync as jest.Mock).mockReturnValue('name: my-project\nruntime: yaml\n');

    await analyzer.setupAnalyzerMode();

    const expectedPluginDir = '/home/user/.pulumi/plugins/analyzer-pulumicost-v1.2.3';
    expect(fs.mkdirSync).toHaveBeenCalledWith(expectedPluginDir, { recursive: true });
    
    // Verify Pulumi.yaml update
    // We check that pulumicost was added. Exact format depends on yaml lib.
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('Pulumi.yaml'),
      expect.stringContaining('pulumicost')
    );
  });

  it('should setup analyzer mode and inject pulumicost if analyzers exists', async () => {
    (fs.existsSync as jest.Mock).mockImplementation((path: string) => path.includes('Pulumi.yaml'));
    (fs.readFileSync as jest.Mock).mockReturnValue('name: p\nanalyzers:\n  - other\n');

    await analyzer.setupAnalyzerMode();

    // Verify both exist
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('Pulumi.yaml'),
      expect.stringMatching(/pulumicost/)
    );
     expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('Pulumi.yaml'),
      expect.stringMatching(/other/)
    );
  });

  it('should not update Pulumi.yaml if pulumicost already present', async () => {
    (fs.existsSync as jest.Mock).mockImplementation((path: string) => path.includes('Pulumi.yaml'));
    (fs.readFileSync as jest.Mock).mockReturnValue('name: p\nanalyzers:\n  - pulumicost\n');

    await analyzer.setupAnalyzerMode();

    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('should warn if Pulumi.yaml not found', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false); // Nothing exists

    await analyzer.setupAnalyzerMode();

    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('Pulumi.yaml not found')
    );
  });
});