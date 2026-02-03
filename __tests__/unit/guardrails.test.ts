import {
  checkThreshold,
  checkCarbonThreshold,
  checkBudgetThresholdWithExitCodes,
  checkBudgetThresholdWithJson,
  checkBudgetThreshold,
  BudgetThresholdMessages,
} from '../../src/guardrails.js';
import { BudgetExitCode, FinfocusReport } from '../../src/types.js';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as install from '../../src/install.js';

jest.mock('@actions/core');
jest.mock('@actions/exec');
jest.mock('../../src/install.js');

describe('Guardrails', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkThreshold', () => {
    it('should return false if threshold is null', () => {
      expect(checkThreshold(null, 100, 'USD')).toBe(false);
    });

    it('should return true if cost increase exceeds threshold', () => {
      expect(checkThreshold('50USD', 100, 'USD')).toBe(true);
    });

    it('should return false if cost increase is within threshold', () => {
      expect(checkThreshold('150USD', 100, 'USD')).toBe(false);
    });

    it('should warn and return false for malformed threshold', () => {
      expect(checkThreshold('invalid', 100, 'USD')).toBe(false);
      expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('Malformed threshold'));
    });

    it('should warn and return false for currency mismatch', () => {
      expect(checkThreshold('50EUR', 100, 'USD')).toBe(false);
      expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('Currency mismatch'));
    });
  });

  describe('checkCarbonThreshold', () => {
    it('should return false if threshold is null', () => {
      expect(checkCarbonThreshold(null, 10, 100)).toBe(false);
    });

    it('should return true if absolute carbon increase exceeds threshold', () => {
      expect(checkCarbonThreshold('5kg', 10, 100)).toBe(true);
      expect(checkCarbonThreshold('5kgCO2e', 10, 100)).toBe(true);
    });

    it('should return false if absolute carbon increase is within threshold', () => {
      expect(checkCarbonThreshold('15kg', 10, 100)).toBe(false);
    });

    it('should return true if percent carbon increase exceeds threshold', () => {
      expect(checkCarbonThreshold('5%', 10, 100)).toBe(true);
    });

    it('should return false if percent carbon increase is within threshold', () => {
      expect(checkCarbonThreshold('15%', 10, 100)).toBe(false);
    });

    it('should warn and return false for malformed carbon threshold', () => {
      expect(checkCarbonThreshold('invalid', 10, 100)).toBe(false);
      expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('Malformed carbon threshold'));
    });

    it('should handle zero base total for percent threshold', () => {
      expect(checkCarbonThreshold('10%', 10, 0)).toBe(false);
    });
  });

  describe('checkBudgetThresholdWithExitCodes', () => {
    const mockConfig = {
      pulumiPlanJsonPath: 'plan.json',
      githubToken: 'token',
      finfocusVersion: 'latest',
      installPlugins: [],
      behaviorOnError: 'fail' as const,
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
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return passed=true with severity=none for exit code 0 (pass)', async () => {
      (exec.getExecOutput as jest.Mock).mockResolvedValue({
        exitCode: BudgetExitCode.PASS,
        stdout: 'Budget check passed',
        stderr: '',
      });

      const result = await checkBudgetThresholdWithExitCodes(mockConfig);

      expect(result.passed).toBe(true);
      expect(result.severity).toBe('none');
      expect(result.exitCode).toBe(0);
      expect(result.message).toBe(BudgetThresholdMessages.PASS);
    });

    it('should return passed=false with severity=warning for exit code 1 (warning)', async () => {
      (exec.getExecOutput as jest.Mock).mockResolvedValue({
        exitCode: BudgetExitCode.WARNING,
        stdout: 'Warning threshold breached',
        stderr: '',
      });

      const result = await checkBudgetThresholdWithExitCodes(mockConfig);

      expect(result.passed).toBe(false);
      expect(result.severity).toBe('warning');
      expect(result.exitCode).toBe(1);
      expect(result.message).toBe(BudgetThresholdMessages.WARNING);
    });

    it('should return passed=false with severity=critical for exit code 2 (critical)', async () => {
      (exec.getExecOutput as jest.Mock).mockResolvedValue({
        exitCode: BudgetExitCode.CRITICAL,
        stdout: 'Critical threshold breached',
        stderr: '',
      });

      const result = await checkBudgetThresholdWithExitCodes(mockConfig);

      expect(result.passed).toBe(false);
      expect(result.severity).toBe('critical');
      expect(result.exitCode).toBe(2);
      expect(result.message).toBe(BudgetThresholdMessages.CRITICAL);
    });

    it('should return passed=false with severity=exceeded for exit code 3 (exceeded)', async () => {
      (exec.getExecOutput as jest.Mock).mockResolvedValue({
        exitCode: BudgetExitCode.EXCEEDED,
        stdout: 'Budget exceeded',
        stderr: '',
      });

      const result = await checkBudgetThresholdWithExitCodes(mockConfig);

      expect(result.passed).toBe(false);
      expect(result.severity).toBe('exceeded');
      expect(result.exitCode).toBe(3);
      expect(result.message).toBe(BudgetThresholdMessages.EXCEEDED);
    });

    it('should throw error for unexpected exit code (4+)', async () => {
      (exec.getExecOutput as jest.Mock).mockResolvedValue({
        exitCode: 4,
        stdout: '',
        stderr: 'Unknown error',
      });

      await expect(checkBudgetThresholdWithExitCodes(mockConfig)).rejects.toThrow(
        'Unexpected finfocus exit code: 4'
      );
    });

    it('should throw error for command execution failure', async () => {
      (exec.getExecOutput as jest.Mock).mockRejectedValue(new Error('Command timeout'));

      await expect(checkBudgetThresholdWithExitCodes(mockConfig)).rejects.toThrow(
        'Failed to run budget threshold check: Command timeout'
      );
    });

    it('should use debug logging when debug=true', async () => {
      const debugConfig = { ...mockConfig, debug: true };
      (exec.getExecOutput as jest.Mock).mockResolvedValue({
        exitCode: BudgetExitCode.PASS,
        stdout: 'Budget check passed',
        stderr: '',
      });

      await checkBudgetThresholdWithExitCodes(debugConfig);

      expect(core.debug).toHaveBeenCalledWith(expect.stringContaining('exit code: 0'));
    });
  });

  describe('checkBudgetThresholdWithJson', () => {
    const mockConfig = {
      pulumiPlanJsonPath: 'plan.json',
      githubToken: 'token',
      finfocusVersion: 'latest',
      installPlugins: [],
      behaviorOnError: 'fail' as const,
      postComment: true,
      threshold: '100USD',
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
    };

    const mockReport: FinfocusReport = {
      summary: {
        totalMonthly: 150,
        totalHourly: 0.21,
        currency: 'USD',
      },
      diff: {
        monthly_cost_change: 50,
        percent_change: 10,
      },
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return passed=true when cost is within threshold', () => {
      const result = checkBudgetThresholdWithJson(mockConfig, mockReport);

      expect(result.passed).toBe(true);
      expect(result.severity).toBe('none');
      expect(result.message).toContain('within budget');
    });

    it('should return passed=false when cost exceeds threshold', () => {
      const exceedingReport: FinfocusReport = {
        ...mockReport,
        diff: {
          monthly_cost_change: 150,
          percent_change: 30,
        },
      };

      const result = checkBudgetThresholdWithJson(mockConfig, exceedingReport);

      expect(result.passed).toBe(false);
      expect(result.severity).toBe('exceeded');
      expect(result.message).toContain('exceeds');
    });

    it('should return passed=true when threshold is null', () => {
      const noThresholdConfig = { ...mockConfig, threshold: null };
      const result = checkBudgetThresholdWithJson(noThresholdConfig, mockReport);

      expect(result.passed).toBe(true);
      expect(result.severity).toBe('none');
    });

    it('should return passed=true when no diff data available', () => {
      const noDiffReport: FinfocusReport = {
        summary: {
          totalMonthly: 150,
          totalHourly: 0.21,
          currency: 'USD',
        },
      };

      const result = checkBudgetThresholdWithJson(mockConfig, noDiffReport);

      expect(result.passed).toBe(true);
      expect(result.severity).toBe('none');
    });
  });

  describe('checkBudgetThreshold', () => {
    const mockConfig = {
      pulumiPlanJsonPath: 'plan.json',
      githubToken: 'token',
      finfocusVersion: 'latest',
      installPlugins: [],
      behaviorOnError: 'fail' as const,
      postComment: true,
      threshold: '100USD',
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
    };

    const mockReport: FinfocusReport = {
      summary: {
        totalMonthly: 150,
        totalHourly: 0.21,
        currency: 'USD',
      },
      diff: {
        monthly_cost_change: 50,
        percent_change: 10,
      },
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should use exit codes for version >= 0.2.5', async () => {
      (install.getFinfocusVersion as jest.Mock).mockResolvedValue('0.2.5');
      (install.supportsExitCodes as jest.Mock).mockReturnValue(true);
      (exec.getExecOutput as jest.Mock).mockResolvedValue({
        exitCode: BudgetExitCode.PASS,
        stdout: '',
        stderr: '',
      });

      const result = await checkBudgetThreshold(mockConfig, mockReport);

      expect(result.passed).toBe(true);
      expect(exec.getExecOutput).toHaveBeenCalled();
    });

    it('should use JSON fallback for version < 0.2.5', async () => {
      (install.getFinfocusVersion as jest.Mock).mockResolvedValue('0.2.4');
      (install.supportsExitCodes as jest.Mock).mockReturnValue(false);

      const result = await checkBudgetThreshold(mockConfig, mockReport);

      expect(result.passed).toBe(true);
      expect(result.severity).toBe('none');
      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('falling back to JSON parsing')
      );
    });

    it('should use JSON fallback when version detection fails', async () => {
      // getFinfocusVersion returns '0.0.0' sentinel on failure instead of throwing
      (install.getFinfocusVersion as jest.Mock).mockResolvedValue('0.0.0');

      const result = await checkBudgetThreshold(mockConfig, mockReport);

      expect(result.passed).toBe(true);
      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('Could not detect finfocus version')
      );
    });

    it('should preserve existing fail-on-cost-increase behavior', async () => {
      (install.getFinfocusVersion as jest.Mock).mockResolvedValue('0.2.4');
      (install.supportsExitCodes as jest.Mock).mockReturnValue(false);

      const exceedingReport: FinfocusReport = {
        ...mockReport,
        diff: {
          monthly_cost_change: 150,
          percent_change: 30,
        },
      };

      const result = await checkBudgetThreshold(mockConfig, exceedingReport);

      expect(result.passed).toBe(false);
      expect(result.severity).toBe('exceeded');
    });
  });

  describe('BudgetThresholdMessages (US3: Clear Error Messages)', () => {
    it('should have distinct warning message for exit code 1', async () => {
      (exec.getExecOutput as jest.Mock).mockResolvedValue({
        exitCode: BudgetExitCode.WARNING,
        stdout: '',
        stderr: '',
      });

      const mockConfig = {
        pulumiPlanJsonPath: 'plan.json',
        githubToken: 'token',
        finfocusVersion: 'latest',
        installPlugins: [],
        behaviorOnError: 'fail' as const,
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
      };

      const result = await checkBudgetThresholdWithExitCodes(mockConfig);

      expect(result.message).toBe(BudgetThresholdMessages.WARNING);
      expect(result.message).toContain('Warning');
      expect(result.message).toContain('Approaching');
    });

    it('should have distinct critical message for exit code 2', async () => {
      (exec.getExecOutput as jest.Mock).mockResolvedValue({
        exitCode: BudgetExitCode.CRITICAL,
        stdout: '',
        stderr: '',
      });

      const mockConfig = {
        pulumiPlanJsonPath: 'plan.json',
        githubToken: 'token',
        finfocusVersion: 'latest',
        installPlugins: [],
        behaviorOnError: 'fail' as const,
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
      };

      const result = await checkBudgetThresholdWithExitCodes(mockConfig);

      expect(result.message).toBe(BudgetThresholdMessages.CRITICAL);
      expect(result.message).toContain('Critical');
      expect(result.message).toContain('breached');
    });

    it('should have distinct exceeded message for exit code 3', async () => {
      (exec.getExecOutput as jest.Mock).mockResolvedValue({
        exitCode: BudgetExitCode.EXCEEDED,
        stdout: '',
        stderr: '',
      });

      const mockConfig = {
        pulumiPlanJsonPath: 'plan.json',
        githubToken: 'token',
        finfocusVersion: 'latest',
        installPlugins: [],
        behaviorOnError: 'fail' as const,
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
      };

      const result = await checkBudgetThresholdWithExitCodes(mockConfig);

      expect(result.message).toBe(BudgetThresholdMessages.EXCEEDED);
      expect(result.message).toContain('exceeded');
    });
  });
});
