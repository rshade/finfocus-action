import * as core from '@actions/core';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigManager } from '../../src/config.js';
import { ActionConfiguration } from '../../src/types.js';

jest.mock('@actions/core');
jest.mock('os', () => {
  const actual = jest.requireActual<typeof import('os')>('os');
  return {
    ...actual,
    homedir: jest.fn(() => actual.homedir()),
  };
});

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  let home: string;
  let savedEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    jest.clearAllMocks();
    savedEnv = { ...process.env };
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'finfocus-config-'));
    process.env.FINFOCUS_HOME = home;
    delete process.env.PULUMI_HOME;
    configManager = new ConfigManager();
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in savedEnv)) {
        delete process.env[key];
      }
    }
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    fs.rmSync(home, { recursive: true, force: true });
  });

  function configPath(): string {
    return path.join(home, 'config.hujson');
  }

  function readConfig(): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(configPath(), 'utf8')) as Record<string, unknown>;
  }

  describe('writeConfig', () => {
    it('should skip configuration if budget amount is not provided', async () => {
      const config: ActionConfiguration = {
        budgetAmount: undefined,
      } as ActionConfiguration;

      await configManager.writeConfig(config);

      expect(core.warning).toHaveBeenCalledWith(
        'Budget amount is not configured or invalid. Skipping budget configuration.',
      );
      expect(fs.existsSync(configPath())).toBe(false);
    });

    it('should skip configuration if budget amount is zero or negative', async () => {
      const config: ActionConfiguration = {
        budgetAmount: 0,
      } as ActionConfiguration;

      await configManager.writeConfig(config);

      expect(core.warning).toHaveBeenCalledWith(
        'Budget amount is not configured or invalid. Skipping budget configuration.',
      );
      expect(fs.existsSync(configPath())).toBe(false);
    });

    it('should create the config directory and write cost.budgets.global', async () => {
      const config: ActionConfiguration = {
        budgetAmount: 1000,
        debug: true,
      } as ActionConfiguration;

      await configManager.writeConfig(config);

      expect(fs.existsSync(home)).toBe(true);
      expect(fs.existsSync(path.join(home, 'config.yaml'))).toBe(false);
      expect(readConfig()).toEqual({
        cost: {
          budgets: {
            global: {
              amount: 1000,
              currency: 'USD',
              period: 'monthly',
              alerts: [
                { threshold: 80, type: 'actual' },
                { threshold: 100, type: 'forecasted' },
              ],
            },
          },
        },
      });
      expect(core.info).toHaveBeenCalledWith('=== ConfigManager: Writing budget configuration ===');
      expect(core.info).toHaveBeenCalledWith('  Budget amount: 1000');
    });

    it('should write custom currency, period, and alerts', async () => {
      const config: ActionConfiguration = {
        budgetAmount: 5000,
        budgetCurrency: 'EUR',
        budgetPeriod: 'quarterly',
        budgetAlerts: '[{"threshold": 75, "type": "actual"}]',
      } as ActionConfiguration;

      await configManager.writeConfig(config);

      const global = (
        readConfig() as {
          cost: { budgets: { global: Record<string, unknown> } };
        }
      ).cost.budgets.global;
      expect(global).toEqual({
        amount: 5000,
        currency: 'EUR',
        period: 'quarterly',
        alerts: [{ threshold: 75, type: 'actual' }],
      });
    });

    it('should handle invalid period and default to monthly', async () => {
      const config: ActionConfiguration = {
        budgetAmount: 1000,
        budgetPeriod: 'invalid-period',
      } as ActionConfiguration;

      await configManager.writeConfig(config);

      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('Invalid budget period "invalid-period"'),
      );
      const global = (readConfig() as { cost: { budgets: { global: { period: string } } } }).cost
        .budgets.global;
      expect(global.period).toBe('monthly');
    });

    it('should handle invalid JSON alerts and use defaults', async () => {
      const config: ActionConfiguration = {
        budgetAmount: 1000,
        budgetAlerts: 'not-valid-json',
      } as ActionConfiguration;

      await configManager.writeConfig(config);

      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse budget alerts JSON'),
      );
      const alerts = (
        readConfig() as {
          cost: { budgets: { global: { alerts: { threshold: number }[] } } };
        }
      ).cost.budgets.global.alerts;
      expect(alerts.map((alert) => alert.threshold)).toEqual([80, 100]);
    });

    it('should filter out invalid alert entries', async () => {
      const config: ActionConfiguration = {
        budgetAmount: 1000,
        budgetAlerts: JSON.stringify([
          { threshold: 75, type: 'actual' },
          { threshold: -10, type: 'actual' },
          { threshold: 90, type: 'invalid-type' },
          { threshold: 100, type: 'forecasted' },
        ]),
      } as ActionConfiguration;

      await configManager.writeConfig(config);

      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('Invalid alert threshold: -10'),
      );
      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('Invalid alert type: invalid-type'),
      );
      const alerts = (
        readConfig() as {
          cost: { budgets: { global: { alerts: { threshold: number }[] } } };
        }
      ).cost.budgets.global.alerts;
      expect(alerts.map((alert) => alert.threshold)).toEqual([75, 100]);
    });

    it('should use default alerts if all entries are invalid', async () => {
      const config: ActionConfiguration = {
        budgetAmount: 1000,
        budgetAlerts: JSON.stringify([
          { threshold: -10, type: 'actual' },
          { threshold: 0, type: 'forecasted' },
        ]),
      } as ActionConfiguration;

      await configManager.writeConfig(config);

      expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('No valid alerts found'));
      const alerts = (
        readConfig() as {
          cost: { budgets: { global: { alerts: { threshold: number }[] } } };
        }
      ).cost.budgets.global.alerts;
      expect(alerts.map((alert) => alert.threshold)).toEqual([80, 100]);
    });

    it('should handle non-array JSON for alerts', async () => {
      const config: ActionConfiguration = {
        budgetAmount: 1000,
        budgetAlerts: '{"threshold": 80, "type": "actual"}',
      } as ActionConfiguration;

      await configManager.writeConfig(config);

      expect(core.warning).toHaveBeenCalledWith(
        'Budget alerts must be an array. Using default alerts.',
      );
      const alerts = (
        readConfig() as {
          cost: { budgets: { global: { alerts: { threshold: number }[] } } };
        }
      ).cost.budgets.global.alerts;
      expect(alerts.map((alert) => alert.threshold)).toEqual([80, 100]);
    });

    it('should support yearly and quarterly periods', async () => {
      await configManager.writeConfig({
        budgetAmount: 3000,
        budgetPeriod: 'quarterly',
      } as ActionConfiguration);
      expect(
        (readConfig() as { cost: { budgets: { global: { period: string } } } }).cost.budgets.global
          .period,
      ).toBe('quarterly');

      await configManager.writeConfig({
        budgetAmount: 12000,
        budgetPeriod: 'yearly',
      } as ActionConfiguration);
      expect(
        (readConfig() as { cost: { budgets: { global: { period: string } } } }).cost.budgets.global
          .period,
      ).toBe('yearly');
    });

    it('merges the budget into an existing hujson file and keeps other keys', async () => {
      fs.writeFileSync(
        configPath(),
        `{
          // recorded by plugin install
          "output": {"default_format": "json",},
          "installed_plugins": [
            {"name": "aws-public", "version": "v0.2.0", "url": "https://example.com/aws"},
          ],
          "cost": {
            "budgets": {
              "providers": {"aws": {"amount": 3, "currency": "USD", "period": "monthly"}}
            }
          }
        }`,
        'utf8',
      );

      await configManager.writeConfig({
        budgetAmount: 5,
        budgetCurrency: 'USD',
        budgetPeriod: 'monthly',
      } as ActionConfiguration);

      expect(readConfig()).toEqual({
        output: { default_format: 'json' },
        installed_plugins: [
          { name: 'aws-public', version: 'v0.2.0', url: 'https://example.com/aws' },
        ],
        cost: {
          budgets: {
            providers: { aws: { amount: 3, currency: 'USD', period: 'monthly' } },
            global: {
              amount: 5,
              currency: 'USD',
              period: 'monthly',
              alerts: [
                { threshold: 80, type: 'actual' },
                { threshold: 100, type: 'forecasted' },
              ],
            },
          },
        },
      });
    });

    it('writes config.hujson without copying a legacy config.yaml', async () => {
      const yaml = 'output:\n  default_format: table\ninstalled_plugins:\n  - name: aws-public\n';
      fs.writeFileSync(path.join(home, 'config.yaml'), yaml, 'utf8');

      await configManager.writeConfig({ budgetAmount: 5 } as ActionConfiguration);

      expect(readConfig().installed_plugins).toBeUndefined();
      expect(readConfig().cost).toEqual({
        budgets: {
          global: {
            amount: 5,
            currency: 'USD',
            period: 'monthly',
            alerts: [
              { threshold: 80, type: 'actual' },
              { threshold: 100, type: 'forecasted' },
            ],
          },
        },
      });
      expect(fs.readFileSync(path.join(home, 'config.yaml'), 'utf8')).toBe(yaml);
    });

    it('does not let a stale config.yaml replace keys already in config.hujson', async () => {
      fs.writeFileSync(
        configPath(),
        JSON.stringify({ installed_plugins: [{ name: 'aws-public' }], from: 'hujson' }),
        'utf8',
      );
      fs.writeFileSync(
        path.join(home, 'config.yaml'),
        'from: yaml\ninstalled_plugins:\n  - name: dropped\n',
        'utf8',
      );

      await configManager.writeConfig({ budgetAmount: 5 } as ActionConfiguration);

      const written = readConfig();
      expect(written.from).toBe('hujson');
      expect(written.installed_plugins).toEqual([{ name: 'aws-public' }]);
    });

    it('leaves an unreadable config.hujson unchanged', async () => {
      const original = '{ not json';
      fs.writeFileSync(configPath(), original, 'utf8');

      await expect(
        configManager.writeConfig({ budgetAmount: 5 } as ActionConfiguration),
      ).rejects.toThrow(/Failed to parse/);
      expect(fs.readFileSync(configPath(), 'utf8')).toBe(original);
    });

    it('uses ~/.finfocus when FINFOCUS_HOME is unset', async () => {
      const userHome = fs.mkdtempSync(path.join(os.tmpdir(), 'finfocus-user-'));
      delete process.env.FINFOCUS_HOME;
      // The os mock replaces homedir for src/config.ts. Point it at a temp
      // directory before writing so the real ~/.finfocus is never touched.
      (os.homedir as jest.Mock).mockReturnValue(userHome);

      try {
        await configManager.writeConfig({ budgetAmount: 9 } as ActionConfiguration);
        const written = path.join(userHome, '.finfocus', 'config.hujson');
        expect(fs.existsSync(written)).toBe(true);
        expect(written.startsWith(userHome)).toBe(true);
      } finally {
        (os.homedir as jest.Mock).mockReturnValue(
          jest.requireActual<typeof import('os')>('os').homedir(),
        );
        fs.rmSync(userHome, { recursive: true, force: true });
      }
    });

    it('prefers FINFOCUS_HOME over PULUMI_HOME', async () => {
      const pulumiHome = fs.mkdtempSync(path.join(os.tmpdir(), 'pulumi-home-'));
      process.env.PULUMI_HOME = pulumiHome;

      await configManager.writeConfig({ budgetAmount: 9 } as ActionConfiguration);

      expect(fs.existsSync(configPath())).toBe(true);
      expect(fs.existsSync(path.join(pulumiHome, 'finfocus', 'config.hujson'))).toBe(false);
      fs.rmSync(pulumiHome, { recursive: true, force: true });
    });

    it('uses $PULUMI_HOME/finfocus when FINFOCUS_HOME is unset', async () => {
      const pulumiHome = fs.mkdtempSync(path.join(os.tmpdir(), 'pulumi-home-'));
      delete process.env.FINFOCUS_HOME;
      process.env.PULUMI_HOME = pulumiHome;

      await configManager.writeConfig({ budgetAmount: 9 } as ActionConfiguration);

      expect(fs.existsSync(path.join(pulumiHome, 'finfocus', 'config.hujson'))).toBe(true);
      fs.rmSync(pulumiHome, { recursive: true, force: true });
    });
  });

  describe('writeScoringConfig', () => {
    it('adds jev scoring without removing an existing budget or plugins', async () => {
      await configManager.writeConfig({ budgetAmount: 5 } as ActionConfiguration);
      fs.writeFileSync(
        configPath(),
        JSON.stringify({
          ...readConfig(),
          installed_plugins: [{ name: 'aws-public' }],
        }),
        'utf8',
      );

      await configManager.writeScoringConfig({ enableJevScoring: true } as ActionConfiguration);

      const written = readConfig();
      expect(written.installed_plugins).toEqual([{ name: 'aws-public' }]);
      expect(written.cost).toEqual({
        budgets: {
          global: {
            amount: 5,
            currency: 'USD',
            period: 'monthly',
            alerts: [
              { threshold: 80, type: 'actual' },
              { threshold: 100, type: 'forecasted' },
            ],
          },
        },
      });
      expect(written.scoring).toEqual({
        enabled: true,
        plugin: 'jev',
        identifier_mode: 'pseudonymized',
      });
      expect(JSON.stringify(written)).not.toContain('TYPESAFE_API_KEY');
    });

    it('leaves an existing scoring section unchanged', async () => {
      const original = {
        scoring: { enabled: false, plugin: 'other' },
        installed_plugins: [{ name: 'jev' }],
      };
      fs.writeFileSync(configPath(), JSON.stringify(original), 'utf8');

      await configManager.writeScoringConfig({ enableJevScoring: true } as ActionConfiguration);

      expect(readConfig()).toEqual(original);
      expect(core.info).toHaveBeenCalledWith(
        'scoring section already present in config.hujson; leaving it unchanged',
      );
    });

    it('does nothing when Jev scoring is disabled', async () => {
      await configManager.writeScoringConfig({ enableJevScoring: false } as ActionConfiguration);
      expect(fs.existsSync(configPath())).toBe(false);
    });
  });
});
