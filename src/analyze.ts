import * as exec from '@actions/exec';
import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { IAnalyzer, PulumicostReport } from './types.js';

export class Analyzer implements IAnalyzer {
  async runAnalysis(planPath: string): Promise<PulumicostReport> {
    core.info(`=== Analyzer: Running cost analysis ===`);
    core.info(`  Plan file path: ${planPath}`);
    core.info(`  Absolute path: ${path.resolve(planPath)}`);

    if (!fs.existsSync(planPath)) {
      core.error(`  Plan file NOT FOUND: ${planPath}`);
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
      throw new Error(
        `Pulumi plan file not found: ${planPath}. ` +
          `Make sure to run 'pulumi preview --json > ${planPath}' first.`
      );
    }

    const planStats = fs.statSync(planPath);
    core.info(`  Plan file size: ${planStats.size} bytes`);
    core.info(`  Plan file modified: ${planStats.mtime.toISOString()}`);

    if (planStats.size === 0) {
      core.error(`  Plan file is EMPTY`);
      throw new Error(`Pulumi plan file is empty: ${planPath}`);
    }

    const planContent = fs.readFileSync(planPath, 'utf8');
    core.info(`  Plan file content length: ${planContent.length} chars`);
    
    if (planContent.length < 5000) {
      core.info(`  Plan file content:\n${planContent}`);
    } else {
      core.info(`  Plan file first 2000 chars:\n${planContent.substring(0, 2000)}`);
      core.info(`  ... (truncated, total ${planContent.length} chars)`);
    }

    try {
      JSON.parse(planContent);
      core.info(`  Plan file is valid JSON`);
    } catch (parseErr) {
      core.error(`  Plan file is NOT valid JSON`);
      core.error(`  JSON parse error: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
      throw new Error(
        `Pulumi plan file is not valid JSON: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`
      );
    }

    const args = ['cost', 'projected', '--pulumi-json', planPath, '--output', 'json'];
    core.info(`=== Running pulumicost command ===`);
    core.info(`  Command: pulumicost ${args.join(' ')}`);

    const analysisStart = Date.now();
    const output = await exec.getExecOutput('pulumicost', args, {
      silent: false,
      ignoreReturnCode: true,
    });

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

    if (output.exitCode !== 0) {
      core.error(`  pulumicost command FAILED with exit code ${output.exitCode}`);
      throw new Error(
        `pulumicost analysis failed with exit code ${output.exitCode}.\n` +
          `Stderr: ${output.stderr}\n` +
          `Stdout: ${output.stdout}`
      );
    }

    core.info(`=== Parsing analysis output ===`);
    try {
      const report = JSON.parse(output.stdout) as PulumicostReport;
      core.info(`  Parsed successfully`);
      core.info(`  Report fields: ${Object.keys(report).join(', ')}`);
      core.info(`  projected_monthly_cost: ${report.projected_monthly_cost}`);
      core.info(`  currency: ${report.currency}`);
      if (report.diff) {
        core.info(`  diff.monthly_cost_change: ${report.diff.monthly_cost_change}`);
      }
      return report;
    } catch (err) {
      core.error(`  Failed to parse pulumicost output as JSON`);
      core.error(`  Parse error: ${err instanceof Error ? err.message : String(err)}`);
      core.error(`  Raw output (first 1000 chars): ${output.stdout.substring(0, 1000)}`);
      throw new Error(
        `Failed to parse pulumicost JSON output.\n` +
          `Error: ${err instanceof Error ? err.message : String(err)}\n` +
          `Raw output: ${output.stdout.substring(0, 500)}...`
      );
    }
  }

  async setupAnalyzerMode(): Promise<void> {
    core.info(`=== Analyzer: Setting up analyzer mode ===`);
    
    core.info(`  Getting pulumicost version...`);
    const versionOutput = await exec.getExecOutput('pulumicost', ['version'], { 
      silent: false,
      ignoreReturnCode: true,
    });
    core.info(`  Version output: ${versionOutput.stdout.trim()}`);
    if (versionOutput.stderr) {
      core.info(`  Version stderr: ${versionOutput.stderr.trim()}`);
    }
    
    const version = versionOutput.stdout.trim().match(/v?[\d.]+/)?.[0] || 'v0.1.0';
    core.info(`  Extracted version: ${version}`);

    const pluginDir = path.join(os.homedir(), '.pulumi', 'plugins', `analyzer-cost-${version}`);
    core.info(`  Plugin directory: ${pluginDir}`);

    if (!fs.existsSync(pluginDir)) {
      core.info(`  Creating plugin directory...`);
      fs.mkdirSync(pluginDir, { recursive: true });
    }

    const pulumicostBinary = await this.findBinary('pulumicost');
    core.info(`  Source binary: ${pulumicostBinary}`);
    
    const analyzerBinaryPath = path.join(pluginDir, 'pulumi-analyzer-cost');
    core.info(`  Target binary: ${analyzerBinaryPath}`);

    core.info(`  Copying binary...`);
    fs.copyFileSync(pulumicostBinary, analyzerBinaryPath);
    fs.chmodSync(analyzerBinaryPath, 0o755);
    core.info(`  Binary copied and made executable`);

    core.info(`  Analyzer plugin installed. Add 'analyzers: [cost]' to your Pulumi.yaml to enable.`);
  }

  private async findBinary(name: string): Promise<string> {
    core.info(`  Finding binary: ${name}`);
    const output = await exec.getExecOutput('which', [name], { 
      silent: false,
      ignoreReturnCode: true,
    });
    core.info(`  which exit code: ${output.exitCode}`);
    core.info(`  which output: ${output.stdout.trim()}`);
    
    if (output.exitCode !== 0) {
      core.error(`  Binary not found in PATH`);
      throw new Error(`Could not find ${name} binary in PATH`);
    }
    return output.stdout.trim();
  }
}
