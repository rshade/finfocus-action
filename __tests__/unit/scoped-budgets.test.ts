import * as core from '@actions/core';
import * as fs from 'fs';
import * as os from 'os';
import { parseBudgetScopes, SCOPE_SOFT_LIMIT, ConfigManager } from '../../src/config.js';
import { ActionConfiguration } from '../../src/types.js';
import { requiresScopedBudgetVersion, supportsScopedBudgets } from '../../src/install.js';

// Mock fs.promises to avoid destructuring errors
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  statSync: jest.fn(),
  readdirSync: jest.fn(),
  promises: {
    access: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
  },
}));

jest.mock('@actions/core');
jest.mock('os');

describe('parseBudgetScopes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('valid formats', () => {
    it('should parse valid provider scope', () => {
      const input = 'provider/aws: 1000';
      const result = parseBudgetScopes(input);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        scope: 'provider/aws',
        scopeType: 'provider',
        scopeKey: 'aws',
        amount: 1000,
      });
    });

    it('should parse valid type scope', () => {
      const input = 'type/compute: 500';
      const result = parseBudgetScopes(input);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        scope: 'type/compute',
        scopeType: 'type',
        scopeKey: 'compute',
        amount: 500,
      });
    });

    it('should parse valid tag scope', () => {
      const input = 'tag/env:prod: 800';
      const result = parseBudgetScopes(input);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        scope: 'tag/env:prod',
        scopeType: 'tag',
        scopeKey: 'env:prod',
        amount: 800,
      });
    });

    it('should parse tag with multiple colons (tag/k8s:app:nginx)', () => {
      const input = 'tag/k8s:app:nginx: 500';
      const result = parseBudgetScopes(input);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        scope: 'tag/k8s:app:nginx',
        scopeType: 'tag',
        scopeKey: 'k8s:app:nginx',
        amount: 500,
      });
    });

    it('should parse multiple scopes from multiline input', () => {
      const input = `provider/aws: 1000
provider/gcp: 500
type/compute: 1200
tag/env:prod: 800`;

      const result = parseBudgetScopes(input);

      expect(result).toHaveLength(4);
      expect(result[0].scope).toBe('provider/aws');
      expect(result[1].scope).toBe('provider/gcp');
      expect(result[2].scope).toBe('type/compute');
      expect(result[3].scope).toBe('tag/env:prod');
    });

    it('should handle decimal amounts', () => {
      const input = 'provider/aws: 1000.50';
      const result = parseBudgetScopes(input);

      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(1000.50);
    });

    it('should handle extra whitespace', () => {
      const input = '  provider/aws  :  1000  ';
      const result = parseBudgetScopes(input);

      expect(result).toHaveLength(1);
      expect(result[0].scope).toBe('provider/aws');
      expect(result[0].amount).toBe(1000);
    });

    it('should skip comment lines', () => {
      const input = `# This is a comment
provider/aws: 1000
# Another comment
provider/gcp: 500`;

      const result = parseBudgetScopes(input);

      expect(result).toHaveLength(2);
    });

    it('should handle scope keys with hyphens and underscores', () => {
      const input = `provider/aws-us-east-1: 500
type/compute_intensive: 300`;

      const result = parseBudgetScopes(input);

      expect(result).toHaveLength(2);
      expect(result[0].scopeKey).toBe('aws-us-east-1');
      expect(result[1].scopeKey).toBe('compute_intensive');
    });

    it('should handle scope keys with dots', () => {
      const input = 'tag/app.name:myapp: 500';
      const result = parseBudgetScopes(input);

      expect(result).toHaveLength(1);
      expect(result[0].scopeKey).toBe('app.name:myapp');
    });
  });

  describe('invalid formats', () => {
    it('should skip and warn for invalid scope format (missing prefix)', () => {
      const input = 'invalid-scope: 1000';
      const result = parseBudgetScopes(input);

      expect(result).toHaveLength(0);
      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('Invalid scope format'),
      );
    });

    it('should skip and warn for missing colon', () => {
      const input = 'provider/aws 1000';
      const result = parseBudgetScopes(input);

      expect(result).toHaveLength(0);
      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('missing colon'),
      );
    });

    it('should skip and warn for invalid amount (non-numeric)', () => {
      const input = 'provider/aws: abc';
      const result = parseBudgetScopes(input);

      expect(result).toHaveLength(0);
      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('Invalid amount'),
      );
    });

    it('should skip and warn for negative amount', () => {
      const input = 'provider/aws: -100';
      const result = parseBudgetScopes(input);

      expect(result).toHaveLength(0);
      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('Invalid amount'),
      );
    });

    it('should skip and warn for zero amount', () => {
      const input = 'provider/aws: 0';
      const result = parseBudgetScopes(input);

      expect(result).toHaveLength(0);
      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('Invalid amount'),
      );
    });

    it('should skip invalid scopes but keep valid ones', () => {
      const input = `provider/aws: 1000
invalid-scope: 500
provider/gcp: 300`;

      const result = parseBudgetScopes(input);

      expect(result).toHaveLength(2);
      expect(result[0].scope).toBe('provider/aws');
      expect(result[1].scope).toBe('provider/gcp');
      expect(core.warning).toHaveBeenCalled();
    });
  });

  describe('empty input', () => {
    it('should return empty array for empty string', () => {
      const result = parseBudgetScopes('');
      expect(result).toHaveLength(0);
    });

    it('should return empty array for whitespace only', () => {
      const result = parseBudgetScopes('   \n   \n   ');
      expect(result).toHaveLength(0);
    });

    it('should return empty array for comment-only input', () => {
      const result = parseBudgetScopes('# Just a comment');
      expect(result).toHaveLength(0);
    });
  });

  describe('soft limit warning', () => {
    it('should warn when exceeding soft limit', () => {
      const lines = [];
      for (let i = 0; i < SCOPE_SOFT_LIMIT + 5; i++) {
        lines.push(`provider/aws${i}: ${1000 + i}`);
      }
      const input = lines.join('\n');

      const result = parseBudgetScopes(input);

      expect(result).toHaveLength(SCOPE_SOFT_LIMIT + 5);
      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining(`exceeds recommended limit of ${SCOPE_SOFT_LIMIT}`),
      );
    });

    it('should not warn when at soft limit', () => {
      const lines = [];
      for (let i = 0; i < SCOPE_SOFT_LIMIT; i++) {
        lines.push(`provider/aws${i}: ${1000 + i}`);
      }
      const input = lines.join('\n');

      parseBudgetScopes(input);

      expect(core.warning).not.toHaveBeenCalledWith(
        expect.stringContaining('exceeds recommended limit'),
      );
    });
  });
});

describe('ConfigManager with scopes', () => {
  let configManager: ConfigManager;
  let mockHomedir: string;

  beforeEach(() => {
    jest.clearAllMocks();
    configManager = new ConfigManager();
    mockHomedir = '/mock/home';
    (os.homedir as jest.Mock).mockReturnValue(mockHomedir);
    (fs.existsSync as jest.Mock).mockReturnValue(true);
  });

  describe('generateYaml with scopes', () => {
    it('should include scopes section in YAML when scopes are configured', async () => {
      const config: ActionConfiguration = {
        budgetAmount: 2000,
        budgetCurrency: 'USD',
        budgetPeriod: 'monthly',
        budgetScopes: `provider/aws: 1000
provider/gcp: 500`,
      } as ActionConfiguration;

      await configManager.writeConfig(config);

      const writeCall = (fs.writeFileSync as jest.Mock).mock.calls[0];
      const yamlContent = writeCall[1];

      expect(yamlContent).toContain('scopes:');
      expect(yamlContent).toContain('provider/aws:');
      expect(yamlContent).toContain('amount: 1000');
      expect(yamlContent).toContain('provider/gcp:');
      expect(yamlContent).toContain('amount: 500');
    });

    it('should not include scopes section when no scopes configured', async () => {
      const config: ActionConfiguration = {
        budgetAmount: 2000,
        budgetCurrency: 'USD',
        budgetPeriod: 'monthly',
        budgetScopes: '',
      } as ActionConfiguration;

      await configManager.writeConfig(config);

      const writeCall = (fs.writeFileSync as jest.Mock).mock.calls[0];
      const yamlContent = writeCall[1];

      expect(yamlContent).not.toContain('scopes:');
    });

    it('should skip invalid scopes in YAML output', async () => {
      const config: ActionConfiguration = {
        budgetAmount: 2000,
        budgetCurrency: 'USD',
        budgetPeriod: 'monthly',
        budgetScopes: `provider/aws: 1000
invalid-scope: 500
provider/gcp: 300`,
      } as ActionConfiguration;

      await configManager.writeConfig(config);

      const writeCall = (fs.writeFileSync as jest.Mock).mock.calls[0];
      const yamlContent = writeCall[1];

      expect(yamlContent).toContain('provider/aws:');
      expect(yamlContent).toContain('provider/gcp:');
      expect(yamlContent).not.toContain('invalid-scope');
    });
  });
});

describe('Version checks for scoped budgets', () => {
  describe('supportsScopedBudgets', () => {
    it('should return true for v0.2.6', () => {
      expect(supportsScopedBudgets('0.2.6')).toBe(true);
    });

    it('should return true for v0.2.7', () => {
      expect(supportsScopedBudgets('0.2.7')).toBe(true);
    });

    it('should return true for v0.3.0', () => {
      expect(supportsScopedBudgets('0.3.0')).toBe(true);
    });

    it('should return true for v1.0.0', () => {
      expect(supportsScopedBudgets('1.0.0')).toBe(true);
    });

    it('should return false for v0.2.5', () => {
      expect(supportsScopedBudgets('0.2.5')).toBe(false);
    });

    it('should return false for v0.2.4', () => {
      expect(supportsScopedBudgets('0.2.4')).toBe(false);
    });

    it('should return false for v0.1.0', () => {
      expect(supportsScopedBudgets('0.1.0')).toBe(false);
    });
  });

  describe('requiresScopedBudgetVersion', () => {
    it('should not throw for v0.2.6', () => {
      expect(() => requiresScopedBudgetVersion('0.2.6')).not.toThrow();
    });

    it('should not throw for v0.3.0', () => {
      expect(() => requiresScopedBudgetVersion('0.3.0')).not.toThrow();
    });

    it('should throw for v0.2.5', () => {
      expect(() => requiresScopedBudgetVersion('0.2.5')).toThrow(
        'Scoped budgets require finfocus v0.2.6+. Current version: 0.2.5',
      );
    });

    it('should throw for v0.2.4', () => {
      expect(() => requiresScopedBudgetVersion('0.2.4')).toThrow(
        'Scoped budgets require finfocus v0.2.6+',
      );
    });
  });
});
