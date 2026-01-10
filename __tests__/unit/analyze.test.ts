import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as core from '@actions/core';
import { Analyzer } from '../../src/analyze.js';

jest.mock('@actions/exec');
jest.mock('@actions/core');
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  statSync: jest.fn(),
  readFileSync: jest.fn(),
}));

describe('Analyzer', () => {
  let analyzer: Analyzer;

  beforeEach(() => {
    analyzer = new Analyzer();
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.statSync as jest.Mock).mockReturnValue({
      size: 1000,
      mtime: new Date('2025-01-01T00:00:00Z'),
    });
    (fs.readFileSync as jest.Mock).mockReturnValue('{}');
  });

  it('should run analysis and return report', async () => {
    const mockReport = {
      projected_monthly_cost: 120.5,
      currency: 'USD',
      diff: {
        monthly_cost_change: 10.0,
        percent_change: 8.33,
      },
    };

    (exec.getExecOutput as jest.Mock).mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify(mockReport),
      stderr: '',
    });

    const report = await analyzer.runAnalysis('plan.json');

    expect(exec.getExecOutput).toHaveBeenCalledWith(
      'pulumicost',
      ['cost', 'projected', '--pulumi-json', 'plan.json', '--output', 'json'],
      expect.objectContaining({ silent: false, ignoreReturnCode: true })
    );
    expect(report).toEqual(mockReport);
  });

  it('should throw error if plan file not found', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    await expect(analyzer.runAnalysis('missing.json')).rejects.toThrow(
      'Pulumi plan file not found: missing.json'
    );
  });

  it('should throw error if plan file is empty', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.statSync as jest.Mock).mockReturnValue({ 
      size: 0, 
      mtime: new Date('2025-01-01T00:00:00Z') 
    });

    await expect(analyzer.runAnalysis('empty.json')).rejects.toThrow(
      'Pulumi plan file is empty: empty.json'
    );
  });

  it('should throw error if exec fails', async () => {
    (exec.getExecOutput as jest.Mock).mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'command failed',
    });

    await expect(analyzer.runAnalysis('plan.json')).rejects.toThrow(
      'pulumicost analysis failed with exit code 1'
    );
  });

  it('should throw error if JSON parsing fails', async () => {
    (exec.getExecOutput as jest.Mock).mockResolvedValue({
      exitCode: 0,
      stdout: 'not valid json',
      stderr: '',
    });

    await expect(analyzer.runAnalysis('plan.json')).rejects.toThrow(
      'Failed to parse pulumicost JSON output'
    );
  });
});