import * as core from '@actions/core';
import * as exec from '@actions/exec';
import {
  BudgetExitCode,
  BudgetThresholdResult,
  ActionConfiguration,
  FinfocusReport,
} from './types.js';
import { getFinfocusVersion, supportsExitCodes } from './install.js';
import { parseErrorEnvelope, formatEnvelopeError } from './errors.js';

/**
 * Human-readable messages for each budget threshold result.
 */
export const BudgetThresholdMessages = {
  PASS: 'Budget thresholds passed',
  EXCEEDED: 'Budget exceeded',
} as const;

/**
 * Check budget thresholds using a finfocus exit code the action owns.
 *
 * Runs `finfocus cost projected --pulumi-json <plan> --exit-on-threshold
 * --exit-code 10`. Exit code 10 is owned by this action (it cannot collide
 * with finfocus v0.4.0 codes: 0 = success, 1 = internal_error, 2 =
 * validation_error), so exit 10 unambiguously means "budget threshold
 * breached".
 *
 * Any other non-zero exit is a command failure, not a budget result: the
 * error envelope on stderr is surfaced as the failure message, and unknown
 * codes fail with the raw stderr.
 *
 * @param config - Action configuration
 * @returns BudgetThresholdResult with pass/fail status and severity
 */
export async function checkBudgetThresholdWithExitCodes(
  config: ActionConfiguration,
): Promise<BudgetThresholdResult> {
  try {
    const result = await exec.getExecOutput(
      'finfocus',
      [
        'cost',
        'projected',
        '--pulumi-json',
        config.pulumiPlanJsonPath,
        '--exit-on-threshold',
        '--exit-code',
        String(BudgetExitCode.THRESHOLD_BREACH),
      ],
      {
        ignoreReturnCode: true,
        silent: !config.debug,
      },
    );

    if (config.debug) {
      core.debug(`Budget threshold check exit code: ${result.exitCode}`);
      core.debug(`Budget threshold check stdout: ${result.stdout}`);
    }

    if (result.exitCode === BudgetExitCode.PASS) {
      return {
        passed: true,
        severity: 'none',
        exitCode: BudgetExitCode.PASS,
        message: BudgetThresholdMessages.PASS,
      };
    }

    if (result.exitCode === BudgetExitCode.THRESHOLD_BREACH) {
      return {
        passed: false,
        severity: 'exceeded',
        exitCode: BudgetExitCode.THRESHOLD_BREACH,
        message: BudgetThresholdMessages.EXCEEDED,
      };
    }

    // Not a budget result: the finfocus call itself failed. Surface the error
    // envelope message when present, otherwise the raw stderr.
    const envelope = parseErrorEnvelope(result.stderr);
    if (envelope) {
      throw new Error(formatEnvelopeError(envelope, result.exitCode));
    }
    throw new Error(
      `finfocus cost projected exited with code ${result.exitCode}: ` +
        (result.stderr.trim() || '(no stderr output)'),
    );
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.startsWith('finfocus cost projected exited') ||
        error.message.startsWith('finfocus '))
    ) {
      throw error;
    }
    throw new Error(
      `Failed to run budget threshold check: ${error instanceof Error ? error.message : String(error)}`,
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
  report: FinfocusReport,
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

  // Extract cost change, handling both v0.4.0 (legacy) and v0.4.1 formats
  let costChange = 0;
  if ('monthly_cost_change' in report.diff) {
    costChange = (report.diff as any).monthly_cost_change;
  } else if ('totalDelta' in report.diff) {
    costChange = (report.diff as any).totalDelta;
  }

  const failed = checkThreshold(config.threshold, costChange, currency);

  if (failed) {
    return {
      passed: false,
      severity: 'exceeded',
      message: `Cost increase of ${costChange} ${currency} exceeds threshold ${config.threshold}`,
    };
  }

  return {
    passed: true,
    severity: 'none',
    message: `Cost within budget threshold (${costChange} ${currency} < ${config.threshold})`,
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
  report: FinfocusReport,
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

/**
 * Determines whether a carbon threshold is exceeded.
 *
 * Accepts absolute thresholds (e.g., "10kg" or "10.5kgCO2e") or percent thresholds (e.g., "10%").
 *
 * @param threshold - Threshold string to evaluate; absolute values are interpreted in kilograms and percent values compare (diff / baseTotal) * 100.
 * @param diff - Change in carbon emissions (in kilograms).
 * @param baseTotal - Base total emissions (in kilograms) used for percent comparisons.
 * @returns `true` if the provided `diff` exceeds the parsed threshold, `false` otherwise. Malformed thresholds or percent checks with `baseTotal <= 0` return `false`.
 */
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
