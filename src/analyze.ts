import * as exec from '@actions/exec';
import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import YAML from 'yaml';
import { IAnalyzer, PulumicostReport, ActionConfiguration } from './types.js';

export class Analyzer implements IAnalyzer {
  async runAnalysis(planPath: string, config?: ActionConfiguration): Promise<PulumicostReport> {
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
    if (debug) {
      core.info(`=== Running pulumicost command ===`);
      core.info(`  Command: pulumicost ${args.join(' ')}`);
    }

    const analysisStart = Date.now();
    const output = await exec.getExecOutput('pulumicost', args, {
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
      core.error(`  pulumicost command FAILED with exit code ${output.exitCode}`);
      throw new Error(
        `pulumicost analysis failed with exit code ${output.exitCode}.\n` +
          `Stderr: ${output.stderr}\n` +
          `Stdout: ${output.stdout}`,
      );
    }

    if (debug) core.info(`=== Parsing analysis output ===`);
    try {
      const report = JSON.parse(output.stdout) as PulumicostReport;
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
      core.error(`  Failed to parse pulumicost output as JSON`);
      core.error(`  Parse error: ${err instanceof Error ? err.message : String(err)}`);
      core.error(`  Raw output (first 1000 chars): ${output.stdout.substring(0, 1000)}`);
      throw new Error(
        `Failed to parse pulumicost JSON output.\n` +
          `Error: ${err instanceof Error ? err.message : String(err)}\n` +
          `Raw output: ${output.stdout.substring(0, 500)}...`,
      );
    }
  }

  async setupAnalyzerMode(config?: ActionConfiguration): Promise<void> {
    const debug = config?.debug === true;
    if (debug) core.info(`=== Analyzer: Setting up analyzer mode ===`);
    else core.info(`Setting up pulumicost analyzer mode...`);

    // 1. Get pulumicost version for metadata
    let version = '0.0.0-dev';
    try {
      const versionOutput = await exec.getExecOutput('pulumicost', ['--version'], {
        silent: true,
        ignoreReturnCode: true,
      });
      version = versionOutput.stdout.trim().match(/v?[\d.]+/)?.[0] || version;
    } catch (e) {
      core.debug(`Failed to get version: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (debug) core.info(`  Using version: ${version}`);

    // 2. Define Policy Pack Directory
    const policyPackDir = path.join(os.homedir(), '.pulumicost', 'analyzer');
    if (debug) core.info(`  Policy Pack directory: ${policyPackDir}`);

    if (!fs.existsSync(policyPackDir)) {
      if (debug) core.info(`  Creating policy pack directory...`);
      fs.mkdirSync(policyPackDir, { recursive: true });
    }

    // 3. Create PulumiPolicy.yaml
    const policyYamlPath = path.join(policyPackDir, 'PulumiPolicy.yaml');
    if (debug) core.info(`  Writing PulumiPolicy.yaml to: ${policyYamlPath}`);
    // The runtime 'pulumicost' tells Pulumi to look for 'pulumi-analyzer-policy-pulumicost'
    const policyYamlContent = `runtime: pulumicost\nname: pulumicost\nversion: ${version}\n`;
    fs.writeFileSync(policyYamlPath, policyYamlContent);

    // 4. Locate and Copy Binary
    const pulumicostBinary = await this.findBinary('pulumicost', debug);
    if (debug) core.info(`  Source binary: ${pulumicostBinary}`);

    // The binary MUST be named 'pulumi-analyzer-policy-pulumicost' for the 'pulumicost' runtime
    const policyBinaryPath = path.join(policyPackDir, 'pulumi-analyzer-policy-pulumicost');
    
    if (debug) core.info(`  Installing policy binary to: ${policyBinaryPath}`);
    fs.copyFileSync(pulumicostBinary, policyBinaryPath);
    fs.chmodSync(policyBinaryPath, 0o755);

    // 5. Configure Environment
    // - Add to PATH so Pulumi can find the binary named 'pulumi-analyzer-policy-pulumicost'
    if (debug) core.info(`  Adding ${policyPackDir} to PATH`);
    core.addPath(policyPackDir);

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
      if (debug) core.info(`  Exporting PULUMICOST_LOG_LEVEL=${config.logLevel}`);
      core.exportVariable('PULUMICOST_LOG_LEVEL', config.logLevel);
    }

    // Set output for use in subsequent steps
    core.setOutput('policy-pack-path', policyPackDir);

    if (debug) core.info(`  Analyzer (Policy Pack) setup complete.`);
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
