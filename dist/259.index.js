export const id = 259;
export const ids = [259];
export const modules = {

/***/ 6259:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {


// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  checkBudgetHealthThreshold: () => (/* binding */ checkBudgetHealthThreshold),
  checkBudgetThreshold: () => (/* binding */ checkBudgetThreshold),
  checkCarbonThreshold: () => (/* binding */ checkCarbonThreshold),
  checkScopedBudgetBreach: () => (/* binding */ checkScopedBudgetBreach)
});

// UNUSED EXPORTS: BudgetThresholdMessages, checkBudgetThresholdWithExitCodes, checkBudgetThresholdWithJson, checkThreshold

// EXTERNAL MODULE: ./node_modules/@actions/core/lib/core.js + 10 modules
var core = __webpack_require__(2398);
// EXTERNAL MODULE: ./node_modules/@actions/exec/lib/exec.js + 2 modules
var exec = __webpack_require__(5260);
;// CONCATENATED MODULE: ./src/types.ts
/**
 * Exit codes returned by finfocus CLI for budget threshold checks.
 * Only applicable for finfocus v0.2.5 and above.
 */
var BudgetExitCode;
(function (BudgetExitCode) {
    /** All thresholds passed */
    BudgetExitCode[BudgetExitCode["PASS"] = 0] = "PASS";
    /** Warning threshold breached */
    BudgetExitCode[BudgetExitCode["WARNING"] = 1] = "WARNING";
    /** Critical threshold breached */
    BudgetExitCode[BudgetExitCode["CRITICAL"] = 2] = "CRITICAL";
    /** Budget exceeded */
    BudgetExitCode[BudgetExitCode["EXCEEDED"] = 3] = "EXCEEDED";
})(BudgetExitCode || (BudgetExitCode = {}));

// EXTERNAL MODULE: ./src/install.ts + 6 modules
var install = __webpack_require__(8638);
;// CONCATENATED MODULE: ./src/guardrails.ts




/**
 * Human-readable messages for each budget threshold result.
 */
const BudgetThresholdMessages = {
    PASS: 'Budget thresholds passed',
    WARNING: 'Warning: Approaching budget threshold',
    CRITICAL: 'Critical: Budget threshold breached',
    EXCEEDED: 'Budget exceeded',
};
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
async function checkBudgetThresholdWithExitCodes(config) {
    try {
        const result = await exec/* getExecOutput */.H('finfocus', ['cost', 'projected', config.pulumiPlanJsonPath], {
            ignoreReturnCode: true,
            silent: !config.debug,
        });
        if (config.debug) {
            core/* debug */.Yz(`Budget threshold check exit code: ${result.exitCode}`);
            core/* debug */.Yz(`Budget threshold check stdout: ${result.stdout}`);
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
    }
    catch (error) {
        if (error instanceof Error && error.message.startsWith('Unexpected finfocus exit code')) {
            throw error;
        }
        throw new Error(`Failed to run budget threshold check: ${error instanceof Error ? error.message : String(error)}`);
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
function checkBudgetThresholdWithJson(config, report) {
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
async function checkBudgetThreshold(config, report) {
    const version = await (0,install/* getFinfocusVersion */.g5)();
    // Handle version detection failure (getFinfocusVersion returns '0.0.0' on failure)
    if (version === '0.0.0') {
        core/* warning */.$e('Could not detect finfocus version, falling back to JSON parsing');
        return checkBudgetThresholdWithJson(config, report);
    }
    if (config.debug) {
        core/* debug */.Yz(`Detected finfocus version: ${version}`);
    }
    const useExitCodes = (0,install/* supportsExitCodes */.X7)(version);
    if (config.debug) {
        core/* debug */.Yz(`Using exit codes: ${useExitCodes}`);
    }
    if (useExitCodes) {
        return checkBudgetThresholdWithExitCodes(config);
    }
    core/* warning */.$e('finfocus version < 0.2.5, falling back to JSON parsing for threshold check');
    return checkBudgetThresholdWithJson(config, report);
}
function checkThreshold(threshold, diff, currency) {
    if (!threshold)
        return false;
    const regex = /^(\d+(\.\d{1,2})?)([A-Z]{3})$/;
    const match = threshold.match(regex);
    if (!match) {
        core/* warning */.$e(`Malformed threshold input: "${threshold}". Expected format like "100USD". Skipping guardrail.`);
        return false;
    }
    const limitValue = parseFloat(match[1]);
    const limitCurrency = match[3];
    if (limitCurrency !== currency) {
        core/* warning */.$e(`Currency mismatch in threshold. Threshold: ${limitCurrency}, Report: ${currency}. Skipping guardrail.`);
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
function checkCarbonThreshold(threshold, diff, baseTotal) {
    if (!threshold)
        return false;
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
        if (baseTotal <= 0)
            return false; // Avoid division by zero or nonsensical checks
        const currentPct = (diff / baseTotal) * 100;
        return currentPct > limitPct;
    }
    core/* warning */.$e(`Malformed carbon threshold input: "${threshold}". Expected format like "10kg" or "10%". Skipping guardrail.`);
    return false;
}
/**
 * Evaluate the configured budget-health threshold against a budget health report.
 *
 * @param config - Action configuration containing an optional `failOnBudgetHealth` threshold
 * @param budgetHealth - Budget health report providing `healthScore` and `healthStatus`
 * @returns A `BudgetThresholdResult` containing pass/fail outcome, `severity`, and an explanatory `message`
 */
function checkBudgetHealthThreshold(config, budgetHealth) {
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
        core/* warning */.$e('Budget health score not available, cannot evaluate threshold');
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
/**
 * Check if any scoped budget has been breached.
 * A scope is considered breached if its percentUsed >= 100 and status is 'exceeded' or 'critical'.
 * Failed scopes are excluded from breach evaluation.
 *
 * @param report - Scoped budget report from finfocus CLI
 * @param failOnBreach - Whether to fail the action on breach
 * @returns BudgetThresholdResult with pass/fail status
 */
function checkScopedBudgetBreach(report, failOnBreach) {
    // If no report or breach check disabled, pass
    if (!report || !failOnBreach) {
        return {
            passed: true,
            severity: 'none',
            message: failOnBreach ? 'No scoped budget data available' : 'Scoped budget breach check disabled',
        };
    }
    // Find breached scopes (percentUsed >= 100)
    const breachedScopes = report.scopes.filter((s) => s.percentUsed >= 100 || s.status === 'exceeded' || s.status === 'critical');
    if (breachedScopes.length === 0) {
        return {
            passed: true,
            severity: 'none',
            message: `All ${report.scopes.length} scoped budgets within limits`,
        };
    }
    // Determine severity from worst breach
    const hasExceeded = breachedScopes.some((s) => s.status === 'exceeded');
    const hasCritical = breachedScopes.some((s) => s.status === 'critical');
    const severity = hasExceeded ? 'exceeded' : hasCritical ? 'critical' : 'warning';
    const scopeNames = breachedScopes.map((s) => s.scope).join(', ');
    return {
        passed: false,
        severity,
        message: `Budget exceeded for scopes: ${scopeNames}`,
    };
}


/***/ })

};

//# sourceMappingURL=259.index.js.map