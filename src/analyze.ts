import * as exec from '@actions/exec';
import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { IAnalyzer, PulumicostReport } from './types.js';

export class Analyzer implements IAnalyzer {
  async runAnalysis(planPath: string): Promise<PulumicostReport> {
    core.info(`Running cost analysis for ${planPath}`);

    if (!fs.existsSync(planPath)) {
      throw new Error(
        `Pulumi plan file not found: ${planPath}. ` +
          `Make sure to run 'pulumi preview --json > ${planPath}' first.`
      );
    }

    const planSize = fs.statSync(planPath).size;
    core.debug(`Plan file size: ${planSize} bytes`);

    if (planSize === 0) {
      throw new Error(`Pulumi plan file is empty: ${planPath}`);
    }

    const args = ['cost', 'projected', '--pulumi-json', planPath, '--output', 'json'];
    core.debug(`Running: pulumicost ${args.join(' ')}`);

    const output = await exec.getExecOutput('pulumicost', args, {
      silent: false,
      ignoreReturnCode: true,
    });

    core.debug(`Exit code: ${output.exitCode}`);
    core.debug(`Stdout length: ${output.stdout.length}`);
    core.debug(`Stderr: ${output.stderr}`);

    if (output.exitCode !== 0) {
      throw new Error(
        `pulumicost analysis failed with exit code ${output.exitCode}.\n` +
          `Stderr: ${output.stderr}\n` +
          `Stdout: ${output.stdout}`
      );
    }

    try {
      const report = JSON.parse(output.stdout) as PulumicostReport;
      core.debug(`Parsed report: ${JSON.stringify(report, null, 2)}`);
      return report;
    } catch (err) {
      throw new Error(
        `Failed to parse pulumicost JSON output.\n` +
          `Error: ${err instanceof Error ? err.message : String(err)}\n` +
          `Raw output: ${output.stdout.substring(0, 500)}...`
      );
    }
  }

  async setupAnalyzerMode(): Promise<void> {
    const analyzerDir = path.join(os.homedir(), '.pulumicost', 'analyzer');
    core.info(`Setting up analyzer mode in ${analyzerDir}`);
    core.debug(`Home directory: ${os.homedir()}`);

    if (!fs.existsSync(analyzerDir)) {
      fs.mkdirSync(analyzerDir, { recursive: true });
    }

    const policyYaml = `runtime: pulumicost
name: pulumicost
version: 0.1.0
`;
    fs.writeFileSync(path.join(analyzerDir, 'PulumiPolicy.yaml'), policyYaml);

    const pulumicostBinary = await this.findBinary('pulumicost');
    const analyzerBinaryName = 'pulumi-analyzer-policy-pulumicost';
    const analyzerBinaryPath = path.join(analyzerDir, analyzerBinaryName);

    core.info(`Copying ${pulumicostBinary} to ${analyzerBinaryPath}`);
    fs.copyFileSync(pulumicostBinary, analyzerBinaryPath);
    fs.chmodSync(analyzerBinaryPath, 0o755);

    core.exportVariable('PULUMI_POLICY_PACK_PATH', analyzerDir);
    core.info(`Analyzer mode configured. Use 'pulumi preview' to see cost estimates.`);
  }

  private async findBinary(name: string): Promise<string> {
    const output = await exec.getExecOutput('which', [name], { silent: true });
    if (output.exitCode !== 0) {
      throw new Error(`Could not find ${name} binary in PATH`);
    }
    return output.stdout.trim();
  }
}
