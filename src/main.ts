import * as core from '@actions/core';
import { ActionConfiguration } from './types';
import { Installer } from './install';
import { PluginManager } from './plugins';
import { Analyzer } from './analyze';
import { Commenter } from './comment';

async function run(): Promise<void> {
  try {
    const config: ActionConfiguration = {
      pulumiPlanJsonPath: core.getInput('pulumi-plan-json'),
      githubToken: core.getInput('github-token'),
      pulumicostVersion: core.getInput('pulumicost-version'),
      installPlugins: core.getInput('install-plugins')
        ? core.getInput('install-plugins').split(',')
        : [],
      behaviorOnError: core.getInput('behavior-on-error') as any || 'fail',
      postComment: core.getBooleanInput('post-comment'),
      threshold: core.getInput('fail-on-cost-increase') || null,
      analyzerMode: core.getBooleanInput('analyzer-mode')
    };

    const installer = new Installer();
    const pluginManager = new PluginManager();
    const analyzer = new Analyzer();
    const commenter = new Commenter();

    // 1. Install pulumicost
    await installer.install(config.pulumicostVersion);

    // 2. Install plugins
    await pluginManager.installPlugins(config.installPlugins);

    if (config.analyzerMode) {
      await analyzer.setupAnalyzerMode();
      core.info('Analyzer mode configured.');
      return;
    }

    // 3. Run analysis
    const report = await analyzer.runAnalysis(config.pulumiPlanJsonPath);

    // 4. Set outputs
    core.setOutput('total-monthly-cost', report.projected_monthly_cost.toString());
    core.setOutput('currency', report.currency);
    if (report.diff) {
      core.setOutput('cost-diff', report.diff.monthly_cost_change.toString());
    }

    // 5. Post comment
    if (config.postComment && config.githubToken) {
      await commenter.upsertComment(report, config.githubToken);
    }

    // 6. Handle Guardrails
    if (config.threshold && report.diff) {
      const { checkThreshold } = await import('./guardrails');
      const failed = checkThreshold(config.threshold, report.diff.monthly_cost_change, report.currency);
      
      if (failed) {
        throw new Error(`Cost increase of ${report.diff.monthly_cost_change} ${report.currency} exceeds threshold ${config.threshold}`);
      }
    }

  } catch (error) {
    if (error instanceof Error) {
      const behavior = core.getInput('behavior-on-error');
      if (behavior === 'warn') {
        core.warning(error.message);
      } else if (behavior === 'silent') {
        core.info(error.message);
      } else {
        core.setFailed(error.message);
      }
    }
  }
}

run();
