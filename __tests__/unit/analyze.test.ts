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
      'finfocus',
      ['cost', 'projected', '--pulumi-json', 'plan.json', '--output', 'json'],
      expect.objectContaining({ silent: true, ignoreReturnCode: true }),
    );
    expect(report).toEqual(mockReport);
  });

  it('should parse v0.4.1 diff format with totalDelta', async () => {
    const v041Report = {
      finfocus: {
        summary: {
          totalMonthly: 7.592,
          totalHourly: 0.0104,
          currency: 'USD',
        },
        diff: {
          totalBefore: 0,
          totalAfter: 7.592,
          totalDelta: 7.592,
          currency: 'USD',
          creates: 3,
          updates: 0,
          deletes: 0,
          unchanged: 0,
        },
      },
    };

    (exec.getExecOutput as jest.Mock).mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify(v041Report),
      stderr: '',
    });

    const report = await analyzer.runAnalysis('plan.json');

    expect(report).toBeDefined();
    expect(report.diff).toEqual({
      totalBefore: 0,
      totalAfter: 7.592,
      totalDelta: 7.592,
      currency: 'USD',
      creates: 3,
      updates: 0,
      deletes: 0,
      unchanged: 0,
    });
  });

  it('should throw error if plan file not found', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    await expect(analyzer.runAnalysis('missing.json')).rejects.toThrow(
      'Pulumi plan file not found: missing.json',
    );
  });

  it('should throw error if plan file is empty', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.statSync as jest.Mock).mockReturnValue({
      size: 0,
      mtime: new Date('2025-01-01T00:00:00Z'),
    });

    await expect(analyzer.runAnalysis('empty.json')).rejects.toThrow(
      'Pulumi plan file is empty: empty.json',
    );
  });

  it('should throw error if exec fails', async () => {
    (exec.getExecOutput as jest.Mock).mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'command failed',
    });

    await expect(analyzer.runAnalysis('plan.json')).rejects.toThrow(
      'finfocus analysis failed with exit code 1',
    );
  });

  it('should surface the finfocus error envelope message on non-zero exit', async () => {
    const realFs = jest.requireActual<typeof fs>('fs');
    const envelope = realFs.readFileSync(
      require('path').join(
        __dirname,
        '..',
        'fixtures',
        'finfocus-v0.4.0',
        'exit2-validation-error.json',
      ),
      'utf8',
    );

    (exec.getExecOutput as jest.Mock).mockResolvedValue({
      exitCode: 2,
      stdout: '',
      stderr: envelope,
    });

    await expect(analyzer.runAnalysis('plan.json')).rejects.toThrow(
      'loading Pulumi plan: reading plan file',
    );
    await expect(analyzer.runAnalysis('plan.json')).rejects.toThrow('configuration error');
  });

  it('should throw error if JSON parsing fails', async () => {
    (exec.getExecOutput as jest.Mock).mockResolvedValue({
      exitCode: 0,
      stdout: 'not valid json',
      stderr: '',
    });

    await expect(analyzer.runAnalysis('plan.json')).rejects.toThrow(
      'Failed to parse finfocus JSON output',
    );
  });

  it('should use --terraform-state instead of --pulumi-json when configured', async () => {
    const mockReport = { summary: { totalMonthly: 7.592, totalHourly: 0.0104, currency: 'USD' } };
    (exec.getExecOutput as jest.Mock).mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify({ finfocus: mockReport }),
      stderr: '',
    });

    const config = { terraformStatePath: 'terraform.tfstate', debug: false } as any;
    const report = await analyzer.runAnalysis('plan.json', config);

    expect(exec.getExecOutput).toHaveBeenCalledWith(
      'finfocus',
      ['cost', 'projected', '--terraform-state', 'terraform.tfstate', '--output', 'json'],
      expect.objectContaining({ silent: true, ignoreReturnCode: true }),
    );
    expect(report.summary.totalMonthly).toBe(7.592);
  });

  it('should warn when both pulumi plan and terraform state are configured', async () => {
    (exec.getExecOutput as jest.Mock).mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify({
        finfocus: { summary: { totalMonthly: 1, totalHourly: 0, currency: 'USD' } },
      }),
      stderr: '',
    });

    const config = { terraformStatePath: 'terraform.tfstate', debug: false } as any;
    await analyzer.runAnalysis('plan.json', config);

    expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('mutually exclusive'));
  });

  it('should parse sustainability data when present in report', async () => {
    const mockReportWithSustainability = {
      summary: {
        totalMonthly: 100,
        totalHourly: 0.1,
        currency: 'USD',
      },
      resources: [
        {
          resourceType: 'aws:ec2/instance:Instance',
          monthly: 7.5,
          sustainability: {
            gCO2e: { value: 12.5, unit: 'gCO2e/month' },
            carbon_footprint: { value: 12.5, unit: 'kgCO2e/month' },
          },
        },
      ],
    };

    (exec.getExecOutput as jest.Mock).mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify(mockReportWithSustainability),
      stderr: '',
    });

    const report = await analyzer.runAnalysis('plan.json');

    expect(report.resources?.[0].sustainability).toBeDefined();
    expect(report.resources?.[0].sustainability?.gCO2e.value).toBe(12.5);
    expect(report.resources?.[0].sustainability?.carbon_footprint.unit).toBe('kgCO2e/month');
  });

  it('should pass utilization flag to finfocus when configured', async () => {
    const config = {
      utilizationRate: '0.8',
    } as any;

    (exec.getExecOutput as jest.Mock).mockResolvedValue({
      exitCode: 0,
      stdout: '{}',
      stderr: '',
    });

    await analyzer.runAnalysis('plan.json', config);

    expect(exec.getExecOutput).toHaveBeenCalledWith(
      'finfocus',
      expect.arrayContaining(['--utilization', '0.8']),
      expect.anything(),
    );
  });

  it('should pass each resource filter to cost projected', async () => {
    (exec.getExecOutput as jest.Mock).mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify({
        finfocus: { summary: { totalMonthly: 1, totalHourly: 0, currency: 'USD' } },
      }),
      stderr: '',
    });

    await analyzer.runAnalysis('plan.json', {
      resourceFilters: ['type=ec2', 'tag:env=prod'],
      debug: false,
    } as any);

    expect(exec.getExecOutput).toHaveBeenCalledWith(
      'finfocus',
      expect.arrayContaining(['--filter', 'type=ec2', '--filter', 'tag:env=prod']),
      expect.anything(),
    );
  });

  describe('calculateBudgetStatus', () => {
    it('should return undefined when budget is not configured', () => {
      const config = {
        budgetAmount: undefined,
      } as any;

      const report = {
        summary: { totalMonthly: 50, currency: 'USD' },
      } as any;

      const result = analyzer.calculateBudgetStatus(config, report);

      expect(result).toBeUndefined();
    });

    it('should return undefined when budget amount is 0 or negative', () => {
      const config = {
        budgetAmount: 0,
      } as any;

      const report = {
        summary: { totalMonthly: 50, currency: 'USD' },
      } as any;

      const result = analyzer.calculateBudgetStatus(config, report);

      expect(result).toBeUndefined();
    });

    it('should calculate budget status correctly when under budget', () => {
      const config = {
        budgetAmount: 100,
        budgetCurrency: 'USD',
        budgetPeriod: 'monthly',
        budgetAlerts: JSON.stringify([
          { threshold: 80, type: 'actual' },
          { threshold: 100, type: 'forecasted' },
        ]),
      } as any;

      const report = {
        summary: { totalMonthly: 50, currency: 'USD' },
      } as any;

      const result = analyzer.calculateBudgetStatus(config, report);

      expect(result).toBeDefined();
      expect(result?.configured).toBe(true);
      expect(result?.amount).toBe(100);
      expect(result?.currency).toBe('USD');
      expect(result?.period).toBe('monthly');
      expect(result?.spent).toBe(50);
      expect(result?.remaining).toBe(50);
      expect(result?.percentUsed).toBe(50);
      expect(result?.alerts).toHaveLength(2);
      expect(result?.alerts?.[0].triggered).toBe(false);
      expect(result?.alerts?.[1].triggered).toBe(false);
    });

    it('should calculate budget status correctly when at 80% threshold', () => {
      const config = {
        budgetAmount: 100,
        budgetCurrency: 'USD',
        budgetPeriod: 'monthly',
        budgetAlerts: JSON.stringify([
          { threshold: 80, type: 'actual' },
          { threshold: 100, type: 'forecasted' },
        ]),
      } as any;

      const report = {
        summary: { totalMonthly: 80, currency: 'USD' },
      } as any;

      const result = analyzer.calculateBudgetStatus(config, report);

      expect(result).toBeDefined();
      expect(result?.spent).toBe(80);
      expect(result?.remaining).toBe(20);
      expect(result?.percentUsed).toBe(80);
      expect(result?.alerts?.[0].triggered).toBe(true); // 80% alert triggered
      expect(result?.alerts?.[1].triggered).toBe(false); // 100% not triggered
    });

    it('should calculate budget status correctly when over budget', () => {
      const config = {
        budgetAmount: 100,
        budgetCurrency: 'USD',
        budgetPeriod: 'monthly',
        budgetAlerts: JSON.stringify([
          { threshold: 80, type: 'actual' },
          { threshold: 100, type: 'forecasted' },
        ]),
      } as any;

      const report = {
        summary: { totalMonthly: 120, currency: 'USD' },
      } as any;

      const result = analyzer.calculateBudgetStatus(config, report);

      expect(result).toBeDefined();
      expect(result?.spent).toBe(120);
      expect(result?.remaining).toBe(-20);
      expect(result?.percentUsed).toBe(120);
      expect(result?.alerts?.[0].triggered).toBe(true);
      expect(result?.alerts?.[1].triggered).toBe(true);
    });

    it('should use default alerts when budgetAlerts is not provided', () => {
      const config = {
        budgetAmount: 100,
        budgetCurrency: 'USD',
        budgetPeriod: 'monthly',
      } as any;

      const report = {
        summary: { totalMonthly: 85, currency: 'USD' },
      } as any;

      const result = analyzer.calculateBudgetStatus(config, report);

      expect(result).toBeDefined();
      expect(result?.alerts).toHaveLength(2);
      expect(result?.alerts?.[0]).toEqual({
        threshold: 80,
        type: 'actual',
        triggered: true,
      });
      expect(result?.alerts?.[1]).toEqual({
        threshold: 100,
        type: 'forecasted',
        triggered: false,
      });
    });

    it('should handle legacy report format with projected_monthly_cost', () => {
      const config = {
        budgetAmount: 100,
        budgetCurrency: 'USD',
        budgetPeriod: 'monthly',
      } as any;

      const report = {
        projected_monthly_cost: 75,
        currency: 'USD',
      } as any;

      const result = analyzer.calculateBudgetStatus(config, report);

      expect(result).toBeDefined();
      expect(result?.spent).toBe(75);
      expect(result?.remaining).toBe(25);
      expect(result?.percentUsed).toBe(75);
    });

    it('should use defaults for currency and period when not provided', () => {
      const config = {
        budgetAmount: 100,
      } as any;

      const report = {
        summary: { totalMonthly: 50, currency: 'USD' },
      } as any;

      const result = analyzer.calculateBudgetStatus(config, report);

      expect(result).toBeDefined();
      expect(result?.currency).toBe('USD');
      expect(result?.period).toBe('monthly');
    });
  });

  describe('runEstimate', () => {
    // Verbatim capture from the real finfocus v0.4.0 binary (2026-10-03,
    // aws-public v0.1.9):
    //   finfocus cost estimate --provider aws \
    //     --resource-type aws:ec2/instance:Instance \
    //     --property instanceType=m5.large --region us-east-1 --output json
    const capturedEstimateJson = JSON.stringify({
      resource: {
        type: 'aws:ec2/instance:Instance',
        id: 'estimate-resource',
        provider: 'aws',
        properties: { region: 'us-east-1' },
      },
      baseline: {
        resourceType: 'aws:ec2/instance:Instance',
        resourceId: 'estimate-resource',
        adapter: '',
        currency: 'USD',
        monthly: 0,
        hourly: 0,
        notes: '',
        breakdown: null,
        startDate: '0001-01-01T00:00:00Z',
        endDate: '0001-01-01T00:00:00Z',
      },
      modified: {
        resourceType: 'aws:ec2/instance:Instance',
        resourceId: 'estimate-resource',
        adapter: '',
        currency: 'USD',
        monthly: 70.08,
        hourly: 0.096,
        notes: '',
        breakdown: null,
        startDate: '0001-01-01T00:00:00Z',
        endDate: '0001-01-01T00:00:00Z',
      },
      totalChange: 70.08,
      deltas: [
        { property: 'instanceType', originalValue: '', newValue: 'm5.large', costChange: 70.08 },
      ],
    });

    const estimateSpec = JSON.stringify({
      provider: 'aws',
      resource_type: 'aws:ec2/instance:Instance',
      properties: { instanceType: 'm5.large' },
      region: 'us-east-1',
    });

    it('should return undefined and not run finfocus when estimateSpec is empty', async () => {
      const result = await analyzer.runEstimate({ estimateSpec: '' } as any);

      expect(result).toBeUndefined();
      expect(exec.getExecOutput).not.toHaveBeenCalled();
    });

    it('should run finfocus cost estimate and return the report', async () => {
      (exec.getExecOutput as jest.Mock).mockResolvedValue({
        exitCode: 0,
        stdout: capturedEstimateJson,
        stderr: '',
      });

      const report = await analyzer.runEstimate({ estimateSpec, debug: false } as any);

      expect(exec.getExecOutput).toHaveBeenCalledWith(
        'finfocus',
        [
          'cost',
          'estimate',
          '--provider',
          'aws',
          '--resource-type',
          'aws:ec2/instance:Instance',
          '--property',
          'instanceType=m5.large',
          '--region',
          'us-east-1',
          '--output',
          'json',
        ],
        expect.objectContaining({ silent: true, ignoreReturnCode: true }),
      );
      expect(report).toBeDefined();
      expect(report?.totalChange).toBe(70.08);
      expect(report?.modified.monthly).toBe(70.08);
      expect(report?.modified.currency).toBe('USD');
      expect(report?.deltas).toHaveLength(1);
      expect(report?.deltas[0].property).toBe('instanceType');
    });

    it('should omit --property and --region when not specified', async () => {
      (exec.getExecOutput as jest.Mock).mockResolvedValue({
        exitCode: 0,
        stdout: capturedEstimateJson,
        stderr: '',
      });

      await analyzer.runEstimate({
        estimateSpec: JSON.stringify({
          provider: 'aws',
          resource_type: 'aws:ec2/instance:Instance',
        }),
      } as any);

      expect(exec.getExecOutput).toHaveBeenCalledWith(
        'finfocus',
        [
          'cost',
          'estimate',
          '--provider',
          'aws',
          '--resource-type',
          'aws:ec2/instance:Instance',
          '--output',
          'json',
        ],
        expect.anything(),
      );
    });

    it('should warn and return undefined on invalid spec JSON', async () => {
      const result = await analyzer.runEstimate({ estimateSpec: '{not json' } as any);

      expect(result).toBeUndefined();
      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('Invalid estimate-spec JSON'),
      );
      expect(exec.getExecOutput).not.toHaveBeenCalled();
    });

    it('should warn and return undefined when provider is missing', async () => {
      const result = await analyzer.runEstimate({
        estimateSpec: JSON.stringify({ resource_type: 'aws:ec2/instance:Instance' }),
      } as any);

      expect(result).toBeUndefined();
      expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('"provider"'));
      expect(exec.getExecOutput).not.toHaveBeenCalled();
    });

    it('should warn and return undefined when resource_type is missing', async () => {
      const result = await analyzer.runEstimate({
        estimateSpec: JSON.stringify({ provider: 'aws' }),
      } as any);

      expect(result).toBeUndefined();
      expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('"resource_type"'));
      expect(exec.getExecOutput).not.toHaveBeenCalled();
    });

    it('should warn and return undefined when spec is not a JSON object', async () => {
      const result = await analyzer.runEstimate({ estimateSpec: '"aws"' } as any);

      expect(result).toBeUndefined();
      expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('must be a JSON object'));
      expect(exec.getExecOutput).not.toHaveBeenCalled();
    });

    it('should throw with the envelope message on non-zero exit with an error envelope', async () => {
      (exec.getExecOutput as jest.Mock).mockResolvedValue({
        exitCode: 1,
        stdout: '',
        stderr:
          '{"error_code":"internal_error","message":"parsing properties: invalid property format \\"badprop\\""}',
      });

      await expect(analyzer.runEstimate({ estimateSpec } as any)).rejects.toThrow(
        'parsing properties: invalid property format',
      );
      await expect(analyzer.runEstimate({ estimateSpec } as any)).rejects.toThrow('tool failure');
    });

    it('should fall back to stderr text on non-zero exit without an envelope', async () => {
      (exec.getExecOutput as jest.Mock).mockResolvedValue({
        exitCode: 1,
        stdout: '',
        stderr: 'boom',
      });

      await expect(analyzer.runEstimate({ estimateSpec } as any)).rejects.toThrow(
        'finfocus estimate failed with exit code 1',
      );
    });
  });
});
