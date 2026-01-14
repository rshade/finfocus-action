import * as core from '@actions/core';
import * as fs from 'fs';
import { ActionConfiguration, RecommendationsReport, ActualCostReport } from './types.js';
import { Installer } from './install.js';
import { PluginManager } from './plugins.js';
import { Analyzer } from './analyze.js';
import { Commenter } from './comment.js';

function parseBoolean(value: string, defaultValue: boolean): boolean {
  if (!value || value.trim() === '') return defaultValue;
  const normalized = value.toLowerCase().trim();
  return normalized === 'true' || normalized === 'yes' || normalized === '1';
}

function logEnvironment(): void {
  core.info('=== Environment Diagnostics ===');
  core.info(`Node version: ${process.version}`);
  core.info(`Platform: ${process.platform}`);
  core.info(`Architecture: ${process.arch}`);
  core.info(`CWD: ${process.cwd()}`);
  core.info(`HOME: ${process.env.HOME || process.env.USERPROFILE || 'unknown'}`);
  core.info(`PATH: ${process.env.PATH?.split(':').slice(0, 5).join(':') || 'unknown'}...`);

  const relevantEnvVars = Object.keys(process.env)
    .filter((k) => k.startsWith('INPUT_') || k.startsWith('GITHUB_') || k.startsWith('RUNNER_'))
    .sort();

  core.info('=== Relevant Environment Variables ===');
  for (const key of relevantEnvVars) {
    const value = process.env[key];
    if (key.includes('TOKEN') || key.includes('SECRET')) {
      core.info(`  ${key}: [REDACTED]`);
    } else {
      core.info(`  ${key}: ${value}`);
    }
  }
}

function logInputs(): void {
  core.info('=== Action Inputs (raw) ===');
  const inputs = [
    'pulumi_plan_json',
    'github_token',
    'pulumicost_version',
    'install_plugins',
    'behavior_on_error',
    'post_comment',
    'fail_on_cost_increase',
    'analyzer_mode',
    'detailed_comment',
    'include_recommendations',
    'debug',
    'include_actual_costs',
    'actual_costs_period',
    'pulumi_state_json',
    'actual_costs_group_by',
  ];

  for (const input of inputs) {
    const value = core.getInput(input);
    if (input === 'github_token') {
      core.info(`  ${input}: ${value ? '[PROVIDED]' : '[EMPTY]'}`);
    } else {
      core.info(`  ${input}: "${value}"`);
    }
  }
}

function logAnalyzerOutput(): void {
  const logPath = '/tmp/pulumicost-analyzer.log';
  if (fs.existsSync(logPath)) {
    core.startGroup('🔍 Pulumicost Analyzer Logs');
    try {
      const logs = fs.readFileSync(logPath, 'utf8');
      core.info(logs);
    } catch (err) {
      core.info(`Failed to read analyzer logs: ${err}`);
    }
    core.endGroup();
  }
}

async function run(): Promise<void> {
  const startTime = Date.now();
  let config: ActionConfiguration | undefined;

  try {
    core.info('🚀 Starting finfocus-action');

    // Parse config first to know if we are in debug mode
    const pulumiPlanJsonPath = core.getInput('pulumi_plan_json') || 'plan.json';
    const githubToken = core.getInput('github_token');
    const pulumicostVersion = core.getInput('pulumicost_version') || 'latest';
    const installPluginsRaw = core.getInput('install_plugins') || '';
    const installPlugins = installPluginsRaw
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    const behaviorOnErrorRaw = core.getInput('behavior_on_error');
    const behaviorOnError = (behaviorOnErrorRaw as 'fail' | 'warn' | 'silent') || 'fail';
    const postCommentRaw = core.getInput('post_comment');
    const postComment = parseBoolean(postCommentRaw, true);
    const thresholdRaw = core.getInput('fail_on_cost_increase');
    const threshold = thresholdRaw || null;
    const analyzerModeRaw = core.getInput('analyzer_mode');
    const analyzerMode = parseBoolean(analyzerModeRaw, false);
    const detailedCommentRaw = core.getInput('detailed_comment');
    const detailedComment = parseBoolean(detailedCommentRaw, false);
    const includeRecommendationsRaw = core.getInput('include_recommendations');
    const includeRecommendations = parseBoolean(includeRecommendationsRaw, false);
    const logLevel = core.getInput('log_level') || 'error';
    const debugRaw = core.getInput('debug');
    const debug = parseBoolean(debugRaw, false);

    const includeActualCostsRaw = core.getInput('include_actual_costs');
    const includeActualCosts = parseBoolean(includeActualCostsRaw, false);
    const actualCostsPeriod = core.getInput('actual_costs_period') || '7d';
    const pulumiStateJsonPath = core.getInput('pulumi_state_json') || '';
    const actualCostsGroupBy = core.getInput('actual_costs_group_by') || 'provider';

    const includeSustainabilityRaw = core.getInput('include_sustainability');
    const includeSustainability = parseBoolean(includeSustainabilityRaw, false);
    const utilizationRate = core.getInput('utilization_rate') || '1.0';
    const sustainabilityEquivalentsRaw = core.getInput('sustainability_equivalents');
    const sustainabilityEquivalents = parseBoolean(sustainabilityEquivalentsRaw, true);
    const failOnCarbonIncreaseRaw = core.getInput('fail_on_carbon_increase');
    const failOnCarbonIncrease = failOnCarbonIncreaseRaw || null;

    config = {
      pulumiPlanJsonPath,
      githubToken,
      pulumicostVersion,
      installPlugins,
      behaviorOnError,
      postComment,
      threshold,
      analyzerMode,
      detailedComment,
      includeRecommendations,
      logLevel,
      debug,
      includeActualCosts,
      actualCostsPeriod,
      pulumiStateJsonPath,
      actualCostsGroupBy,
      includeSustainability,
      utilizationRate,
      sustainabilityEquivalents,
      failOnCarbonIncrease,
    };

    if (config.debug) {
      core.info(`Timestamp: ${new Date().toISOString()}`);
      logEnvironment();
      logInputs();
      core.info('=== Parsing Configuration ===');
      core.info(`  pulumi-plan-json resolved to: "${pulumiPlanJsonPath}"`);
      core.info(`  github-token: ${githubToken ? '[PROVIDED]' : '[EMPTY]'}`);
      core.info(`  pulumicost-version resolved to: "${pulumicostVersion}"`);
      core.info(`  install-plugins raw: "${installPluginsRaw}"`);
      core.info(`  install-plugins parsed: [${installPlugins.map((p) => `"${p}"`).join(', ')}]`);
      core.info(`  behavior-on-error: "${behaviorOnError}"`);
      core.info(`  post-comment raw: "${postCommentRaw}" -> parsed: ${postComment}`);
      core.info(`  fail-on-cost-increase: "${threshold}"`);
      core.info(`  analyzer-mode raw: "${analyzerModeRaw}" -> parsed: ${analyzerMode}`);
      core.info(`  detailed-comment raw: "${detailedCommentRaw}" -> parsed: ${detailedComment}`);
      core.info(
        `  include-recommendations raw: "${includeRecommendationsRaw}" -> parsed: ${includeRecommendations}`,
      );
      core.info(`  log-level: "${logLevel}"`);
      core.info(`  debug raw: "${debugRaw}" -> parsed: ${debug}`);
      core.info(
        `  include-actual-costs raw: "${includeActualCostsRaw}" -> parsed: ${includeActualCosts}`,
      );
      core.info(`  actual-costs-period: "${actualCostsPeriod}"`);
      core.info(`  pulumi-state-json: "${pulumiStateJsonPath}"`);
      core.info(`  actual-costs-group-by: "${actualCostsGroupBy}"`);
      core.info(
        `  include-sustainability raw: "${includeSustainabilityRaw}" -> parsed: ${includeSustainability}`,
      );
      core.info(`  utilization-rate: "${utilizationRate}"`);
      core.info(
        `  sustainability-equivalents raw: "${sustainabilityEquivalentsRaw}" -> parsed: ${sustainabilityEquivalents}`,
      );
      core.info(`  fail-on-carbon-increase: "${failOnCarbonIncrease}"`);
    }

    if (config.debug) {
      core.info('=== Checking Plan File ===');
      if (fs.existsSync(config.pulumiPlanJsonPath)) {
        const stats = fs.statSync(config.pulumiPlanJsonPath);
        core.info(`  Plan file exists: ${config.pulumiPlanJsonPath}`);
        core.info(`  Plan file size: ${stats.size} bytes`);

        if (stats.size > 0 && stats.size < 10000) {
          const content = fs.readFileSync(config.pulumiPlanJsonPath, 'utf8');
          core.info(`  Plan file content (first 1000 chars):\n${content.substring(0, 1000)}`);
        } else if (stats.size === 0) {
          core.warning('  Plan file is EMPTY!');
        } else {
          core.info(`  Plan file too large to display (${stats.size} bytes)`);
        }
      } else {
        core.warning(`  Plan file NOT FOUND: ${config.pulumiPlanJsonPath}`);
        core.info(`  Current directory contents:`);
        const files = fs.readdirSync('.');
        for (const file of files) {
          const stat = fs.statSync(file);
          core.info(`    ${file} (${stat.isDirectory() ? 'dir' : stat.size + ' bytes'})`);
        }
      }
    }

    const installer = new Installer();
    const pluginManager = new PluginManager();
    const analyzer = new Analyzer();
    const commenter = new Commenter();

    core.info('');
    core.startGroup('📦 Installing pulumicost');
    const installStartTime = Date.now();
    const binaryPath = await installer.install(config.pulumicostVersion, config);
    if (config.debug) {
      core.info(`Installed pulumicost at: ${binaryPath}`);
      core.info(`Installation took: ${Date.now() - installStartTime}ms`);
    }
    core.endGroup();

    if (config.installPlugins.length > 0) {
      core.info('');
      core.startGroup('🔌 Installing plugins');
      const pluginStartTime = Date.now();
      await pluginManager.installPlugins(config.installPlugins, config);
      if (config.debug) {
        core.info(`Plugin installation took: ${Date.now() - pluginStartTime}ms`);
      }
      core.endGroup();
    } else {
      if (config.debug) core.info('No plugins to install (install-plugins is empty)');
    }

    if (config.analyzerMode) {
      core.info('');
      core.startGroup('🔍 Setting up Analyzer Mode');
      await analyzer.setupAnalyzerMode(config);
      core.endGroup();
      core.info('✅ Analyzer mode configured. Run "pulumi preview" to see cost estimates.');
      if (config.debug) core.info(`Total execution time: ${Date.now() - startTime}ms`);
      return;
    }

    core.info('');
    core.startGroup('💰 Running cost analysis');
    const analysisStartTime = Date.now();
    const report = await analyzer.runAnalysis(config.pulumiPlanJsonPath, config);
    if (config.debug) {
      core.info(`Analysis took: ${Date.now() - analysisStartTime}ms`);
    }

    // Extract values from report - handle both new and legacy formats
    const totalMonthlyCost = report.summary?.totalMonthly ?? report.projected_monthly_cost ?? 0;
    const currency = report.summary?.currency ?? report.currency ?? 'USD';

    if (config.debug) {
      const resourceCount = report.resources?.length ?? report.summary?.resources?.length ?? 0;
      core.info(`Analysis result summary:`);
      core.info(`  totalMonthly: ${totalMonthlyCost}`);
      core.info(`  currency: ${currency}`);
      core.info(`  resourceCount: ${resourceCount}`);
      if (report.summary?.byProvider) {
        core.info(`  byProvider: ${JSON.stringify(report.summary.byProvider)}`);
      }
      if (report.summary?.byService) {
        core.info(`  byService: ${JSON.stringify(report.summary.byService)}`);
      }
      core.info(`  diff: ${report.diff ? JSON.stringify(report.diff) : 'null'}`);
    }
    core.endGroup();

    core.setOutput('total-monthly-cost', totalMonthlyCost.toString());
    core.setOutput('currency', currency);
    core.info(`📊 Projected monthly cost: ${totalMonthlyCost} ${currency}`);

    if (report.diff) {
      core.setOutput('cost-diff', report.diff.monthly_cost_change.toString());
      core.info(`📈 Cost change: ${report.diff.monthly_cost_change} ${currency}`);
    }

    let sustainabilityReport: SustainabilityReport | undefined;
    if (config.includeSustainability) {
      core.info('');
      core.startGroup('🌱 Running sustainability analysis');
      const { totalCO2e, totalCO2eDiff, carbonIntensity } = analyzer.calculateSustainabilityMetrics(report);
      
      sustainabilityReport = {
        totalCO2e,
        totalCO2eDiff,
        carbonIntensity
      };

      core.setOutput('total-carbon-footprint', totalCO2e.toString());
      core.setOutput('carbon-intensity', carbonIntensity.toString());
      
      core.info(`🌱 Total Carbon Footprint: ${totalCO2e.toFixed(2)} kgCO2e/month`);
      core.info(`🌱 Carbon Intensity: ${carbonIntensity.toFixed(2)} gCO2e/USD`);
      core.endGroup();
    }

    let recommendationsReport: RecommendationsReport | undefined;
    if (config.includeRecommendations) {
      core.info('');
      core.startGroup('💡 Running cost recommendations');
      const recommendationsStartTime = Date.now();
      recommendationsReport = await analyzer.runRecommendations(config.pulumiPlanJsonPath, config);
      if (config.debug) {
        core.info(`Recommendations took: ${Date.now() - recommendationsStartTime}ms`);
      }

      core.setOutput('total-savings', recommendationsReport.summary.total_savings.toString());
      core.setOutput('recommendation-count', recommendationsReport.summary.total_count.toString());
      core.info(
        `💰 Potential monthly savings: ${recommendationsReport.summary.total_savings} ${recommendationsReport.summary.currency}`,
      );
      core.endGroup();
    }

    let actualCostReport: ActualCostReport | undefined;
    if (config.includeActualCosts) {
      core.info('');
      core.startGroup('📉 Running actual cost analysis');
      const actualStart = Date.now();
      actualCostReport = await analyzer.runActualCosts(config);
      if (config.debug) {
        core.info(`Actual costs took: ${Date.now() - actualStart}ms`);
      }
      core.setOutput('actual-total-cost', actualCostReport.total.toString());
      core.setOutput(
        'actual-cost-period',
        `${actualCostReport.startDate} to ${actualCostReport.endDate}`,
      );
      core.info(
        `📉 Actual Cost (${actualCostReport.startDate} to ${actualCostReport.endDate}): ${actualCostReport.total} ${actualCostReport.currency}`,
      );
      core.endGroup();
    }

    if (config.postComment && config.githubToken) {
      core.info('');
      core.startGroup('💬 Posting PR comment');
      const commentStartTime = Date.now();
      await commenter.upsertComment(
        report,
        config.githubToken,
        config,
        recommendationsReport,
        actualCostReport,
        sustainabilityReport,
      );
      if (config.debug) {
        core.info(`Comment posting took: ${Date.now() - commentStartTime}ms`);
      }
      core.endGroup();
    }

    if (config.threshold && report.diff) {
      core.info('');
      core.startGroup('🛡️ Checking cost guardrails');
      const { checkThreshold } = await import('./guardrails.js');
      const failed = checkThreshold(config.threshold, report.diff.monthly_cost_change, currency);

      if (failed) {
        throw new Error(
          `Cost increase of ${report.diff.monthly_cost_change} ${currency} exceeds threshold ${config.threshold}`,
        );
      }
      core.info(`✅ Cost within threshold: ${config.threshold}`);
      core.endGroup();
    }

    if (config.failOnCarbonIncrease && sustainabilityReport) {
      core.info('');
      core.startGroup('🌱 Checking sustainability guardrails');
      const { checkCarbonThreshold } = await import('./guardrails.js');
      
      // Calculate base total for percent check
      const baseTotal = sustainabilityReport.totalCO2e - sustainabilityReport.totalCO2eDiff;
      
      const failed = checkCarbonThreshold(
        config.failOnCarbonIncrease,
        sustainabilityReport.totalCO2eDiff,
        baseTotal
      );

      if (failed) {
        throw new Error(
          `Carbon footprint increase of ${sustainabilityReport.totalCO2eDiff.toFixed(2)} kgCO2e exceeds threshold ${config.failOnCarbonIncrease}`,
        );
      }
      core.info(`✅ Carbon footprint within threshold: ${config.failOnCarbonIncrease}`);
      core.endGroup();
    }

    core.info('');
    core.info('✅ finfocus-action completed successfully');
    if (config.debug) core.info(`Total execution time: ${Date.now() - startTime}ms`);
  } catch (error) {
    if (config?.debug) {
      core.info('');
      core.info('=== ERROR OCCURRED ===');
      core.info(`Total execution time before error: ${Date.now() - startTime}ms`);

      const behavior = core.getInput('behavior-on-error') || 'fail';
      core.info(`Error behavior setting: ${behavior}`);
    }

    if (error instanceof Error) {
      if (config?.debug) {
        core.info(`Error name: ${error.name}`);
        core.info(`Error message: ${error.message}`);
        core.info(`Error stack:\n${error.stack}`);
      }

      const behavior = core.getInput('behavior-on-error') || 'fail';
      if (behavior === 'warn') {
        core.warning(`⚠️ ${error.message}`);
      } else if (behavior === 'silent') {
        core.info(`Silent error (not failing): ${error.message}`);
      } else {
        core.setFailed(`❌ ${error.message}`);
      }
    } else {
      if (config?.debug) {
        core.info(`Unknown error type: ${typeof error}`);
        core.info(`Error value: ${String(error)}`);
      }
      core.setFailed(`❌ Unknown error: ${String(error)}`);
    }
  } finally {
    if (config?.debug) logAnalyzerOutput();
  }
}

run();
