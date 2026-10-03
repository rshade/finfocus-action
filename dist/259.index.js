export const id = 259;
export const ids = [259];
export const modules = {

/***/ 6259:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {


// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  checkBudgetThreshold: () => (/* binding */ checkBudgetThreshold),
  checkCarbonThreshold: () => (/* binding */ checkCarbonThreshold)
});

// UNUSED EXPORTS: BudgetThresholdMessages, checkBudgetThresholdWithExitCodes, checkBudgetThresholdWithJson, checkThreshold

// EXTERNAL MODULE: ./node_modules/@actions/core/lib/core.js + 10 modules
var core = __webpack_require__(2398);
// EXTERNAL MODULE: ./node_modules/@actions/exec/lib/exec.js + 2 modules
var exec = __webpack_require__(5260);
;// CONCATENATED MODULE: ./src/types.ts
/**
 * Exit codes the action uses when checking budget thresholds.
 *
 * finfocus v0.4.0 reserves 0 (success), 1 (internal_error) and 2
 * (validation_error). The action passes `--exit-code 10` with
 * `--exit-on-threshold`, so THRESHOLD_BREACH is owned by the action and cannot
 * be confused with a finfocus error exit.
 */
var BudgetExitCode;
(function (BudgetExitCode) {
    /** All thresholds passed */
    BudgetExitCode[BudgetExitCode["PASS"] = 0] = "PASS";
    /** Budget threshold breached (action-owned code passed via --exit-code) */
    BudgetExitCode[BudgetExitCode["THRESHOLD_BREACH"] = 10] = "THRESHOLD_BREACH";
})(BudgetExitCode || (BudgetExitCode = {}));

// EXTERNAL MODULE: ./src/install.ts + 6 modules
var install = __webpack_require__(8638);
// EXTERNAL MODULE: ./src/errors.ts
var errors = __webpack_require__(3916);
;// CONCATENATED MODULE: ./src/guardrails.ts





/**
 * Human-readable messages for each budget threshold result.
 */
const BudgetThresholdMessages = {
    PASS: 'Budget thresholds passed',
    EXCEEDED: 'Budget exceeded',
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
async function checkBudgetThresholdWithExitCodes(config) {
    try {
        const result = await exec/* getExecOutput */.H('finfocus', [
            'cost',
            'projected',
            '--pulumi-json',
            config.pulumiPlanJsonPath,
            '--exit-on-threshold',
            '--exit-code',
            String(BudgetExitCode.THRESHOLD_BREACH),
        ], {
            ignoreReturnCode: true,
            silent: !config.debug,
        });
        if (config.debug) {
            core/* debug */.Yz(`Budget threshold check exit code: ${result.exitCode}`);
            core/* debug */.Yz(`Budget threshold check stdout: ${result.stdout}`);
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
        const envelope = (0,errors/* parseErrorEnvelope */.a)(result.stderr);
        if (envelope) {
            throw new Error((0,errors/* formatEnvelopeError */.u)(envelope, result.exitCode));
        }
        throw new Error(`finfocus cost projected exited with code ${result.exitCode}: ` +
            (result.stderr.trim() || '(no stderr output)'));
    }
    catch (error) {
        if (error instanceof Error &&
            (error.message.startsWith('finfocus cost projected exited') ||
                error.message.startsWith('finfocus '))) {
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


/***/ })

};

//# sourceMappingURL=259.index.js.map