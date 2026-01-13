import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as core from '@actions/core';
import { Analyzer } from '../../src/analyze.js';
import { ActionConfiguration } from '../../src/types.js';

jest.mock('@actions/exec');
jest.mock('@actions/core');
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  statSync: jest.fn(),
  readFileSync: jest.fn(),
}));

describe('Analyzer - Actual Costs', () => {
  let analyzer: Analyzer;
  const mockConfig: ActionConfiguration = {
    pulumiPlanJsonPath: 'plan.json',
    githubToken: 'token',
    pulumicostVersion: 'latest',
    installPlugins: [],
    behaviorOnError: 'fail',
    postComment: true,
    threshold: null,
    analyzerMode: false,
    detailedComment: false,
    includeRecommendations: false,
    logLevel: 'error',
    debug: false,
    includeActualCosts: true,
    actualCostsPeriod: '7d',
    pulumiStateJsonPath: '',
    actualCostsGroupBy: 'provider',
  };

  beforeEach(() => {
    analyzer = new Analyzer();
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(true);
  });

  it('should run actual costs with default 7d period', async () => {
    const mockOutput = {
      total: 50.0,
      currency: 'USD',
      items: [
        { name: 'aws', cost: 40.0, currency: 'USD' },
        { name: 'gcp', cost: 10.0, currency: 'USD' },
      ],
    };

    (exec.getExecOutput as jest.Mock).mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify(mockOutput),
      stderr: '',
    });

    const report = await analyzer.runActualCosts(mockConfig);

    expect(exec.getExecOutput).toHaveBeenCalledWith(
      'pulumicost',
      expect.arrayContaining([
        'cost',
        'actual',
        '--from',
        expect.any(String),
        '--to',
        expect.any(String),
      ]),
      expect.any(Object),
    );
    expect(report.total).toBe(50.0);
    expect(report.items).toHaveLength(2);
  });

  it('should use state file if provided', async () => {
    const configWithState = { ...mockConfig, pulumiStateJsonPath: 'state.json' };

    (exec.getExecOutput as jest.Mock).mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify({ total: 10 }),
      stderr: '',
    });

    await analyzer.runActualCosts(configWithState);

    expect(exec.getExecOutput).toHaveBeenCalledWith(
      'pulumicost',
      expect.arrayContaining(['--pulumi-state', 'state.json']),
      expect.any(Object),
    );
  });

  it('should handle custom period', async () => {
    const configWithCustom = { ...mockConfig, actualCostsPeriod: '2025-01-01' };

    (exec.getExecOutput as jest.Mock).mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify({ total: 10 }),
      stderr: '',
    });

    await analyzer.runActualCosts(configWithCustom);

    expect(exec.getExecOutput).toHaveBeenCalledWith(
      'pulumicost',
      expect.arrayContaining(['--from', '2025-01-01']),
      expect.any(Object),
    );
  });

  it('should return empty report on failure', async () => {
    (exec.getExecOutput as jest.Mock).mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'error',
    });

    const report = await analyzer.runActualCosts(mockConfig);

    expect(report.total).toBe(0);
    expect(report.items).toHaveLength(0);
  });

  describe('Date Period Parsing and Validation', () => {
    it('should handle 7d period correctly', async () => {
      const config7d = { ...mockConfig, actualCostsPeriod: '7d' };

      (exec.getExecOutput as jest.Mock).mockResolvedValue({
        exitCode: 0,
        stdout: JSON.stringify({ total: 10 }),
        stderr: '',
      });

      await analyzer.runActualCosts(config7d);

      const callArgs = (exec.getExecOutput as jest.Mock).mock.calls[0][1];
      expect(callArgs).toContain('--from');
      expect(callArgs).toContain('--to');
      // The from date should be 7 days ago from today
      const fromIndex = callArgs.indexOf('--from');
      const toIndex = callArgs.indexOf('--to');
      expect(fromIndex).toBeGreaterThan(-1);
      expect(toIndex).toBeGreaterThan(fromIndex);
    });

    it('should handle 30d period correctly', async () => {
      const config30d = { ...mockConfig, actualCostsPeriod: '30d' };

      (exec.getExecOutput as jest.Mock).mockResolvedValue({
        exitCode: 0,
        stdout: JSON.stringify({ total: 10 }),
        stderr: '',
      });

      await analyzer.runActualCosts(config30d);

      const callArgs = (exec.getExecOutput as jest.Mock).mock.calls[0][1];
      expect(callArgs).toContain('--from');
      expect(callArgs).toContain('--to');
    });

    it('should handle mtd period correctly', async () => {
      const configMtd = { ...mockConfig, actualCostsPeriod: 'mtd' };

      (exec.getExecOutput as jest.Mock).mockResolvedValue({
        exitCode: 0,
        stdout: JSON.stringify({ total: 10 }),
        stderr: '',
      });

      await analyzer.runActualCosts(configMtd);

      const callArgs = (exec.getExecOutput as jest.Mock).mock.calls[0][1];
      expect(callArgs).toContain('--from');
      expect(callArgs).toContain('--to');
    });

    it('should handle custom date correctly', async () => {
      const configCustom = { ...mockConfig, actualCostsPeriod: '2024-01-01' };

      (exec.getExecOutput as jest.Mock).mockResolvedValue({
        exitCode: 0,
        stdout: JSON.stringify({ total: 10 }),
        stderr: '',
      });

      await analyzer.runActualCosts(configCustom);

      expect(exec.getExecOutput).toHaveBeenCalledWith(
        'pulumicost',
        expect.arrayContaining(['--from', '2024-01-01']),
        expect.any(Object),
      );
    });

    it('should reject invalid date formats', async () => {
      const configInvalid = { ...mockConfig, actualCostsPeriod: 'invalid-date' };

      await expect(analyzer.runActualCosts(configInvalid)).rejects.toThrow(
        'Invalid actual-costs-period format',
      );
    });

    it('should handle group-by parameter', async () => {
      const configGroupBy = { ...mockConfig, actualCostsGroupBy: 'service' };

      (exec.getExecOutput as jest.Mock).mockResolvedValue({
        exitCode: 0,
        stdout: JSON.stringify({ total: 10 }),
        stderr: '',
      });

      await analyzer.runActualCosts(configGroupBy);

      expect(exec.getExecOutput).toHaveBeenCalledWith(
        'pulumicost',
        expect.arrayContaining(['--group-by', 'service']),
        expect.any(Object),
      );
    });
  });
});
