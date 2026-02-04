import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { ActionConfiguration, BudgetConfiguration, BudgetAlert, BudgetScope, BudgetScopeType } from './types.js';

/** Soft limit for number of scopes before warning is logged */
export const SCOPE_SOFT_LIMIT = 20;

/** Regex pattern for validating scope format: provider/aws, type/compute, tag/env:prod */
const SCOPE_PATTERN = /^(provider|type|tag)\/([a-zA-Z0-9_:.-]+)$/;

/**
 * Parse budget scopes from YAML multiline input string.
 * Each line should be in format: "scope: amount"
 * Valid scope formats: provider/aws, type/compute, tag/env:prod
 *
 * Invalid scopes are logged as warnings and skipped.
 * A warning is logged if more than SCOPE_SOFT_LIMIT scopes are configured.
 *
 * @param input - YAML multiline string of scope:amount pairs
 * @returns Array of parsed BudgetScope objects
 */
export function parseBudgetScopes(input: string): BudgetScope[] {
  if (!input || input.trim() === '') {
    return [];
  }

  const scopes: BudgetScope[] = [];
  const lines = input.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);

  for (const line of lines) {
    // Skip comment lines
    if (line.startsWith('#')) {
      continue;
    }

    // Parse "scope: amount" format
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      core.warning(`Invalid scope format (missing colon): "${line}". Skipping.`);
      continue;
    }

    // Handle tag scopes that may have colons in the value (e.g., tag/env:prod: 1000)
    // For tag scopes, split on the last colon before the amount
    // Format: tag/key:value: amount OR provider/name: amount
    const scopeKey = line.substring(0, colonIndex).trim();
    const amountStr = line.substring(colonIndex + 1).trim();

    // Check if this might be a tag scope with a value that contains colons
    // We need to find where the scope ends and the amount begins
    // tag/k8s:app:nginx: 500 -> scope = tag/k8s:app:nginx, amount = 500
    let scope = scopeKey;
    let amount = parseFloat(amountStr);

    // If amount is not a valid number, it might be part of the scope (tag value)
    // Keep looking for the actual amount at the end
    if (isNaN(amount) && amountStr.includes(':')) {
      // Try to find the last colon that separates scope from amount
      const fullLine = line;
      const lastColonIndex = fullLine.lastIndexOf(':');
      if (lastColonIndex > colonIndex) {
        scope = fullLine.substring(0, lastColonIndex).trim();
        amount = parseFloat(fullLine.substring(lastColonIndex + 1).trim());
      }
    }

    // Validate scope format
    const match = scope.match(SCOPE_PATTERN);
    if (!match) {
      core.warning(
        `Invalid scope format: "${scope}". Expected: provider/*, type/*, or tag/*. Skipping.`,
      );
      continue;
    }

    // Validate amount
    if (isNaN(amount) || amount <= 0) {
      core.warning(`Invalid amount for scope "${scope}": "${amountStr}". Must be a positive number. Skipping.`);
      continue;
    }

    const scopeType = match[1] as BudgetScopeType;
    const scopeValue = match[2];

    scopes.push({
      scope,
      scopeType,
      scopeKey: scopeValue,
      amount,
    });
  }

  // Warn if exceeding soft limit
  if (scopes.length > SCOPE_SOFT_LIMIT) {
    core.warning(
      `Configured ${scopes.length} scopes (exceeds recommended limit of ${SCOPE_SOFT_LIMIT}). ` +
        `Performance and PR comment readability may be impacted.`,
    );
  }

  return scopes;
}

export interface IConfigManager {
  writeConfig(config: ActionConfiguration): Promise<void>;
}

export class ConfigManager implements IConfigManager {
  async writeConfig(config: ActionConfiguration): Promise<void> {
    const debug = config?.debug === true;

    // Validate budget amount
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

    // Parse and validate inputs
    const budgetConfig = this.parseBudgetConfig(config);

    // Parse scoped budgets if configured
    const scopes = config.budgetScopes ? parseBudgetScopes(config.budgetScopes) : [];
    if (debug && scopes.length > 0) {
      core.info(`  Parsed ${scopes.length} scoped budgets`);
    }

    // Define config directory
    const configDir = path.join(os.homedir(), '.finfocus');
    if (debug) core.info(`  Config directory: ${configDir}`);

    // Create directory if it doesn't exist
    if (!fs.existsSync(configDir)) {
      if (debug) core.info('  Creating config directory...');
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Generate YAML content
    const yamlContent = this.generateYaml(budgetConfig, scopes);

    // Write config file
    const configPath = path.join(configDir, 'config.yaml');
    if (debug) {
      core.info(`  Writing config to: ${configPath}`);
      core.info(`  Config content:\n${yamlContent}`);
    }

    fs.writeFileSync(configPath, yamlContent, 'utf8');

    if (debug) core.info('  Budget configuration written successfully');
    else core.info('Budget configuration created successfully');
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
    // Default alerts if none provided
    const defaultAlerts: BudgetAlert[] = [
      { threshold: 80, type: 'actual' },
      { threshold: 100, type: 'forecasted' },
    ];

    if (!alertsInput || alertsInput.trim() === '') {
      return defaultAlerts;
    }

    try {
      const parsed = JSON.parse(alertsInput) as BudgetAlert[];

      // Validate parsed alerts
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
          core.warning(`Invalid alert type: ${alert.type}. Must be "actual" or "forecasted". Skipping.`);
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

  private generateYaml(config: BudgetConfiguration, scopes?: BudgetScope[]): string {
    const lines: string[] = [];

    lines.push('# finfocus budget configuration');
    lines.push('# Generated by finfocus-action');
    lines.push('');
    lines.push('budget:');
    lines.push(`  amount: ${config.amount}`);
    lines.push(`  currency: ${config.currency}`);
    lines.push(`  period: ${config.period}`);

    if (config.alerts && config.alerts.length > 0) {
      lines.push('  alerts:');
      for (const alert of config.alerts) {
        lines.push(`    - threshold: ${alert.threshold}`);
        lines.push(`      type: ${alert.type}`);
      }
    }

    // Add scoped budgets section if configured
    if (scopes && scopes.length > 0) {
      lines.push('  scopes:');
      for (const scope of scopes) {
        lines.push(`    ${scope.scope}:`);
        lines.push(`      amount: ${scope.amount}`);
      }
    }

    lines.push('');
    return lines.join('\n');
  }
}
