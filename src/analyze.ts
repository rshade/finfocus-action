import * as exec from '@actions/exec';
import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import {
  IAnalyzer,
  FinfocusReport,
  ActionConfiguration,
  RecommendationsReport,
  ActualCostReport,
  BudgetStatus,
} from './types.js';

export class Analyzer implements IAnalyzer {
  async runAnalysis(planPath: string, config?: ActionConfiguration): Promise<FinfocusReport> {
    const debug = config?.debug === true;
    if (debug) {
      core.info(`=== Analyzer: Running cost analysis ===`);
      core.info(`  Plan file path: ${planPath}`);
      core.info(`  Absolute path: ${path.resolve(planPath)}`);
    }

    if (!fs.existsSync(planPath)) {
      core.error(`  Plan file NOT FOUND: ${planPath}`);
      if (debug) {
        core.info(`  Current working directory: ${process.cwd()}`);
        core.info(`  Directory contents:`);
        const files = fs.readdirSync('.');
        for (const file of files) {
          try {
            const stat = fs.statSync(file);
            core.info(`    ${file} (${stat.isDirectory() ? 'directory' : stat.size + ' bytes'})`);
          } catch {
            core.info(`    ${file} (stat failed)`);
          }
        }
      }
      throw new Error(
        `Pulumi plan file not found: ${planPath}. ` +
          `Make sure to run 'pulumi preview --json > ${planPath}' first.`,
      );
    }

    const planStats = fs.statSync(planPath);
    if (debug) {
      core.info(`  Plan file size: ${planStats.size} bytes`);
      core.info(`  Plan file modified: ${planStats.mtime.toISOString()}`);
    }

    if (planStats.size === 0) {
      core.error(`  Plan file is EMPTY`);
      throw new Error(`Pulumi plan file is empty: ${planPath}`);
    }

    const planContent = fs.readFileSync(planPath, 'utf8');
    if (debug) {
      core.info(`  Plan file content length: ${planContent.length} chars`);

      if (planContent.length < 5000) {
        core.info(`  Plan file content:\n${planContent}`);
      } else {
        core.info(`  Plan file first 2000 chars:\n${planContent.substring(0, 2000)}`);
        core.info(`  ... (truncated, total ${planContent.length} chars)`);
      }
    }

    try {
      JSON.parse(planContent);
      if (debug) core.info(`  Plan file is valid JSON`);
    } catch (parseErr) {
      core.error(`  Plan file is NOT valid JSON`);
      core.error(
        `  JSON parse error: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
      );
      throw new Error(
        `Pulumi plan file is not valid JSON: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
      );
    }

    const args = ['cost', 'projected', '--pulumi-json', planPath, '--output', 'json'];

    // Add utilization flag if provided and different from default
    if (config?.utilizationRate && config.utilizationRate !== '1.0') {
      args.push('--utilization', config.utilizationRate);
    }

    if (debug) {
      core.info(`=== Running finfocus command ===`);
      core.info(`  Command: finfocus ${args.join(' ')}`);
    }

    const analysisStart = Date.now();
    const output = await exec.getExecOutput('finfocus', args, {
      silent: !debug,
      ignoreReturnCode: true,
    });

    if (debug) {
      core.info(`  Execution took: ${Date.now() - analysisStart}ms`);
      core.info(`  Exit code: ${output.exitCode}`);
      core.info(`  Stdout length: ${output.stdout.length} chars`);
      core.info(`  Stderr length: ${output.stderr.length} chars`);

      if (output.stdout) {
        if (output.stdout.length < 5000) {
          core.info(`  Stdout:\n${output.stdout}`);
        } else {
          core.info(`  Stdout (first 2000 chars):\n${output.stdout.substring(0, 2000)}`);
          core.info(`  ... (truncated, total ${output.stdout.length} chars)`);
        }
      }

      if (output.stderr) {
        core.info(`  Stderr:\n${output.stderr}`);
      }
    }

    if (output.exitCode !== 0) {
      core.error(`  finfocus command FAILED with exit code ${output.exitCode}`);
      throw new Error(
        `finfocus analysis failed with exit code ${output.exitCode}.\n` +
          `Stderr: ${output.stderr}\n` +
          `Stdout: ${output.stdout}`,
      );
    }

    if (debug) core.info(`=== Parsing analysis output ===`);
    try {
      const report = JSON.parse(output.stdout) as FinfocusReport;
      if (debug) {
        core.info(`  Parsed successfully`);
        core.info(`  Report fields: ${Object.keys(report).join(', ')}`);
        core.info(`  projected_monthly_cost: ${report.projected_monthly_cost}`);
        core.info(`  currency: ${report.currency}`);
        if (report.diff) {
          core.info(`  diff.monthly_cost_change: ${report.diff.monthly_cost_change}`);
        }
      }
      return report;
    } catch (err) {
      core.error(`  Failed to parse finfocus output as JSON`);
      core.error(`  Parse error: ${err instanceof Error ? err.message : String(err)}`);
      core.error(`  Raw output (first 1000 chars): ${output.stdout.substring(0, 1000)}`);
      throw new Error(
        `Failed to parse finfocus JSON output.\n` +
          `Error: ${err instanceof Error ? err.message : String(err)}\n` +
          `Raw output: ${output.stdout.substring(0, 500)}...`,
      );
    }
  }

  calculateSustainabilityMetrics(report: FinfocusReport): {
    totalCO2e: number;
    totalCO2eDiff: number;
    carbonIntensity: number;
  } {
    let totalCO2e = 0;
    
    // Sum up carbon footprint from all resources
    if (report.resources) {
      for (const resource of report.resources) {
        if (resource.sustainability?.carbon_footprint?.value) {
          totalCO2e += resource.sustainability.carbon_footprint.value;
        }
      }
    } else if (report.summary?.resources) {
      for (const resource of report.summary.resources) {
        if (resource.sustainability?.carbon_footprint?.value) {
          totalCO2e += resource.sustainability.carbon_footprint.value;
        }
      }
    }

    // Since finfocus currently might not provide total diff for sustainability, 
    // we default to 0 for now unless we can calculate it from base state.
    // For V1 MVP, we will assume 0 or absolute value if base isn't available.
    // However, if we want to support diff, we'd need the base report which we don't have here.
    // We will just return the absolute total for now.
    const totalCO2eDiff = 0;

    const totalCost = report.summary?.totalMonthly ?? report.projected_monthly_cost ?? 0;
    const carbonIntensity = totalCost > 0 ? (totalCO2e * 1000) / totalCost : 0; // gCO2e/USD

    return {
      totalCO2e,
      totalCO2eDiff,
      carbonIntensity,
    };
  }

  async runRecommendations(
    planPath: string,
    config?: ActionConfiguration,
  ): Promise<RecommendationsReport> {
    const debug = config?.debug === true;

    if (!fs.existsSync(planPath)) {
      throw new Error(`Pulumi plan file not found: ${planPath}`);
    }

    const planStats = fs.statSync(planPath);
    if (planStats.size === 0) {
      throw new Error(`Pulumi plan file is empty: ${planPath}`);
    }

    const planContent = fs.readFileSync(planPath, 'utf8');
    try {
      JSON.parse(planContent);
    } catch (parseErr) {
      throw new Error(
        `Pulumi plan file is not valid JSON: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
      );
    }

    const args = ['cost', 'recommendations', '--pulumi-json', planPath, '--output', 'json'];
    if (debug) {
      core.info(`=== Running finfocus recommendations command ===`);
      core.info(`  Command: finfocus ${args.join(' ')}`);
    }

    const output = await exec.getExecOutput('finfocus', args, {
      silent: !debug,
      ignoreReturnCode: true,
    });

    if (output.exitCode !== 0) {
      core.warning(
        `finfocus recommendations failed with exit code ${output.exitCode}: ${output.stderr}`,
      );
      // Return empty recommendations instead of failing
      return {
        summary: {
          total_count: 0,
          total_savings: 0,
          currency: 'USD',
          count_by_action_type: {},
        },
        recommendations: [],
      };
    }

    try {
      const report = JSON.parse(output.stdout) as RecommendationsReport;
      if (debug) {
        core.info(`  Parsed recommendations successfully`);
        core.info(`  Total recommendations: ${report.summary.total_count}`);
      }
      return report;
    } catch (err) {
      core.warning(
        `Failed to parse finfocus recommendations output: ${err instanceof Error ? err.message : String(err)}`,
      );
      // Return empty recommendations
      return {
        summary: {
          total_count: 0,
          total_savings: 0,
          currency: 'USD',
          count_by_action_type: {},
        },
        recommendations: [],
      };
    }
  }

  async runActualCosts(config: ActionConfiguration): Promise<ActualCostReport> {
    const debug = config?.debug === true;
    if (debug) {
      core.info(`=== Analyzer: Running actual costs ===`);
    }

    // Validate group-by parameter
    const validGroupByOptions = ['resource', 'type', 'provider', 'service', 'region', 'tag'];
    if (config.actualCostsGroupBy && !validGroupByOptions.includes(config.actualCostsGroupBy)) {
      throw new Error(
        `Invalid actual-costs-group-by value: "${config.actualCostsGroupBy}". Supported: ${validGroupByOptions.join(', ')}`,
      );
    }

    const args = ['cost', 'actual', '--output', 'json'];

    // Handle input file selection for cost estimation
    // Priority: state file (if exists) > plan file (if exists)
    // State files provide actual resource creation timestamps for cost estimation
    // when billing APIs are not available
    if (config.pulumiStateJsonPath) {
      if (fs.existsSync(config.pulumiStateJsonPath)) {
        args.push('--pulumi-state', config.pulumiStateJsonPath);
      } else if (config.pulumiPlanJsonPath && fs.existsSync(config.pulumiPlanJsonPath)) {
        // Fall back to plan file if state file doesn't exist but plan does
        args.push('--pulumi-json', config.pulumiPlanJsonPath);
      } else {
        throw new Error(`Pulumi state file not found: ${config.pulumiStateJsonPath}`);
      }
    } else if (config.pulumiPlanJsonPath) {
      if (fs.existsSync(config.pulumiPlanJsonPath)) {
        args.push('--pulumi-json', config.pulumiPlanJsonPath);
      } else {
        throw new Error(`Pulumi plan file not found: ${config.pulumiPlanJsonPath}`);
      }
    }

    const { from, to } = this.getDateRange(config.actualCostsPeriod);
    args.push('--from', from);
    args.push('--to', to);

    if (config.actualCostsGroupBy) {
      args.push('--group-by', config.actualCostsGroupBy);
    }

    if (debug) {
      core.info(`  Command: finfocus ${args.join(' ')}`);
    }

    const output = await exec.getExecOutput('finfocus', args, {
      silent: !debug,
      ignoreReturnCode: true,
    });

    if (output.exitCode !== 0) {
      core.warning(
        `finfocus cost actual failed with exit code ${output.exitCode}: ${output.stderr}`,
      );
      return {
        total: 0,
        currency: 'USD',
        startDate: from,
        endDate: to,
        items: [],
      };
    }

    try {
      const raw = JSON.parse(output.stdout);
      if (debug) {
        core.info(`  Parsed actual costs successfully`);
      }

      // Map raw output to ActualCostReport
      const total = raw.total ?? raw.summary?.total ?? raw.totalCost ?? 0;
      const currency = raw.currency ?? raw.summary?.currency ?? 'USD';
      const items = (raw.items ?? raw.resources ?? []).map((item: any) => ({
        name: item.name ?? item.resourceId ?? item.provider ?? 'Unknown',
        cost: item.cost ?? item.total ?? item.monthly ?? 0,
        currency: item.currency ?? currency,
      }));

      return {
        total,
        currency,
        startDate: from,
        endDate: to,
        items,
      };
    } catch (err) {
      core.warning(
        `Failed to parse actual cost output: ${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        total: 0,
        currency: 'USD',
        startDate: from,
        endDate: to,
        items: [],
      };
    }
  }

  private getDateRange(period: string): { from: string; to: string } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const to = today.toISOString().split('T')[0];

    // Validate period format
    if (!this.isValidPeriodFormat(period)) {
      throw new Error(
        `Invalid actual-costs-period format: "${period}". Supported: 7d, 30d, mtd, or YYYY-MM-DD`,
      );
    }

    let fromDate: Date;

    if (period === '7d') {
      fromDate = new Date(today);
      fromDate.setDate(today.getDate() - 7);
    } else if (period === '30d') {
      fromDate = new Date(today);
      fromDate.setDate(today.getDate() - 30);
    } else if (period === 'mtd') {
      fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
    } else {
      // Custom YYYY-MM-DD date
      fromDate = this.parseAndValidateCustomDate(period);
      if (fromDate > today) {
        throw new Error(`Custom date cannot be in the future: ${period}`);
      }
    }

    const from = fromDate.toISOString().split('T')[0];
    return { from, to };
  }

  private isValidPeriodFormat(period: string): boolean {
    if (['7d', '30d', 'mtd'].includes(period)) {
      return true;
    }

    // Check YYYY-MM-DD format
    const dateMatch = period.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dateMatch) return false;

    // Validate it's a real date
    const [, year, month, day] = dateMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return (
      date.getFullYear() === parseInt(year) &&
      date.getMonth() === parseInt(month) - 1 &&
      date.getDate() === parseInt(day)
    );
  }

  private parseAndValidateCustomDate(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    // Additional validation
    if (year < 2020) {
      throw new Error(`Custom date too far in the past: ${dateStr}. Minimum year: 2020`);
    }

    return date;
  }

  async setupAnalyzerMode(config?: ActionConfiguration): Promise<void> {
    const debug = config?.debug === true;
    if (debug) core.info(`=== Analyzer: Setting up analyzer mode ===`);
    else core.info(`Setting up finfocus analyzer mode...`);

    // 1. Get finfocus version for metadata
    let version = '0.0.0-dev';
    try {
      const versionOutput = await exec.getExecOutput('finfocus', ['--version'], {
        silent: true,
        ignoreReturnCode: true,
      });
      version = versionOutput.stdout.trim().match(/v?[\d.]+/)?.[0] || version;
    } catch (e) {
      core.debug(`Failed to get version: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (debug) core.info(`  Using version: ${version}`);

    // 2. Define Policy Pack Directory
    const policyPackDir = path.join(os.homedir(), '.finfocus', 'analyzer');
    if (debug) core.info(`  Policy Pack directory: ${policyPackDir}`);

    if (!fs.existsSync(policyPackDir)) {
      if (debug) core.info(`  Creating policy pack directory...`);
      fs.mkdirSync(policyPackDir, { recursive: true });
    }

    // 3. Create PulumiPolicy.yaml
    const policyYamlPath = path.join(policyPackDir, 'PulumiPolicy.yaml');
    if (debug) core.info(`  Writing PulumiPolicy.yaml to: ${policyYamlPath}`);
    // The runtime 'finfocus' tells Pulumi to look for 'pulumi-analyzer-policy-finfocus'
    const policyYamlContent = `runtime: finfocus\nname: finfocus\nversion: ${version}\n`;
    fs.writeFileSync(policyYamlPath, policyYamlContent);

    // 4. Locate and Copy Binary
    const finfocusBinary = await this.findBinary('finfocus', debug);
    if (debug) core.info(`  Source binary: ${finfocusBinary}`);

    // The binary MUST be named 'pulumi-analyzer-policy-finfocus' for the 'finfocus' runtime
    const policyBinaryPath = path.join(policyPackDir, 'pulumi-analyzer-policy-finfocus');

    if (debug) core.info(`  Installing policy binary to: ${policyBinaryPath}`);
    fs.copyFileSync(finfocusBinary, policyBinaryPath);
    fs.chmodSync(policyBinaryPath, 0o755);

    // 5. Configure Environment
    // - Add to PATH so Pulumi can find the binary named 'pulumi-analyzer-policy-finfocus'
    if (debug) {
      core.info(`  Adding ${policyPackDir} to PATH`);
      core.addPath(policyPackDir);
    } else {
      core.addPath(policyPackDir);
    }

    // - Export environment variables to trigger automatic loading in subsequent steps
    // PULUMI_POLICY_PACK is the environment variable equivalent of the --policy-pack flag
    if (debug) {
      core.info(`  Exporting PULUMI_POLICY_PACK=${policyPackDir}`);
      core.exportVariable('PULUMI_POLICY_PACK', policyPackDir);
      core.exportVariable('PULUMI_POLICY_PACKS', policyPackDir);
      core.exportVariable('PULUMI_POLICY_PACK_PATH', policyPackDir);
    } else {
      core.exportVariable('PULUMI_POLICY_PACK', policyPackDir);
      core.exportVariable('PULUMI_POLICY_PACKS', policyPackDir);
      core.exportVariable('PULUMI_POLICY_PACK_PATH', policyPackDir);
    }

    // - Export log level if provided
    if (config?.logLevel) {
      if (debug) core.info(`  Exporting FINFOCUS_LOG_LEVEL=${config.logLevel}`);
      core.exportVariable('FINFOCUS_LOG_LEVEL', config.logLevel);
    }

    // Set output for use in subsequent steps
    core.setOutput('policy-pack-path', policyPackDir);

    if (debug) core.info(`  Analyzer (Policy Pack) setup complete.`);
  }

  calculateBudgetStatus(
    config: ActionConfiguration,
    report: FinfocusReport,
  ): BudgetStatus | undefined {
    // Return undefined if budget is not configured
    if (!config.budgetAmount || config.budgetAmount <= 0) {
      return undefined;
    }

    const debug = config?.debug === true;
    if (debug) {
      core.info('=== Calculating budget status ===');
    }

    // Extract projected monthly cost from report
    const projectedCost = report.summary?.totalMonthly ?? report.projected_monthly_cost ?? 0;
    const currency = config.budgetCurrency || 'USD';
    const period = config.budgetPeriod || 'monthly';
    const amount = config.budgetAmount;

    if (debug) {
      core.info(`  Budget amount: ${amount} ${currency}/${period}`);
      core.info(`  Projected cost: ${projectedCost} ${currency}`);
    }

    // Calculate spent, remaining, and percentage
    const spent = projectedCost;
    const remaining = amount - spent;
    const percentUsed = amount > 0 ? (spent / amount) * 100 : 0;

    if (debug) {
      core.info(`  Spent: ${spent.toFixed(2)} ${currency}`);
      core.info(`  Remaining: ${remaining.toFixed(2)} ${currency}`);
      core.info(`  Percent used: ${percentUsed.toFixed(1)}%`);
    }

    // Parse and evaluate alerts
    const alertsConfig = this.parseAlerts(config.budgetAlerts);
    const alerts = alertsConfig.map((alert) => {
      const triggered = percentUsed >= alert.threshold;
      if (debug && triggered) {
        core.info(`  Alert triggered: ${alert.threshold}% (${alert.type})`);
      }
      return {
        threshold: alert.threshold,
        type: alert.type,
        triggered,
      };
    });

    return {
      configured: true,
      amount,
      currency,
      period,
      spent,
      remaining,
      percentUsed,
      alerts: alerts.length > 0 ? alerts : undefined,
    };
  }

  private parseAlerts(alertsInput?: string): Array<{ threshold: number; type: string }> {
    // Default alerts if none provided
    const defaultAlerts = [
      { threshold: 80, type: 'actual' },
      { threshold: 100, type: 'forecasted' },
    ];

    if (!alertsInput || alertsInput.trim() === '') {
      return defaultAlerts;
    }

    try {
      const parsed = JSON.parse(alertsInput) as Array<{ threshold: number; type: string }>;

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

  extractBudgetStatus(stdout: string): BudgetStatus | undefined {
    if (!stdout) {
      return undefined;
    }

    try {
      // Look for budget-related patterns in the output
      // Example patterns:
      // Budget: $1,000.00 USD/monthly
      // Current Spend: $850.00 USD (85.0%)
      // Remaining: $150.00 USD

      const budgetMatch = stdout.match(/Budget:\s*\$?([\d,]+\.?\d*)\s*(\w+)?\/?(\w+)?/i);
      const spendMatch = stdout.match(/(?:Current\s+)?Spend(?:ing)?:\s*\$?([\d,]+\.?\d*)\s*(\w+)?\s*\(?([\d.]+)%?\)?/i);
      const remainingMatch = stdout.match(/Remaining:\s*\$?([\d,]+\.?\d*)\s*(\w+)?/i);

      if (!budgetMatch) {
        // No budget information found in output
        return undefined;
      }

      const amount = parseFloat(budgetMatch[1].replace(/,/g, ''));
      if (!Number.isFinite(amount)) {
        return undefined;
      }

      const currency = budgetMatch[2] || 'USD';
      const period = budgetMatch[3] || 'monthly';

      let spent: number | undefined;
      let percentUsed: number | undefined;

      if (spendMatch) {
        const parsedSpent = parseFloat(spendMatch[1].replace(/,/g, ''));
        spent = Number.isFinite(parsedSpent) ? parsedSpent : undefined;

        if (spendMatch[3]) {
          const parsedPercent = parseFloat(spendMatch[3]);
          percentUsed = Number.isFinite(parsedPercent) ? parsedPercent : undefined;
        }
      }

      let remaining: number | undefined;
      if (remainingMatch) {
        const parsedRemaining = parseFloat(remainingMatch[1].replace(/,/g, ''));
        remaining = Number.isFinite(parsedRemaining) ? parsedRemaining : undefined;
      } else if (spent !== undefined) {
        remaining = amount - spent;
      }

      // Calculate percentUsed if we have spent and amount but no explicit percentage
      if (percentUsed === undefined && spent !== undefined && amount > 0) {
        const calculatedPercent = (spent / amount) * 100;
        percentUsed = Number.isFinite(calculatedPercent) ? calculatedPercent : undefined;
      }

      // Parse alerts if present
      const alerts: Array<{ threshold: number; type: string; triggered: boolean }> = [];
      const alertMatches = stdout.matchAll(/Alert:\s*(\d+)%\s*\((\w+)\)\s*-\s*(triggered|not\s+triggered)/gi);

      for (const alertMatch of alertMatches) {
        alerts.push({
          threshold: parseInt(alertMatch[1]),
          type: alertMatch[2].toLowerCase(),
          triggered: alertMatch[3].toLowerCase().includes('triggered') && !alertMatch[3].toLowerCase().includes('not'),
        });
      }

      return {
        configured: true,
        amount,
        currency,
        period,
        spent,
        remaining,
        percentUsed,
        alerts: alerts.length > 0 ? alerts : undefined,
      };
    } catch (err) {
      core.debug(
        `Failed to parse budget status from output: ${err instanceof Error ? err.message : String(err)}`,
      );
      return undefined;
    }
  }

  private async findBinary(name: string, debug: boolean): Promise<string> {
    if (debug) core.info(`  Finding binary: ${name}`);
    const output = await exec.getExecOutput('which', [name], {
      silent: !debug,
      ignoreReturnCode: true,
    });
    if (debug) {
      core.info(`  which exit code: ${output.exitCode}`);
      core.info(`  which output: ${output.stdout.trim()}`);
    }

    if (output.exitCode !== 0) {
      core.error(`  Binary not found in PATH`);
      throw new Error(`Could not find ${name} binary in PATH`);
    }
    return output.stdout.trim();
  }
}
