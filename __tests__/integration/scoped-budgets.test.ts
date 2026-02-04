import * as exec from '@actions/exec';
import * as core from '@actions/core';
import * as fs from 'fs';
import { Analyzer } from '../../src/analyze.js';
import { formatScopedBudgetSection } from '../../src/formatter.js';
import { parseBudgetScopes } from '../../src/config.js';
import { checkScopedBudgetBreach } from '../../src/guardrails.js';
import * as install from '../../src/install.js';
import { ActionConfiguration, BudgetScope } from '../../src/types.js';

jest.mock('@actions/exec');
jest.mock('@actions/core');
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
}));
jest.mock('../../src/install.js', () => ({
  ...jest.requireActual('../../src/install.js'),
  getFinfocusVersion: jest.fn(),
}));

describe('Scoped Budgets Integration', () => {
  let analyzer: Analyzer;

  const createConfig = (
    budgetScopes: string,
    failOnBreach: boolean = false,
    budgetAmount?: number,
  ): ActionConfiguration => ({
    pulumiPlanJsonPath: 'plan.json',
    githubToken: 'token',
    finfocusVersion: 'v0.2.6',
    installPlugins: [],
    behaviorOnError: 'fail',
    postComment: true,
    threshold: null,
    analyzerMode: false,
    detailedComment: false,
    includeRecommendations: false,
    logLevel: 'error',
    debug: true,
    includeActualCosts: false,
    actualCostsPeriod: '7d',
    pulumiStateJsonPath: '',
    actualCostsGroupBy: 'provider',
    budgetScopes,
    failOnBudgetScopeBreach: failOnBreach,
    budgetAmount,
    budgetCurrency: 'USD',
    budgetPeriod: 'monthly',
  });

  beforeEach(() => {
    analyzer = new Analyzer();
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    // Default to v0.2.6+ for most tests
    (install.getFinfocusVersion as jest.Mock).mockResolvedValue('0.2.6');
  });

  describe('T047: Tag-based budgets integration', () => {
    it('should parse, execute, format, and validate tag-based budgets end-to-end', async () => {
      // Step 1: Parse tag scopes from input
      const input = `tag/env:prod: 1000
tag/env:staging: 500
tag/team:platform: 750`;

      const parsedScopes: BudgetScope[] = parseBudgetScopes(input);

      expect(parsedScopes).toHaveLength(3);
      expect(parsedScopes[0]).toEqual({
        scope: 'tag/env:prod',
        scopeType: 'tag',
        scopeKey: 'env:prod',
        amount: 1000,
      });
      expect(parsedScopes[1]).toEqual({
        scope: 'tag/env:staging',
        scopeType: 'tag',
        scopeKey: 'env:staging',
        amount: 500,
      });
      expect(parsedScopes[2]).toEqual({
        scope: 'tag/team:platform',
        scopeType: 'tag',
        scopeKey: 'team:platform',
        amount: 750,
      });

      // Step 2: Mock CLI response for tag scopes
      const mockCliResponse = {
        finfocus: {
          scopes: [
            {
              scope: 'tag/env:prod',
              spent: 800,
              budget: 1000,
              currency: 'USD',
              percent_used: 80,
              status: 'warning',
              alerts: [],
            },
            {
              scope: 'tag/env:staging',
              spent: 250,
              budget: 500,
              currency: 'USD',
              percent_used: 50,
              status: 'healthy',
              alerts: [],
            },
            {
              scope: 'tag/team:platform',
              spent: 600,
              budget: 750,
              currency: 'USD',
              percent_used: 80,
              status: 'warning',
              alerts: [],
            },
          ],
          errors: [],
        },
      };

      (exec.getExecOutput as jest.Mock).mockResolvedValue({
        exitCode: 0,
        stdout: JSON.stringify(mockCliResponse),
        stderr: '',
      });

      const config = createConfig(input);
      const report = await analyzer.runScopedBudgetStatus(config);

      expect(report).toBeDefined();
      expect(report!.scopes).toHaveLength(3);

      // Step 3: Verify formatting includes tag scopes with readable labels
      const formatted = formatScopedBudgetSection(report, 'USD');

      expect(formatted).toContain('Budget Status by Scope');
      expect(formatted).toContain('tag/env:prod');
      expect(formatted).toContain('tag/env:staging');
      expect(formatted).toContain('tag/team:platform');
      expect(formatted).toContain('$800.00');
      expect(formatted).toContain('$1000.00');
      expect(formatted).toContain('🟡'); // Warning status

      // Step 4: Verify breach check passes (no breaches)
      const breachResult = checkScopedBudgetBreach(report, true);
      expect(breachResult.passed).toBe(true);
    });

    it('should handle complex tag keys with multiple colons (tag/k8s:app:nginx)', async () => {
      const input = `tag/k8s:app:nginx: 500
tag/k8s:namespace:default: 300`;

      const parsedScopes = parseBudgetScopes(input);

      expect(parsedScopes).toHaveLength(2);
      expect(parsedScopes[0].scopeKey).toBe('k8s:app:nginx');
      expect(parsedScopes[1].scopeKey).toBe('k8s:namespace:default');

      const mockCliResponse = {
        finfocus: {
          scopes: [
            {
              scope: 'tag/k8s:app:nginx',
              spent: 200,
              budget: 500,
              currency: 'USD',
              percent_used: 40,
              status: 'healthy',
              alerts: [],
            },
            {
              scope: 'tag/k8s:namespace:default',
              spent: 150,
              budget: 300,
              currency: 'USD',
              percent_used: 50,
              status: 'healthy',
              alerts: [],
            },
          ],
          errors: [],
        },
      };

      (exec.getExecOutput as jest.Mock).mockResolvedValue({
        exitCode: 0,
        stdout: JSON.stringify(mockCliResponse),
        stderr: '',
      });

      const config = createConfig(input);
      const report = await analyzer.runScopedBudgetStatus(config);

      expect(report).toBeDefined();
      const formatted = formatScopedBudgetSection(report, 'USD');
      expect(formatted).toContain('tag/k8s:app:nginx');
      expect(formatted).toContain('tag/k8s:namespace:default');
    });
  });

  describe('T051: Combined scopes display integration', () => {
    it('should display all scope types in single sorted table', async () => {
      const input = `provider/aws: 1000
provider/gcp: 500
type/compute: 800
type/storage: 300
tag/env:prod: 600`;

      const parsedScopes = parseBudgetScopes(input);
      expect(parsedScopes).toHaveLength(5);

      // Verify all scope types are parsed
      expect(parsedScopes.filter((s) => s.scopeType === 'provider')).toHaveLength(2);
      expect(parsedScopes.filter((s) => s.scopeType === 'type')).toHaveLength(2);
      expect(parsedScopes.filter((s) => s.scopeType === 'tag')).toHaveLength(1);

      const mockCliResponse = {
        finfocus: {
          scopes: [
            {
              scope: 'provider/aws',
              spent: 950,
              budget: 1000,
              currency: 'USD',
              percent_used: 95,
              status: 'warning',
              alerts: [],
            },
            {
              scope: 'provider/gcp',
              spent: 200,
              budget: 500,
              currency: 'USD',
              percent_used: 40,
              status: 'healthy',
              alerts: [],
            },
            {
              scope: 'type/compute',
              spent: 700,
              budget: 800,
              currency: 'USD',
              percent_used: 87.5,
              status: 'warning',
              alerts: [],
            },
            {
              scope: 'type/storage',
              spent: 100,
              budget: 300,
              currency: 'USD',
              percent_used: 33.33,
              status: 'healthy',
              alerts: [],
            },
            {
              scope: 'tag/env:prod',
              spent: 550,
              budget: 600,
              currency: 'USD',
              percent_used: 91.67,
              status: 'warning',
              alerts: [],
            },
          ],
          errors: [],
        },
      };

      (exec.getExecOutput as jest.Mock).mockResolvedValue({
        exitCode: 0,
        stdout: JSON.stringify(mockCliResponse),
        stderr: '',
      });

      const config = createConfig(input);
      const report = await analyzer.runScopedBudgetStatus(config);

      expect(report).toBeDefined();
      expect(report!.scopes).toHaveLength(5);

      const formatted = formatScopedBudgetSection(report, 'USD');

      // Should be a single table with all scope types
      const tableHeaderCount = (formatted.match(/\| Scope \| Spent \| Budget \| Status \|/g) || [])
        .length;
      expect(tableHeaderCount).toBe(1);

      // Verify all scopes are present
      expect(formatted).toContain('provider/aws');
      expect(formatted).toContain('provider/gcp');
      expect(formatted).toContain('type/compute');
      expect(formatted).toContain('type/storage');
      expect(formatted).toContain('tag/env:prod');

      // Verify sorting by percentUsed descending
      const awsPos = formatted.indexOf('provider/aws'); // 95%
      const tagPos = formatted.indexOf('tag/env:prod'); // 91.67%
      const computePos = formatted.indexOf('type/compute'); // 87.5%
      const gcpPos = formatted.indexOf('provider/gcp'); // 40%
      const storagePos = formatted.indexOf('type/storage'); // 33.33%

      expect(awsPos).toBeLessThan(tagPos);
      expect(tagPos).toBeLessThan(computePos);
      expect(computePos).toBeLessThan(gcpPos);
      expect(gcpPos).toBeLessThan(storagePos);
    });

    it('should detect breaches across mixed scope types', async () => {
      const input = `provider/aws: 1000
type/compute: 500
tag/env:prod: 300`;

      const mockCliResponse = {
        finfocus: {
          scopes: [
            {
              scope: 'provider/aws',
              spent: 500,
              budget: 1000,
              currency: 'USD',
              percent_used: 50,
              status: 'healthy',
              alerts: [],
            },
            {
              scope: 'type/compute',
              spent: 550,
              budget: 500,
              currency: 'USD',
              percent_used: 110,
              status: 'exceeded',
              alerts: [],
            },
            {
              scope: 'tag/env:prod',
              spent: 250,
              budget: 300,
              currency: 'USD',
              percent_used: 83.33,
              status: 'warning',
              alerts: [],
            },
          ],
          errors: [],
        },
      };

      (exec.getExecOutput as jest.Mock).mockResolvedValue({
        exitCode: 0,
        stdout: JSON.stringify(mockCliResponse),
        stderr: '',
      });

      const config = createConfig(input, true);
      const report = await analyzer.runScopedBudgetStatus(config);

      const breachResult = checkScopedBudgetBreach(report, true);

      expect(breachResult.passed).toBe(false);
      expect(breachResult.severity).toBe('exceeded');
      expect(breachResult.message).toContain('type/compute');
      expect(breachResult.message).not.toContain('provider/aws');
      expect(breachResult.message).not.toContain('tag/env:prod');
    });
  });

  describe('T051a: Scoped budgets alongside global budget inputs', () => {
    it('should work with global budget-amount, budget-currency, budget-period inputs', async () => {
      // Config with both global budget and scoped budgets
      const config = createConfig(
        `provider/aws: 800
provider/gcp: 400`,
        false,
        2000, // budget-amount
      );

      expect(config.budgetAmount).toBe(2000);
      expect(config.budgetCurrency).toBe('USD');
      expect(config.budgetPeriod).toBe('monthly');
      expect(config.budgetScopes).toContain('provider/aws: 800');

      const mockCliResponse = {
        finfocus: {
          scopes: [
            {
              scope: 'provider/aws',
              spent: 600,
              budget: 800,
              currency: 'USD',
              percent_used: 75,
              status: 'healthy',
              alerts: [],
            },
            {
              scope: 'provider/gcp',
              spent: 200,
              budget: 400,
              currency: 'USD',
              percent_used: 50,
              status: 'healthy',
              alerts: [],
            },
          ],
          errors: [],
        },
      };

      (exec.getExecOutput as jest.Mock).mockResolvedValue({
        exitCode: 0,
        stdout: JSON.stringify(mockCliResponse),
        stderr: '',
      });

      const report = await analyzer.runScopedBudgetStatus(config);

      expect(report).toBeDefined();
      expect(report!.scopes).toHaveLength(2);

      // Verify scoped budgets work independently of global budget
      const formatted = formatScopedBudgetSection(report, config.budgetCurrency || 'USD');
      expect(formatted).toContain('provider/aws');
      expect(formatted).toContain('$600.00');
      expect(formatted).toContain('$800.00');
    });

    it('should allow scopes to sum to less than global budget', async () => {
      // Global budget is 2000, but scopes only sum to 1200
      const config = createConfig(
        `provider/aws: 800
provider/gcp: 400`,
        false,
        2000,
      );

      const parsedScopes = parseBudgetScopes(config.budgetScopes || '');
      const scopesSum = parsedScopes.reduce((sum, s) => sum + s.amount, 0);

      expect(scopesSum).toBe(1200);
      expect(config.budgetAmount).toBe(2000);
      // This is valid - scopes don't need to equal global budget
    });

    it('should allow scopes to sum to more than global budget', async () => {
      // Global budget is 1000, but scopes sum to 1500 (overlapping resources)
      const config = createConfig(
        `provider/aws: 800
provider/gcp: 400
type/compute: 300`,
        false,
        1000,
      );

      const parsedScopes = parseBudgetScopes(config.budgetScopes || '');
      const scopesSum = parsedScopes.reduce((sum, s) => sum + s.amount, 0);

      expect(scopesSum).toBe(1500);
      expect(config.budgetAmount).toBe(1000);
      // This is valid - resources can count toward multiple scopes
    });

    it('should use global currency for scoped budget display', async () => {
      const config: ActionConfiguration = {
        ...createConfig(
          `provider/aws: 1000
provider/gcp: 500`,
          false,
          2000,
        ),
        budgetCurrency: 'EUR',
      };

      const mockCliResponse = {
        finfocus: {
          scopes: [
            {
              scope: 'provider/aws',
              spent: 500,
              budget: 1000,
              currency: 'EUR',
              percent_used: 50,
              status: 'healthy',
              alerts: [],
            },
            {
              scope: 'provider/gcp',
              spent: 200,
              budget: 500,
              currency: 'EUR',
              percent_used: 40,
              status: 'healthy',
              alerts: [],
            },
          ],
          errors: [],
        },
      };

      (exec.getExecOutput as jest.Mock).mockResolvedValue({
        exitCode: 0,
        stdout: JSON.stringify(mockCliResponse),
        stderr: '',
      });

      const report = await analyzer.runScopedBudgetStatus(config);
      const formatted = formatScopedBudgetSection(report, config.budgetCurrency || 'USD');

      expect(formatted).toContain('€500.00');
      expect(formatted).toContain('€1000.00');
    });
  });

  describe('Error handling in integration flow', () => {
    it('should handle partial failures gracefully', async () => {
      const input = `provider/aws: 1000
tag/nonexistent:value: 500`;

      const mockCliResponse = {
        finfocus: {
          scopes: [
            {
              scope: 'provider/aws',
              spent: 600,
              budget: 1000,
              currency: 'USD',
              percent_used: 60,
              status: 'healthy',
              alerts: [],
            },
          ],
          errors: [
            {
              scope: 'tag/nonexistent:value',
              error: 'No resources found matching tag',
            },
          ],
        },
      };

      (exec.getExecOutput as jest.Mock).mockResolvedValue({
        exitCode: 0,
        stdout: JSON.stringify(mockCliResponse),
        stderr: '',
      });

      const config = createConfig(input);
      const report = await analyzer.runScopedBudgetStatus(config);

      expect(report).toBeDefined();
      expect(report!.scopes).toHaveLength(1);
      expect(report!.failed).toHaveLength(1);
      expect(report!.failed[0].scope).toBe('tag/nonexistent:value');

      const formatted = formatScopedBudgetSection(report, 'USD');
      expect(formatted).toContain('provider/aws');
      expect(formatted).toContain('1 scope(s) failed to process');
      expect(formatted).toContain('tag/nonexistent:value');

      // Breach check should only consider successful scopes
      const breachResult = checkScopedBudgetBreach(report, true);
      expect(breachResult.passed).toBe(true);
    });

    it('should fail when CLI version is below v0.2.6', async () => {
      // Mock an older version
      (install.getFinfocusVersion as jest.Mock).mockResolvedValue('0.2.5');

      const config = createConfig('provider/aws: 1000');

      await expect(analyzer.runScopedBudgetStatus(config)).rejects.toThrow(
        'Scoped budgets require finfocus v0.2.6+',
      );

      // Note: main.ts handles setFailed, not the Analyzer
    });
  });
});
