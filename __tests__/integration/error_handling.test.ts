import * as exec from '@actions/exec';
import * as core from '@actions/core';
import * as fs from 'fs';
import { Analyzer } from '../../src/analyze.js';
import { ActionConfiguration } from '../../src/types.js';

jest.mock('@actions/exec');
jest.mock('@actions/core');

describe('Analyzer - Error Handling Integration Tests', () => {
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
    debug: true,
    includeActualCosts: true,
    actualCostsPeriod: '7d',
    pulumiStateJsonPath: '',
    actualCostsGroupBy: 'provider',
  };

  beforeEach(() => {
    analyzer = new Analyzer();
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockImplementation(() => true);
  });

  it('should handle plugin not configured error gracefully', async () => {
    (exec.getExecOutput as jest.Mock).mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'Plugin not configured for cloud provider',
    });

    const report = await analyzer.runActualCosts(mockConfig);

    // Should return empty report without throwing
    expect(report.total).toBe(0);
    expect(report.items).toHaveLength(0);
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('pulumicost cost actual failed with exit code 1'),
    );
  });

  it('should handle authentication failure gracefully', async () => {
    (exec.getExecOutput as jest.Mock).mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'Authentication failed: invalid credentials',
    });

    const report = await analyzer.runActualCosts(mockConfig);

    expect(report.total).toBe(0);
    expect(report.currency).toBe('USD');
    expect(report.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(report.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should handle network connectivity issues gracefully', async () => {
    (exec.getExecOutput as jest.Mock).mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'Network timeout: unable to reach cost service',
    });

    const report = await analyzer.runActualCosts(mockConfig);

    expect(report.total).toBe(0);
    expect(report.items).toEqual([]);
    expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('Network timeout'));
  });

  it('should handle missing plan file gracefully when state file not provided', async () => {
    const configNoFiles = {
      ...mockConfig,
      pulumiPlanJsonPath: 'nonexistent.json',
    };

    // Mock fs.existsSync to return false for the plan file
    (fs.existsSync as jest.Mock).mockImplementation((path) => path !== 'nonexistent.json');

    await expect(analyzer.runActualCosts(configNoFiles)).rejects.toThrow(
      'Pulumi plan file not found: nonexistent.json',
    );
  });

  it('should handle missing state file error', async () => {
    const configWithState = {
      ...mockConfig,
      pulumiStateJsonPath: 'missing-state.json',
    };

    // Mock fs.existsSync to return false for state file
    (fs.existsSync as jest.Mock).mockImplementation((path) => path !== 'missing-state.json');

    await expect(analyzer.runActualCosts(configWithState)).rejects.toThrow(
      'Pulumi state file not found: missing-state.json',
    );
  });

  it('should continue with plan file when state file is missing but plan exists', async () => {
    const configWithBoth = {
      ...mockConfig,
      pulumiStateJsonPath: 'missing-state.json',
      // plan file exists
    };

    // Mock fs.existsSync to return false for state file but true for others
    (fs.existsSync as jest.Mock).mockImplementation((path) => path !== 'missing-state.json');

    (exec.getExecOutput as jest.Mock).mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify({ total: 25.0, currency: 'USD', items: [] }),
      stderr: '',
    });

    const report = await analyzer.runActualCosts(configWithBoth);

    // Should fall back to plan file
    expect(exec.getExecOutput).toHaveBeenCalledWith(
      'pulumicost',
      expect.arrayContaining(['--pulumi-json', 'plan.json']),
      expect.any(Object),
    );
    expect(exec.getExecOutput).not.toHaveBeenCalledWith(
      'pulumicost',
      expect.arrayContaining(['--pulumi-state', 'missing-state.json']),
      expect.any(Object),
    );
    expect(report.total).toBe(25.0);
  });

  it('should handle malformed JSON from pulumicost gracefully', async () => {
    (exec.getExecOutput as jest.Mock).mockResolvedValue({
      exitCode: 0,
      stdout: '{ invalid json }',
      stderr: '',
    });

    const report = await analyzer.runActualCosts(mockConfig);

    expect(report.total).toBe(0);
    expect(report.items).toEqual([]);
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('Failed to parse actual cost output'),
    );
  });
});
