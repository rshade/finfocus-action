import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { BudgetExitCode, BudgetThresholdResult, ActionConfiguration, FinfocusReport, BudgetHealthReport } from './types.js';
import { getFinfocusVersion, supportsExitCodes } from './install.js';

/**
 * Human-readable messages for each budget threshold result.
 */
export const BudgetThresholdMessages = {
  PASS: 'Budget thresholds passed',
  WARNING: 'Warning: Approaching budget threshold',
  CRITICAL: 'Critical: Budget threshold breached',
  EXCEEDED: 'Budget exceeded',
} as const;

/**
 * Check budget threshold using finfocus exit codes (v0.2.5+).
 * Runs `finfocus cost projected` and interprets the exit code.
 *
 * Exit codes:
 * - 0: All thresholds passed
 * - 1: Warning threshold breached
 * - 2: Critical threshold breached
 * - 3: Budget exceeded
 *
 * @param config - Action configuration
 * @returns BudgetThresholdResult with pass/fail status and severity
 */
export async function checkBudgetThresholdWithExitCodes(
  config: ActionConfiguration
): Promise<BudgetThresholdResult> {
  try {
    const result = await exec.getExecOutput('finfocus', ['cost', 'projected', config.pulumiPlanJsonPath], {
      ignoreReturnCode: true,
      silent: !config.debug,
    });

    if (config.debug) {
      core.debug(`Budget threshold check exit code: ${result.exitCode}`);
      core.debug(`Budget threshold check stdout: ${result.stdout}`);
    }

    switch (result.exitCode) {
      case BudgetExitCode.PASS:
        return {
          passed: true,
          severity: 'none',
          exitCode: BudgetExitCode.PASS,
          message: BudgetThresholdMessages.PASS,
        };
      case BudgetExitCode.WARNING:
        return {
          passed: false,
          severity: 'warning',
          exitCode: BudgetExitCode.WARNING,
          message: BudgetThresholdMessages.WARNING,
        };
      case BudgetExitCode.CRITICAL:
        return {
          passed: false,
          severity: 'critical',
          exitCode: BudgetExitCode.CRITICAL,
          message: BudgetThresholdMessages.CRITICAL,
        };
      case BudgetExitCode.EXCEEDED:
        return {
          passed: false,
          severity: 'exceeded',
          exitCode: BudgetExitCode.EXCEEDED,
          message: BudgetThresholdMessages.EXCEEDED,
        };
      default:
        throw new Error(`Unexpected finfocus exit code: ${result.exitCode}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Unexpected finfocus exit code')) {
      throw error;
    }
    throw new Error(
      `Failed to run budget threshold check: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Check budget threshold using JSON parsing (fallback for finfocus < v0.2.5).
 * Uses the existing checkThreshold() function to compare cost difference against threshold.
 *
 * @param config - Action configuration
 * @param report - Finfocus report with cost data
 * @returns BudgetThresholdResult with pass/fail status
 */
export function checkBudgetThresholdWithJson(
  config: ActionConfiguration,
  report: FinfocusReport
): BudgetThresholdResult {
  if (!config.threshold) {
    return {
      passed: true,
      severity: 'none',
      message: 'No threshold configured',
    };
  }

  if (!report.diff) {
    return {
      passed: true,
      severity: 'none',
      message: 'No cost diff data available',
    };
  }

  const currency = report.summary?.currency ?? report.currency ?? 'USD';
  const failed = checkThreshold(config.threshold, report.diff.monthly_cost_change, currency);

  if (failed) {
    return {
      passed: false,
      severity: 'exceeded',
      message: `Cost increase of ${report.diff.monthly_cost_change} ${currency} exceeds threshold ${config.threshold}`,
    };
  }

  return {
    passed: true,
    severity: 'none',
    message: `Cost within budget threshold (${report.diff.monthly_cost_change} ${currency} < ${config.threshold})`,
  };
}

/**
 * Main budget threshold check orchestrator.
 * Detects finfocus version and uses exit codes (v0.2.5+) or JSON parsing (older versions).
 *
 * @param config - Action configuration
 * @param report - Finfocus report with cost data (used for JSON fallback)
 * @returns BudgetThresholdResult with pass/fail status and severity
 */
export async function checkBudgetThreshold(
  config: ActionConfiguration,
  report: FinfocusReport
): Promise<BudgetThresholdResult> {
  const version = await getFinfocusVersion();

  // Handle version detection failure (getFinfocusVersion returns '0.0.0' on failure)
  if (version === '0.0.0') {
    core.warning('Could not detect finfocus version, falling back to JSON parsing');
    return checkBudgetThresholdWithJson(config, report);
  }

  if (config.debug) {
    core.debug(`Detected finfocus version: ${version}`);
  }

  const useExitCodes = supportsExitCodes(version);

  if (config.debug) {
    core.debug(`Using exit codes: ${useExitCodes}`);
  }

  if (useExitCodes) {
    return checkBudgetThresholdWithExitCodes(config);
  }

  core.warning('finfocus version < 0.2.5, falling back to JSON parsing for threshold check');
  return checkBudgetThresholdWithJson(config, report);
}

export function checkThreshold(threshold: string | null, diff: number, currency: string): boolean {
  if (!threshold) return false;

  const regex = /^(\d+(\.\d{1,2})?)([A-Z]{3})$/;
  const match = threshold.match(regex);

  if (!match) {
    core.warning(
      `Malformed threshold input: "${threshold}". Expected format like "100USD". Skipping guardrail.`,
    );
    return false;
  }

  const limitValue = parseFloat(match[1]);
  const limitCurrency = match[3];

  if (limitCurrency !== currency) {
    core.warning(
      `Currency mismatch in threshold. Threshold: ${limitCurrency}, Report: ${currency}. Skipping guardrail.`,
    );
    return false;
  }

  if (diff > limitValue) {
    return true;
  }

  return false;
}

export function checkCarbonThreshold(
  threshold: string | null,
  diff: number,
  baseTotal: number,
): boolean {
  if (!threshold) return false;

  // Pattern for absolute: "10kg", "10.5kgCO2e", etc.
  // Pattern for percent: "10%"
  const absRegex = /^(\d+(\.\d{1,2})?)(kg|kgCO2e)?$/i;
  const pctRegex = /^(\d+(\.\d{1,2})?)%$/;

  const absMatch = threshold.match(absRegex);
  const pctMatch = threshold.match(pctRegex);

  if (absMatch) {
    const limitValue = parseFloat(absMatch[1]);
    return diff > limitValue;
  }

  if (pctMatch) {
    const limitPct = parseFloat(pctMatch[1]);
    if (baseTotal <= 0) return false; // Avoid division by zero or nonsensical checks
    const currentPct = (diff / baseTotal) * 100;
    return currentPct > limitPct;
  }

  core.warning(
    `Malformed carbon threshold input: "${threshold}". Expected format like "10kg" or "10%". Skipping guardrail.`,
  );
  return false;
}

/**
 * Check if budget health score meets the configured threshold.
 * Fails the action if the health score is below the threshold.
 *
 * @param config - Action configuration with failOnBudgetHealth threshold
 * @param budgetHealth - Budget health report with health score
 * @returns BudgetThresholdResult with pass/fail status
 */
export function checkBudgetHealthThreshold(
  config: ActionConfiguration,
  budgetHealth: BudgetHealthReport,
): BudgetThresholdResult {
  // If no threshold is configured, pass
  if (!config.failOnBudgetHealth) {
    return {
      passed: true,
      severity: 'none',
      message: 'No health threshold configured',
    };
  }

  const threshold = config.failOnBudgetHealth;
  const score = budgetHealth.healthScore;

  // If health score is not available, we cannot evaluate the threshold
  if (score === undefined) {
    core.warning('Budget health score not available, cannot evaluate threshold');
    return {
      passed: true,
      severity: 'none',
      message: 'Budget health score not available',
    };
  }

  // Check if score is below threshold
  if (score < threshold) {
    const severity = budgetHealth.healthStatus === 'exceeded' ? 'exceeded' :
                     budgetHealth.healthStatus === 'critical' ? 'critical' : 'warning';

    return {
      passed: false,
      severity,
      message: `Budget health score ${score} is below threshold ${threshold}`,
    };
  }

  return {
    passed: true,
    severity: 'none',
    message: `Budget health score ${score} meets threshold ${threshold}`,
  };
}
