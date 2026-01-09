import * as core from '@actions/core';
import { ActionConfiguration } from './types.js';
import { Installer } from './install.js';
import { PluginManager } from './plugins.js';
import { Analyzer } from './analyze.js';
import { Commenter } from './comment.js';

async function run(): Promise<void> {
  try {
    core.info('🚀 Starting finfocus-action');

    const config: ActionConfiguration = {
      pulumiPlanJsonPath: core.getInput('pulumi-plan-json'),
      githubToken: core.getInput('github-token'),
      pulumicostVersion: core.getInput('pulumicost-version'),
      installPlugins: core.getMultilineInput('install-plugins')
        .flatMap((p) => p.split(','))
        .map((p) => p.trim())
        .filter((p) => p.length > 0),
      behaviorOnError: (core.getInput('behavior-on-error') as 'fail' | 'warn' | 'silent') || 'fail',
      postComment: core.getBooleanInput('post-comment'),
      threshold: core.getInput('fail-on-cost-increase') || null,
      analyzerMode: core.getBooleanInput('analyzer-mode'),
    };

    core.debug('Configuration loaded:');
    core.debug(`  pulumi-plan-json: ${config.pulumiPlanJsonPath}`);
    core.debug(`  pulumicost-version: ${config.pulumicostVersion}`);
    core.debug(`  install-plugins: ${config.installPlugins.join(', ') || '(none)'}`);
    core.debug(`  behavior-on-error: ${config.behaviorOnError}`);
    core.debug(`  post-comment: ${config.postComment}`);
    core.debug(`  fail-on-cost-increase: ${config.threshold || '(none)'}`);
    core.debug(`  analyzer-mode: ${config.analyzerMode}`);

    const installer = new Installer();
    const pluginManager = new PluginManager();
    const analyzer = new Analyzer();
    const commenter = new Commenter();

    core.startGroup('📦 Installing pulumicost');
    const binaryPath = await installer.install(config.pulumicostVersion);
    core.info(`Installed pulumicost at: ${binaryPath}`);
    core.endGroup();

    if (config.installPlugins.length > 0) {
      core.startGroup('🔌 Installing plugins');
      await pluginManager.installPlugins(config.installPlugins);
      core.endGroup();
    }

    if (config.analyzerMode) {
      core.startGroup('🔍 Setting up Analyzer Mode');
      await analyzer.setupAnalyzerMode();
      core.endGroup();
      core.info('✅ Analyzer mode configured. Run "pulumi preview" to see cost estimates.');
      return;
    }

    core.startGroup('💰 Running cost analysis');
    const report = await analyzer.runAnalysis(config.pulumiPlanJsonPath);
    core.debug(`Analysis result: ${JSON.stringify(report, null, 2)}`);
    core.endGroup();

    core.setOutput('total-monthly-cost', report.projected_monthly_cost.toString());
    core.setOutput('currency', report.currency);
    core.info(`📊 Projected monthly cost: ${report.projected_monthly_cost} ${report.currency}`);

    if (report.diff) {
      core.setOutput('cost-diff', report.diff.monthly_cost_change.toString());
      core.info(`📈 Cost change: ${report.diff.monthly_cost_change} ${report.currency}`);
    }

    if (config.postComment && config.githubToken) {
      core.startGroup('💬 Posting PR comment');
      await commenter.upsertComment(report, config.githubToken);
      core.endGroup();
    }

    if (config.threshold && report.diff) {
      core.startGroup('🛡️ Checking cost guardrails');
      const { checkThreshold } = await import('./guardrails.js');
      const failed = checkThreshold(
        config.threshold,
        report.diff.monthly_cost_change,
        report.currency
      );

      if (failed) {
        throw new Error(
          `Cost increase of ${report.diff.monthly_cost_change} ${report.currency} exceeds threshold ${config.threshold}`
        );
      }
      core.info(`✅ Cost within threshold: ${config.threshold}`);
      core.endGroup();
    }

    core.info('✅ finfocus-action completed successfully');
  } catch (error) {
    const behavior = core.getInput('behavior-on-error') || 'fail';

    if (error instanceof Error) {
      core.debug(`Error stack trace: ${error.stack}`);

      if (behavior === 'warn') {
        core.warning(`⚠️ ${error.message}`);
      } else if (behavior === 'silent') {
        core.debug(`Silent error: ${error.message}`);
      } else {
        core.setFailed(`❌ ${error.message}`);
      }
    } else {
      core.setFailed(`❌ Unknown error: ${String(error)}`);
    }
  }
}

run();
