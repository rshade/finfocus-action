import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigManager } from '../../src/config.js';
import { ActionConfiguration } from '../../src/types.js';

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

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  let mockHomedir: string;

  beforeEach(() => {
    jest.clearAllMocks();
    configManager = new ConfigManager();
    mockHomedir = '/mock/home';
    (os.homedir as jest.Mock).mockReturnValue(mockHomedir);
    (fs.existsSync as jest.Mock).mockReturnValue(true);
  });

  describe('writeConfig', () => {
    it('should skip configuration if budget amount is not provided', async () => {
      const config: ActionConfiguration = {
        budgetAmount: undefined,
      } as ActionConfiguration;

      await configManager.writeConfig(config);

      expect(core.warning).toHaveBeenCalledWith(
        'Budget amount is not configured or invalid. Skipping budget configuration.',
      );
      expect(fs.mkdirSync).not.toHaveBeenCalled();
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should skip configuration if budget amount is zero or negative', async () => {
      const config: ActionConfiguration = {
        budgetAmount: 0,
      } as ActionConfiguration;

      await configManager.writeConfig(config);

      expect(core.warning).toHaveBeenCalledWith(
        'Budget amount is not configured or invalid. Skipping budget configuration.',
      );
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should create config directory if it does not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const config: ActionConfiguration = {
        budgetAmount: 1000,
        budgetCurrency: 'USD',
        budgetPeriod: 'monthly',
        debug: true,
      } as ActionConfiguration;

      await configManager.writeConfig(config);

      const expectedDir = path.join(mockHomedir, '.finfocus');
      expect(fs.mkdirSync).toHaveBeenCalledWith(expectedDir, { recursive: true });
    });

    it('should write config.yaml with default values', async () => {
      const config: ActionConfiguration = {
        budgetAmount: 1000,
      } as ActionConfiguration;

      await configManager.writeConfig(config);

      const expectedPath = path.join(mockHomedir, '.finfocus', 'config.yaml');
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expectedPath,
        expect.stringContaining('budget:'),
        'utf8',
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expectedPath,
        expect.stringContaining('amount: 1000'),
        'utf8',
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expectedPath,
        expect.stringContaining('currency: USD'),
        'utf8',
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expectedPath,
        expect.stringContaining('period: monthly'),
        'utf8',
      );
    });

    it('should write config.yaml with custom values', async () => {
      const config: ActionConfiguration = {
        budgetAmount: 5000,
        budgetCurrency: 'EUR',
        budgetPeriod: 'quarterly',
        budgetAlerts: '[{"threshold": 75, "type": "actual"}]',
      } as ActionConfiguration;

      await configManager.writeConfig(config);

      const expectedPath = path.join(mockHomedir, '.finfocus', 'config.yaml');
      const writeCall = (fs.writeFileSync as jest.Mock).mock.calls[0];
      const yamlContent = writeCall[1] as string;

      expect(yamlContent).toContain('amount: 5000');
      expect(yamlContent).toContain('currency: EUR');
      expect(yamlContent).toContain('period: quarterly');
      expect(yamlContent).toContain('threshold: 75');
      expect(yamlContent).toContain('type: actual');
    });

    it('should use default alerts when none provided', async () => {
      const config: ActionConfiguration = {
        budgetAmount: 1000,
        budgetCurrency: 'USD',
        budgetPeriod: 'monthly',
      } as ActionConfiguration;

      await configManager.writeConfig(config);

      const writeCall = (fs.writeFileSync as jest.Mock).mock.calls[0];
      const yamlContent = writeCall[1] as string;

      expect(yamlContent).toContain('threshold: 80');
      expect(yamlContent).toContain('type: actual');
      expect(yamlContent).toContain('threshold: 100');
      expect(yamlContent).toContain('type: forecasted');
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

      const writeCall = (fs.writeFileSync as jest.Mock).mock.calls[0];
      const yamlContent = writeCall[1] as string;
      expect(yamlContent).toContain('period: monthly');
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

      const writeCall = (fs.writeFileSync as jest.Mock).mock.calls[0];
      const yamlContent = writeCall[1] as string;
      expect(yamlContent).toContain('threshold: 80');
      expect(yamlContent).toContain('threshold: 100');
    });

    it('should filter out invalid alert entries', async () => {
      const config: ActionConfiguration = {
        budgetAmount: 1000,
        budgetAlerts: JSON.stringify([
          { threshold: 75, type: 'actual' }, // valid
          { threshold: -10, type: 'actual' }, // invalid threshold
          { threshold: 90, type: 'invalid-type' }, // invalid type
          { threshold: 100, type: 'forecasted' }, // valid
        ]),
      } as ActionConfiguration;

      await configManager.writeConfig(config);

      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('Invalid alert threshold: -10'),
      );
      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('Invalid alert type: invalid-type'),
      );

      const writeCall = (fs.writeFileSync as jest.Mock).mock.calls[0];
      const yamlContent = writeCall[1] as string;

      // Should only contain valid alerts
      expect(yamlContent).toContain('threshold: 75');
      expect(yamlContent).toContain('threshold: 100');
      expect(yamlContent.match(/threshold: 75/g)?.length).toBe(1);
      expect(yamlContent.match(/threshold: 100/g)?.length).toBe(1);
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

      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('No valid alerts found'),
      );

      const writeCall = (fs.writeFileSync as jest.Mock).mock.calls[0];
      const yamlContent = writeCall[1] as string;
      expect(yamlContent).toContain('threshold: 80');
      expect(yamlContent).toContain('threshold: 100');
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

      const writeCall = (fs.writeFileSync as jest.Mock).mock.calls[0];
      const yamlContent = writeCall[1] as string;
      expect(yamlContent).toContain('threshold: 80');
      expect(yamlContent).toContain('threshold: 100');
    });

    it('should support yearly and quarterly periods', async () => {
      const quarterlyConfig: ActionConfiguration = {
        budgetAmount: 3000,
        budgetPeriod: 'quarterly',
      } as ActionConfiguration;

      await configManager.writeConfig(quarterlyConfig);

      let writeCall = (fs.writeFileSync as jest.Mock).mock.calls[0];
      let yamlContent = writeCall[1] as string;
      expect(yamlContent).toContain('period: quarterly');

      jest.clearAllMocks();

      const yearlyConfig: ActionConfiguration = {
        budgetAmount: 12000,
        budgetPeriod: 'yearly',
      } as ActionConfiguration;

      await configManager.writeConfig(yearlyConfig);

      writeCall = (fs.writeFileSync as jest.Mock).mock.calls[0];
      yamlContent = writeCall[1] as string;
      expect(yamlContent).toContain('period: yearly');
    });

    it('should generate valid YAML with proper formatting', async () => {
      const config: ActionConfiguration = {
        budgetAmount: 1500,
        budgetCurrency: 'GBP',
        budgetPeriod: 'monthly',
        budgetAlerts: JSON.stringify([{ threshold: 85, type: 'actual' }]),
      } as ActionConfiguration;

      await configManager.writeConfig(config);

      const writeCall = (fs.writeFileSync as jest.Mock).mock.calls[0];
      const yamlContent = writeCall[1] as string;

      // Check YAML structure
      expect(yamlContent).toContain('# finfocus budget configuration');
      expect(yamlContent).toContain('budget:');
      expect(yamlContent).toContain('  amount: 1500');
      expect(yamlContent).toContain('  currency: GBP');
      expect(yamlContent).toContain('  period: monthly');
      expect(yamlContent).toContain('  alerts:');
      expect(yamlContent).toContain('    - threshold: 85');
      expect(yamlContent).toContain('      type: actual');

      // Should have proper indentation
      expect(yamlContent.split('\n').filter((line) => line.startsWith('  ')).length).toBeGreaterThan(
        0,
      );
    });

    it('should log debug info when debug is enabled', async () => {
      const config: ActionConfiguration = {
        budgetAmount: 1000,
        budgetCurrency: 'USD',
        budgetPeriod: 'monthly',
        debug: true,
      } as ActionConfiguration;

      await configManager.writeConfig(config);

      expect(core.info).toHaveBeenCalledWith('=== ConfigManager: Writing budget configuration ===');
      expect(core.info).toHaveBeenCalledWith('  Budget amount: 1000');
      expect(core.info).toHaveBeenCalledWith('  Currency: USD');
      expect(core.info).toHaveBeenCalledWith('  Period: monthly');
    });
  });
});
