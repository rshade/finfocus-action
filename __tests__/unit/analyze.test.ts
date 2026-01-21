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
      expect.objectContaining({ silent: true, ignoreReturnCode: true })
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
      'finfocus analysis failed with exit code 1'
    );
  });

  it('should throw error if JSON parsing fails', async () => {
    (exec.getExecOutput as jest.Mock).mockResolvedValue({
      exitCode: 0,
      stdout: 'not valid json',
      stderr: '',
    });

    await expect(analyzer.runAnalysis('plan.json')).rejects.toThrow(
      'Failed to parse finfocus JSON output'
    );
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
          monthly: 7.50,
          sustainability: {
            gCO2e: { value: 12.5, unit: 'gCO2e/month' },
            carbon_footprint: { value: 12.5, unit: 'kgCO2e/month' }
          }
        }
      ]
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
      expect.anything()
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
});