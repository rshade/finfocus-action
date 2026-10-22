import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ActionConfiguration, BudgetConfiguration, BudgetAlert } from './types.js';
import { parseHujson } from './hujson.js';

export interface IConfigManager {
  writeConfig(config: ActionConfiguration): Promise<void>;
  writeScoringConfig(config: ActionConfiguration): Promise<void>;
}

type JsonObject = Record<string, unknown>;

const CONFIG_FILE = 'config.hujson';

export class ConfigManager implements IConfigManager {
  async writeConfig(config: ActionConfiguration): Promise<void> {
    const debug = config?.debug === true;

    if (!config.budgetAmount || config.budgetAmount <= 0) {
      core.warning('Budget amount is not configured or invalid. Skipping budget configuration.');
      return;
    }

    if (debug) {
      core.info('=== ConfigManager: Writing budget configuration ===');
      core.info(`  Budget amount: ${config.budgetAmount}`);
      core.info(`  Currency: ${config.budgetCurrency || 'USD'}`);
      core.info(`  Period: ${config.budgetPeriod || 'monthly'}`);
    }

    const budgetConfig = this.parseBudgetConfig(config);
    const document = this.mergeBudget(this.readDocument(), budgetConfig);
    this.writeDocument(document);

    if (debug) core.info('  Budget configuration written successfully');
    else core.info('Budget configuration created successfully');
  }

  /**
   * Opt in to Jev recommendation scoring. finfocus reads `scoring.enabled` and
   * `scoring.plugin` from config.hujson. The action does not write
   * TYPESAFE_API_KEY; the workflow must pass that secret in the environment.
   * An existing scoring section is left unchanged.
   */
  async writeScoringConfig(config: ActionConfiguration): Promise<void> {
    if (!config.enableJevScoring) {
      return;
    }

    const document = this.readDocument();
    if ('scoring' in document) {
      core.info(`scoring section already present in ${CONFIG_FILE}; leaving it unchanged`);
      return;
    }

    document.scoring = {
      enabled: true,
      plugin: 'jev',
      identifier_mode: 'pseudonymized',
    };
    this.writeDocument(document);
    core.info('Jev scoring configuration written (scoring.plugin: jev)');
  }

  /**
   * Directory finfocus reads, in the same order as ResolveConfigDir:
   * FINFOCUS_HOME, then $PULUMI_HOME/finfocus, then ~/.finfocus.
   */
  private configDir(): string {
    const explicit = process.env.FINFOCUS_HOME?.trim();
    if (explicit) {
      return explicit;
    }

    const pulumiHome = process.env.PULUMI_HOME?.trim();
    if (pulumiHome) {
      return path.join(pulumiHome, 'finfocus');
    }

    try {
      const home = os.homedir();
      if (home) {
        return path.join(home, '.finfocus');
      }
    } catch (error) {
      core.debug(
        `os.homedir() failed: ${error instanceof Error ? error.message : String(error)}. Using ./.finfocus.`,
      );
    }
    return path.join(process.cwd(), '.finfocus');
  }

  private readDocument(): JsonObject {
    const directory = this.configDir();
    const hujsonPath = path.join(directory, CONFIG_FILE);
    if (!fs.existsSync(hujsonPath)) {
      return {};
    }
    return this.parseDocument(fs.readFileSync(hujsonPath, 'utf8'), hujsonPath);
  }

  private parseDocument(text: string, filePath: string): JsonObject {
    if (text.trim() === '') {
      return {};
    }

    try {
      const parsed = parseHujson(text);
      if (!isJsonObject(parsed)) {
        throw new Error('document is not a JSON object');
      }
      return parsed;
    } catch (error) {
      throw new Error(
        `Failed to parse ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  }

  private mergeBudget(document: JsonObject, budget: BudgetConfiguration): JsonObject {
    const cost = objectField(document, 'cost');
    const budgets = objectField(cost, 'budgets');
    budgets.global = {
      amount: budget.amount,
      currency: budget.currency,
      period: budget.period,
      alerts: (budget.alerts ?? []).map((alert) => ({
        threshold: alert.threshold,
        type: alert.type,
      })),
    };
    cost.budgets = budgets;
    document.cost = cost;
    return document;
  }

  private writeDocument(document: JsonObject): void {
    const directory = this.configDir();
    fs.mkdirSync(directory, { recursive: true });

    const target = path.join(directory, CONFIG_FILE);
    const temporary = path.join(directory, `.${CONFIG_FILE}.${process.pid}.tmp`);
    const body = `${JSON.stringify(document, null, 2)}\n`;

    try {
      fs.writeFileSync(temporary, body, { encoding: 'utf8', mode: 0o600 });
      fs.renameSync(temporary, target);
    } catch (error) {
      try {
        fs.unlinkSync(temporary);
      } catch (unlinkError) {
        core.debug(
          `Failed to remove temporary config file: ${
            unlinkError instanceof Error ? unlinkError.message : String(unlinkError)
          }`,
        );
      }
      throw new Error(
        `Failed to write ${target}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  }

  private parseBudgetConfig(config: ActionConfiguration): BudgetConfiguration {
    const amount = config.budgetAmount || 0;
    const currency = config.budgetCurrency || 'USD';
    const period = this.validatePeriod(config.budgetPeriod || 'monthly');
    const alerts = this.parseAlerts(config.budgetAlerts);

    return {
      amount,
      currency,
      period,
      alerts,
    };
  }

  private validatePeriod(period: string): 'monthly' | 'quarterly' | 'yearly' {
    const validPeriods = ['monthly', 'quarterly', 'yearly'];
    if (!validPeriods.includes(period)) {
      core.warning(
        `Invalid budget period "${period}". Supported: ${validPeriods.join(', ')}. Defaulting to "monthly".`,
      );
      return 'monthly';
    }
    return period as 'monthly' | 'quarterly' | 'yearly';
  }

  private parseAlerts(alertsInput?: string): BudgetAlert[] {
    const defaultAlerts: BudgetAlert[] = [
      { threshold: 80, type: 'actual' },
      { threshold: 100, type: 'forecasted' },
    ];

    if (!alertsInput || alertsInput.trim() === '') {
      return defaultAlerts;
    }

    try {
      const parsed = JSON.parse(alertsInput) as BudgetAlert[];

      if (!Array.isArray(parsed)) {
        core.warning('Budget alerts must be an array. Using default alerts.');
        return defaultAlerts;
      }

      const validAlerts = parsed.filter((alert) => {
        if (typeof alert.threshold !== 'number' || alert.threshold <= 0) {
          core.warning(`Invalid alert threshold: ${alert.threshold}. Skipping.`);
          return false;
        }
        if (alert.type !== 'actual' && alert.type !== 'forecasted') {
          core.warning(
            `Invalid alert type: ${alert.type}. Must be "actual" or "forecasted". Skipping.`,
          );
          return false;
        }
        return true;
      });

      if (validAlerts.length === 0) {
        core.warning('No valid alerts found. Using default alerts.');
        return defaultAlerts;
      }

      return validAlerts;
    } catch (err) {
      core.warning(
        `Failed to parse budget alerts JSON: ${err instanceof Error ? err.message : String(err)}. Using default alerts.`,
      );
      return defaultAlerts;
    }
  }
}

function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function objectField(parent: JsonObject, key: string): JsonObject {
  const value = parent[key];
  if (isJsonObject(value)) {
    return { ...value };
  }
  if (value !== undefined) {
    core.warning(
      `${key} in the finfocus config is not an object. Replacing it so the budget can be saved.`,
    );
  }
  return {};
}
