import * as exec from '@actions/exec';
import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { IAnalyzer, PulumicostReport } from './types';

export class Analyzer implements IAnalyzer {
  async runAnalysis(planPath: string): Promise<PulumicostReport> {
    core.info(`Running cost analysis for ${planPath}`);

    const output = await exec.getExecOutput('pulumicost', [
      'cost',
      'projected',
      '--pulumi-json',
      planPath,
      '--output',
      'json'
    ]);

    if (output.exitCode !== 0) {
      throw new Error(`pulumicost analysis failed with exit code ${output.exitCode}: ${output.stderr}`);
    }

    try {
      return JSON.parse(output.stdout) as PulumicostReport;
    } catch (err) {
      throw new Error(`Failed to parse pulumicost output: ${err}`);
    }
  }

  async setupAnalyzerMode(): Promise<void> {
    const analyzerDir = path.join(os.homedir(), '.pulumicost', 'analyzer');
    core.info(`Setting up analyzer mode in ${analyzerDir}`);

    if (!fs.existsSync(analyzerDir)) {
      fs.mkdirSync(analyzerDir, { recursive: true });
    }

    const policyYaml = `runtime: pulumicost
description: Pulumi Cost Analyzer
`;
    fs.writeFileSync(path.join(analyzerDir, 'PulumiPolicy.yaml'), policyYaml);

    // In a real scenario, we might need to copy the binary to this directory 
    // with a specific name: pulumi-analyzer-policy-pulumicost
    // For now, we assume the binary is in the PATH and just set the env var.
    
    core.exportVariable('PULUMI_POLICY_PACK_PATH', analyzerDir);
  }
}
