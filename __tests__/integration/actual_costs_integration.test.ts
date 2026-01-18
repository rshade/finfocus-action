import * as exec from '@actions/exec';
import * as core from '@actions/core';
import * as fs from 'fs';
import { Analyzer } from '../../src/analyze.js';
import { ActionConfiguration } from '../../src/types.js';

jest.mock('@actions/exec');
jest.mock('@actions/core');
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
}));

describe('Analyzer - Actual Costs Integration', () => {
  let analyzer: Analyzer;
  const mockConfig: ActionConfiguration = {
    pulumiPlanJsonPath: 'plan.json',
    githubToken: 'token',
    finfocusVersion: 'latest',
    installPlugins: [],
    behaviorOnError: 'fail',
    postComment: true,
    threshold: null,
    analyzerMode: false,
    detailedComment: false,
    includeRecommendations: false,
    logLevel: 'error',
    debug: true, // Enable debug for testing
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

  it('should execute finfocus cost actual command with correct arguments', async () => {
    const mockCliOutput = {
      total: 125.75,
      currency: 'USD',
      items: [
        { name: 'aws', cost: 95.5, currency: 'USD' },
        { name: 'gcp', cost: 30.25, currency: 'USD' },
      ],
    };

    (exec.getExecOutput as jest.Mock).mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify(mockCliOutput),
      stderr: '',
    });

    const report = await analyzer.runActualCosts(mockConfig);

    // Verify the command was called with correct arguments
    expect(exec.getExecOutput).toHaveBeenCalledWith(
      'finfocus',
      expect.arrayContaining([
        'cost',
        'actual',
        '--output',
        'json',
        '--from',
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        '--to',
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        '--group-by',
        'provider',
      ]),
      expect.objectContaining({
        silent: false, // Debug is true, so silent should be false
        ignoreReturnCode: true,
      }),
    );

    // Verify the report is correctly parsed
    expect(report.total).toBe(125.75);
    expect(report.currency).toBe('USD');
    expect(report.items).toHaveLength(2);
    expect(report.items[0].name).toBe('aws');
    expect(report.items[0].cost).toBe(95.5);
  });

  it('should handle CLI command failure gracefully', async () => {
    (exec.getExecOutput as jest.Mock).mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'Plugin not configured',
    });

    const report = await analyzer.runActualCosts(mockConfig);

    // Should return empty report on failure
    expect(report.total).toBe(0);
    expect(report.items).toHaveLength(0);
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('finfocus cost actual failed with exit code 1'),
    );
  });

  it('should handle malformed JSON response', async () => {
    (exec.getExecOutput as jest.Mock).mockResolvedValue({
      exitCode: 0,
      stdout: 'not valid json',
      stderr: '',
    });

    const report = await analyzer.runActualCosts(mockConfig);

    // Should return empty report on parse failure
    expect(report.total).toBe(0);
    expect(report.items).toHaveLength(0);
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('Failed to parse actual cost output'),
    );
  });

  it('should use state file when provided', async () => {
    const configWithState = {
      ...mockConfig,
      pulumiStateJsonPath: 'state.json',
    };

    (exec.getExecOutput as jest.Mock).mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify({ total: 75.0, currency: 'USD', items: [] }),
      stderr: '',
    });

    await analyzer.runActualCosts(configWithState);

    expect(exec.getExecOutput).toHaveBeenCalledWith(
      'finfocus',
      expect.arrayContaining(['--pulumi-state', 'state.json']),
      expect.any(Object),
    );
  });

  it('should prioritize state file over plan file', async () => {
    const configWithBoth = {
      ...mockConfig,
      pulumiStateJsonPath: 'state.json',
      // pulumiPlanJsonPath is already set
    };

    (exec.getExecOutput as jest.Mock).mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify({ total: 50.0 }),
      stderr: '',
    });

    await analyzer.runActualCosts(configWithBoth);

    const callArgs = (exec.getExecOutput as jest.Mock).mock.calls[0][1];
    expect(callArgs).toContain('--pulumi-state');
    expect(callArgs).toContain('state.json');
    expect(callArgs).not.toContain('--pulumi-json');
  });
});
