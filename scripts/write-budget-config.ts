import { ConfigManager } from '../src/config.js';
import { ActionConfiguration } from '../src/types.js';

const amount = Number(process.env.BUDGET_AMOUNT);
if (!Number.isFinite(amount) || amount <= 0) {
  throw new Error('BUDGET_AMOUNT must be a positive number');
}

const manager = new ConfigManager();
await manager.writeConfig({
  budgetAmount: amount,
  budgetCurrency: process.env.BUDGET_CURRENCY || 'USD',
  budgetPeriod: process.env.BUDGET_PERIOD || 'monthly',
  budgetAlerts: process.env.BUDGET_ALERTS,
} as ActionConfiguration);
