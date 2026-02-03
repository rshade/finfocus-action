import { Analyzer } from '../../src/analyze.js';
import { ActionConfiguration, BudgetHealthReport, BudgetHealthStatus } from '../../src/types.js';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as install from '../../src/install.js';

jest.mock('@actions/core');
jest.mock('@actions/exec');
jest.mock('../../src/install.js');

describe('Budget Health', () => {
  let analyzer: Analyzer;

  const baseConfig: ActionConfiguration = {
    pulumiPlanJsonPath: 'plan.json',
    githubToken: 'token',
    finfocusVersion: 'latest',
    installPlugins: [],
    behaviorOnError: 'fail',
    postComment: true,
    threshold: null,
    analyzerMode: false,
    detailedComment: false,
    includeRecommendations: true,
    logLevel: 'error',
    debug: false,
    includeActualCosts: false,
    actualCostsPeriod: '7d',
    pulumiStateJsonPath: '',
    actualCostsGroupBy: 'provider',
    includeSustainability: true,
    utilizationRate: '1.0',
    sustainabilityEquivalents: true,
    failOnCarbonIncrease: null,
    budgetAmount: 2000,
    budgetCurrency: 'USD',
    budgetPeriod: 'monthly',
    budgetAlertThreshold: 80,
    showBudgetForecast: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    analyzer = new Analyzer();
  });

  describe('runBudgetStatus', () => {
    it('should return undefined when budget amount is not configured', async () => {
      const config = { ...baseConfig, budgetAmount: undefined };
      const result = await analyzer.runBudgetStatus(config);
      expect(result).toBeUndefined();
    });

    it('should return undefined when budget amount is zero', async () => {
      const config = { ...baseConfig, budgetAmount: 0 };
      const result = await analyzer.runBudgetStatus(config);
      expect(result).toBeUndefined();
    });

    it('should return undefined when budget amount is negative', async () => {
      const config = { ...baseConfig, budgetAmount: -100 };
      const result = await analyzer.runBudgetStatus(config);
      expect(result).toBeUndefined();
    });

    it('should return undefined for finfocus < 0.2.5 (fallback to basic budget status)', async () => {
      (install.getFinfocusVersion as jest.Mock).mockResolvedValue('0.2.4');
      (install.supportsExitCodes as jest.Mock).mockReturnValue(false);

      const result = await analyzer.runBudgetStatus(baseConfig);

      // Fallback returns undefined so PR comment uses basic budget status section
      expect(result).toBeUndefined();
      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('Budget health features require finfocus v0.2.5+'),
      );
    });

    it('should parse valid JSON response from finfocus v0.2.5+', async () => {
      (install.getFinfocusVersion as jest.Mock).mockResolvedValue('0.2.5');
      (install.supportsExitCodes as jest.Mock).mockReturnValue(true);
      (exec.getExecOutput as jest.Mock).mockResolvedValue({
        exitCode: 0,
        stdout: JSON.stringify({
          health_score: 85,
          status: 'healthy',
          spent: 1234.56,
          remaining: 765.44,
          percent_used: 61.7,
          forecast: 1890.0,
          runway_days: 12,
          budget: {
            amount: 2000,
            currency: 'USD',
            period: 'monthly',
          },
        }),
        stderr: '',
      });

      const result = await analyzer.runBudgetStatus(baseConfig);

      expect(result).toBeDefined();
      expect(result?.healthScore).toBe(85);
      expect(result?.healthStatus).toBe('healthy');
      expect(result?.spent).toBe(1234.56);
      expect(result?.remaining).toBe(765.44);
      expect(result?.percentUsed).toBe(61.7);
      expect(result?.forecast).toBe('$1890.00');
      expect(result?.forecastAmount).toBe(1890.0);
      expect(result?.runwayDays).toBe(12);
    });

    it('should return undefined and log warning for invalid JSON response', async () => {
      (install.getFinfocusVersion as jest.Mock).mockResolvedValue('0.2.5');
      (install.supportsExitCodes as jest.Mock).mockReturnValue(true);
      (exec.getExecOutput as jest.Mock).mockResolvedValue({
        exitCode: 0,
        stdout: 'not valid json',
        stderr: '',
      });

      const result = await analyzer.runBudgetStatus(baseConfig);

      // Fallback returns undefined so PR comment uses basic budget status section
      expect(result).toBeUndefined();
      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse finfocus budget status response'),
      );
    });

    it('should return undefined when finfocus budget status command fails', async () => {
      (install.getFinfocusVersion as jest.Mock).mockResolvedValue('0.2.5');
      (install.supportsExitCodes as jest.Mock).mockReturnValue(true);
      (exec.getExecOutput as jest.Mock).mockResolvedValue({
        exitCode: 1,
        stdout: '',
        stderr: 'Budget not configured',
      });

      const result = await analyzer.runBudgetStatus(baseConfig);

      // Fallback returns undefined so PR comment uses basic budget status section
      expect(result).toBeUndefined();
      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('finfocus budget status failed'),
      );
    });
  });

  describe('Health Score Calculation', () => {
    it('should return health score in 0-100 range', async () => {
      (install.getFinfocusVersion as jest.Mock).mockResolvedValue('0.2.5');
      (install.supportsExitCodes as jest.Mock).mockReturnValue(true);
      (exec.getExecOutput as jest.Mock).mockResolvedValue({
        exitCode: 0,
        stdout: JSON.stringify({
          health_score: 85,
          status: 'healthy',
          spent: 300,
          remaining: 700,
          percent_used: 30,
          forecast: 450,
          runway_days: 30,
          budget: { amount: 1000, currency: 'USD', period: 'monthly' },
        }),
        stderr: '',
      });

      const result = await analyzer.runBudgetStatus(baseConfig);

      expect(result?.healthScore).toBeGreaterThanOrEqual(0);
      expect(result?.healthScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Status Classification', () => {
    const testCases: Array<{
      healthScore: number;
      spent: number;
      amount: number;
      expectedStatus: BudgetHealthStatus;
      description: string;
    }> = [
      { healthScore: 100, spent: 0, amount: 1000, expectedStatus: 'healthy', description: '100% health score' },
      { healthScore: 80, spent: 200, amount: 1000, expectedStatus: 'healthy', description: 'boundary at 80' },
      { healthScore: 79, spent: 500, amount: 1000, expectedStatus: 'warning', description: 'just below 80' },
      { healthScore: 50, spent: 500, amount: 1000, expectedStatus: 'warning', description: 'boundary at 50' },
      { healthScore: 49, spent: 600, amount: 1000, expectedStatus: 'critical', description: 'just below 50' },
      { healthScore: 1, spent: 900, amount: 1000, expectedStatus: 'critical', description: 'minimal positive score' },
      { healthScore: 0, spent: 1000, amount: 1000, expectedStatus: 'exceeded', description: 'zero health score' },
      { healthScore: 50, spent: 1100, amount: 1000, expectedStatus: 'exceeded', description: 'spent exceeds budget' },
    ];

    testCases.forEach(({ healthScore, spent, amount, expectedStatus, description }) => {
      it(`should classify status as "${expectedStatus}" when ${description}`, async () => {
        (install.getFinfocusVersion as jest.Mock).mockResolvedValue('0.2.5');
        (install.supportsExitCodes as jest.Mock).mockReturnValue(true);
        (exec.getExecOutput as jest.Mock).mockResolvedValue({
          exitCode: 0,
          stdout: JSON.stringify({
            health_score: healthScore,
            status: expectedStatus,
            spent,
            remaining: amount - spent,
            percent_used: (spent / amount) * 100,
            forecast: spent * 1.2,
            runway_days: spent > amount ? 0 : 30,
            budget: { amount, currency: 'USD', period: 'monthly' },
          }),
          stderr: '',
        });

        const result = await analyzer.runBudgetStatus(baseConfig);

        expect(result?.healthStatus).toBe(expectedStatus);
      });
    });
  });

  describe('Exceeded Status Priority', () => {
    it('should return exceeded status when spent exceeds budget regardless of health score', async () => {
      (install.getFinfocusVersion as jest.Mock).mockResolvedValue('0.2.5');
      (install.supportsExitCodes as jest.Mock).mockReturnValue(true);
      (exec.getExecOutput as jest.Mock).mockResolvedValue({
        exitCode: 0,
        stdout: JSON.stringify({
          health_score: 75, // Would normally be "warning"
          status: 'exceeded',
          spent: 1200, // Over budget
          remaining: -200,
          percent_used: 120,
          forecast: 1500,
          runway_days: 0,
          budget: { amount: 1000, currency: 'USD', period: 'monthly' },
        }),
        stderr: '',
      });

      const result = await analyzer.runBudgetStatus(baseConfig);

      expect(result?.healthStatus).toBe('exceeded');
    });
  });

  describe('Edge Cases', () => {
    it('should handle wrapped JSON format (finfocus v0.2.4+ compatibility)', async () => {
      (install.getFinfocusVersion as jest.Mock).mockResolvedValue('0.2.5');
      (install.supportsExitCodes as jest.Mock).mockReturnValue(true);
      (exec.getExecOutput as jest.Mock).mockResolvedValue({
        exitCode: 0,
        stdout: JSON.stringify({
          finfocus: {
            health_score: 85,
            status: 'healthy',
            spent: 500,
            remaining: 500,
            percent_used: 50,
            forecast: 750,
            runway_days: 15,
            budget: { amount: 1000, currency: 'USD', period: 'monthly' },
          },
        }),
        stderr: '',
      });

      const result = await analyzer.runBudgetStatus(baseConfig);

      expect(result?.healthScore).toBe(85);
      expect(result?.healthStatus).toBe('healthy');
    });

    it('should return undefined for empty stdout response', async () => {
      (install.getFinfocusVersion as jest.Mock).mockResolvedValue('0.2.5');
      (install.supportsExitCodes as jest.Mock).mockReturnValue(true);
      (exec.getExecOutput as jest.Mock).mockResolvedValue({
        exitCode: 0,
        stdout: '',
        stderr: '',
      });

      const result = await analyzer.runBudgetStatus(baseConfig);

      // Fallback returns undefined so PR comment uses basic budget status section
      expect(result).toBeUndefined();
      expect(core.warning).toHaveBeenCalledWith('Empty response from finfocus budget status');
    });

    it('should handle different currency symbols', async () => {
      (install.getFinfocusVersion as jest.Mock).mockResolvedValue('0.2.5');
      (install.supportsExitCodes as jest.Mock).mockReturnValue(true);
      (exec.getExecOutput as jest.Mock).mockResolvedValue({
        exitCode: 0,
        stdout: JSON.stringify({
          health_score: 85,
          status: 'healthy',
          spent: 500,
          remaining: 500,
          percent_used: 50,
          forecast: 750,
          runway_days: 15,
          budget: { amount: 1000, currency: 'EUR', period: 'monthly' },
        }),
        stderr: '',
      });

      const result = await analyzer.runBudgetStatus(baseConfig);

      expect(result?.forecast).toBe('€750.00');
    });
  });
});
