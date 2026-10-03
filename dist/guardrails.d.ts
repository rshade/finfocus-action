import { BudgetThresholdResult, ActionConfiguration, FinfocusReport, BudgetHealthReport, ScopedBudgetReport } from './types.js';
/**
 * Human-readable messages for each budget threshold result.
 */
export declare const BudgetThresholdMessages: {
    readonly PASS: "Budget thresholds passed";
    readonly EXCEEDED: "Budget exceeded";
};
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
export declare function checkBudgetThresholdWithExitCodes(config: ActionConfiguration): Promise<BudgetThresholdResult>;
/**
 * Check budget threshold using JSON parsing (fallback for finfocus < v0.2.5).
 * Uses the existing checkThreshold() function to compare cost difference against threshold.
 *
 * @param config - Action configuration
 * @param report - Finfocus report with cost data
 * @returns BudgetThresholdResult with pass/fail status
 */
export declare function checkBudgetThresholdWithJson(config: ActionConfiguration, report: FinfocusReport): BudgetThresholdResult;
/**
 * Main budget threshold check orchestrator.
 * Detects finfocus version and uses exit codes (v0.2.5+) or JSON parsing (older versions).
 *
 * @param config - Action configuration
 * @param report - Finfocus report with cost data (used for JSON fallback)
 * @returns BudgetThresholdResult with pass/fail status and severity
 */
export declare function checkBudgetThreshold(config: ActionConfiguration, report: FinfocusReport): Promise<BudgetThresholdResult>;
export declare function checkThreshold(threshold: string | null, diff: number, currency: string): boolean;
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
export declare function checkCarbonThreshold(threshold: string | null, diff: number, baseTotal: number): boolean;
/**
 * Evaluate the configured budget-health threshold against a budget health report.
 *
 * @param config - Action configuration containing an optional `failOnBudgetHealth` threshold
 * @param budgetHealth - Budget health report providing `healthScore` and `healthStatus`
 * @returns A `BudgetThresholdResult` containing pass/fail outcome, `severity`, and an explanatory `message`
 */
export declare function checkBudgetHealthThreshold(config: ActionConfiguration, budgetHealth: BudgetHealthReport): BudgetThresholdResult;
/**
 * Check if any scoped budget has been breached.
 * A scope is considered breached if its percentUsed >= 100 and status is 'exceeded' or 'critical'.
 * Failed scopes are excluded from breach evaluation.
 *
 * @param report - Scoped budget report from finfocus CLI
 * @param failOnBreach - Whether to fail the action on breach
 * @returns BudgetThresholdResult with pass/fail status
 */
export declare function checkScopedBudgetBreach(report: ScopedBudgetReport | undefined, failOnBreach: boolean): BudgetThresholdResult;
