import * as core from '@actions/core';
import * as fs from 'fs';
import { ActionConfiguration } from './types.js';
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
    .filter(k => k.startsWith('INPUT_') || k.startsWith('GITHUB_') || k.startsWith('RUNNER_'))
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
    'pulumi-plan-json',
    'github-token', 
    'pulumicost-version',
    'install-plugins',
    'behavior-on-error',
    'post-comment',
    'fail-on-cost-increase',
    'analyzer-mode'
  ];
  
  for (const input of inputs) {
    const value = core.getInput(input);
    if (input === 'github-token') {
      core.info(`  ${input}: ${value ? '[PROVIDED]' : '[EMPTY]'}`);
    } else {
      core.info(`  ${input}: "${value}"`);
    }
  }
}

async function run(): Promise<void> {
  const startTime = Date.now();
  
  try {
    core.info('🚀 Starting finfocus-action');
    core.info(`Timestamp: ${new Date().toISOString()}`);
    
    logEnvironment();
    logInputs();

    core.info('=== Parsing Configuration ===');
    
    const pulumiPlanJsonPath = core.getInput('pulumi-plan-json') || 'plan.json';
    core.info(`  pulumi-plan-json resolved to: "${pulumiPlanJsonPath}"`);
    
    const githubToken = core.getInput('github-token');
    core.info(`  github-token: ${githubToken ? '[PROVIDED]' : '[EMPTY]'}`);
    
    const pulumicostVersion = core.getInput('pulumicost-version') || 'latest';
    core.info(`  pulumicost-version resolved to: "${pulumicostVersion}"`);
    
    const installPluginsRaw = core.getInput('install-plugins');
    core.info(`  install-plugins raw: "${installPluginsRaw}"`);
    const installPlugins = installPluginsRaw
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    core.info(`  install-plugins parsed: [${installPlugins.map(p => `"${p}"`).join(', ')}]`);
    
    const behaviorOnErrorRaw = core.getInput('behavior-on-error');
    const behaviorOnError = (behaviorOnErrorRaw as 'fail' | 'warn' | 'silent') || 'fail';
    core.info(`  behavior-on-error: "${behaviorOnError}"`);
    
    const postCommentRaw = core.getInput('post-comment');
    const postComment = parseBoolean(postCommentRaw, true);
    core.info(`  post-comment raw: "${postCommentRaw}" -> parsed: ${postComment}`);
    
    const thresholdRaw = core.getInput('fail-on-cost-increase');
    const threshold = thresholdRaw || null;
    core.info(`  fail-on-cost-increase: "${threshold}"`);
    
    const analyzerModeRaw = core.getInput('analyzer-mode');
    const analyzerMode = parseBoolean(analyzerModeRaw, false);
    core.info(`  analyzer-mode raw: "${analyzerModeRaw}" -> parsed: ${analyzerMode}`);

    const config: ActionConfiguration = {
      pulumiPlanJsonPath,
      githubToken,
      pulumicostVersion,
      installPlugins,
      behaviorOnError,
      postComment,
      threshold,
      analyzerMode,
    };

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

    const installer = new Installer();
    const pluginManager = new PluginManager();
    const analyzer = new Analyzer();
    const commenter = new Commenter();

    core.info('');
    core.startGroup('📦 Installing pulumicost');
    const installStartTime = Date.now();
    const binaryPath = await installer.install(config.pulumicostVersion);
    core.info(`Installed pulumicost at: ${binaryPath}`);
    core.info(`Installation took: ${Date.now() - installStartTime}ms`);
    core.endGroup();

    if (config.installPlugins.length > 0) {
      core.info('');
      core.startGroup('🔌 Installing plugins');
      const pluginStartTime = Date.now();
      await pluginManager.installPlugins(config.installPlugins);
      core.info(`Plugin installation took: ${Date.now() - pluginStartTime}ms`);
      core.endGroup();
    } else {
      core.info('No plugins to install (install-plugins is empty)');
    }

    if (config.analyzerMode) {
      core.info('');
      core.startGroup('🔍 Setting up Analyzer Mode');
      await analyzer.setupAnalyzerMode();
      core.endGroup();
      core.info('✅ Analyzer mode configured. Run "pulumi preview" to see cost estimates.');
      core.info(`Total execution time: ${Date.now() - startTime}ms`);
      return;
    }

    core.info('');
    core.startGroup('💰 Running cost analysis');
    const analysisStartTime = Date.now();
    const report = await analyzer.runAnalysis(config.pulumiPlanJsonPath);
    core.info(`Analysis took: ${Date.now() - analysisStartTime}ms`);
    core.info(`Analysis result summary:`);
    core.info(`  projected_monthly_cost: ${report.projected_monthly_cost}`);
    core.info(`  currency: ${report.currency}`);
    core.info(`  diff: ${report.diff ? JSON.stringify(report.diff) : 'null'}`);
    core.endGroup();

    core.setOutput('total-monthly-cost', report.projected_monthly_cost.toString());
    core.setOutput('currency', report.currency);
    core.info(`📊 Projected monthly cost: ${report.projected_monthly_cost} ${report.currency}`);

    if (report.diff) {
      core.setOutput('cost-diff', report.diff.monthly_cost_change.toString());
      core.info(`📈 Cost change: ${report.diff.monthly_cost_change} ${report.currency}`);
    }

    if (config.postComment && config.githubToken) {
      core.info('');
      core.startGroup('💬 Posting PR comment');
      const commentStartTime = Date.now();
      await commenter.upsertComment(report, config.githubToken);
      core.info(`Comment posting took: ${Date.now() - commentStartTime}ms`);
      core.endGroup();
    } else {
      core.info(`Skipping PR comment (postComment=${config.postComment}, githubToken=${config.githubToken ? 'provided' : 'missing'})`);
    }

    if (config.threshold && report.diff) {
      core.info('');
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

    core.info('');
    core.info('✅ finfocus-action completed successfully');
    core.info(`Total execution time: ${Date.now() - startTime}ms`);
  } catch (error) {
    core.info('');
    core.info('=== ERROR OCCURRED ===');
    core.info(`Total execution time before error: ${Date.now() - startTime}ms`);
    
    const behavior = core.getInput('behavior-on-error') || 'fail';
    core.info(`Error behavior setting: ${behavior}`);

    if (error instanceof Error) {
      core.info(`Error name: ${error.name}`);
      core.info(`Error message: ${error.message}`);
      core.info(`Error stack:\n${error.stack}`);

      if (behavior === 'warn') {
        core.warning(`⚠️ ${error.message}`);
      } else if (behavior === 'silent') {
        core.info(`Silent error (not failing): ${error.message}`);
      } else {
        core.setFailed(`❌ ${error.message}`);
      }
    } else {
      core.info(`Unknown error type: ${typeof error}`);
      core.info(`Error value: ${String(error)}`);
      core.setFailed(`❌ Unknown error: ${String(error)}`);
    }
  }
}

run();
