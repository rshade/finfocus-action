import * as exec from '@actions/exec';
import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import YAML from 'yaml';
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
          `Make sure to run 'pulumi preview --json > ${planPath}' first.`,
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
      core.error(
        `  JSON parse error: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
      );
      throw new Error(
        `Pulumi plan file is not valid JSON: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
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
          `Stdout: ${output.stdout}`,
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
          `Raw output: ${output.stdout.substring(0, 500)}...`,
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

    const pluginDir = path.join(
      os.homedir(),
      '.pulumi',
      'plugins',
      `analyzer-pulumicost-${version}`,
    );
    core.info(`  Plugin directory: ${pluginDir}`);

    if (!fs.existsSync(pluginDir)) {
      core.info(`  Creating plugin directory...`);
      fs.mkdirSync(pluginDir, { recursive: true });
    }

        const pulumicostBinary = await this.findBinary('pulumicost');
        core.info(`  Source binary: ${pulumicostBinary}`);
        
        const analyzerBinaryPath = path.join(pluginDir, 'pulumi-analyzer-pulumicost');
        const realBinaryPath = path.join(pluginDir, 'pulumicost-real');
        
        core.info(`  Installing real binary to: ${realBinaryPath}`);
        fs.copyFileSync(pulumicostBinary, realBinaryPath);
        fs.chmodSync(realBinaryPath, 0o755);
    
        core.info(`  Creating analyzer wrapper script at: ${analyzerBinaryPath}`);
        // The wrapper script passes all arguments to the real binary, 
        // but redirects stderr to a log file for troubleshooting.
        // We use 'tee -a' so we can see it in the console IF Pulumi lets it through,
        // and also keep it in a file we can cat later.
        const wrapperScript = `#!/bin/sh
    echo "--- $(date) ---" >> /tmp/pulumicost-analyzer.log
    echo "Invoking pulumicost analyzer with args: $@" >> /tmp/pulumicost-analyzer.log
    # We redirect stderr to our log file. Stdout MUST remain clean for gRPC port discovery.
    "${realBinaryPath}" "$@" 2>> /tmp/pulumicost-analyzer.log
    `;
        fs.writeFileSync(analyzerBinaryPath, wrapperScript);
        fs.chmodSync(analyzerBinaryPath, 0o755);
        core.info(`  Wrapper script created and made executable`);
    
        core.info(`  Analyzer plugin installed successfully.`);
    // Automatically update Pulumi.yaml if it exists
    // CRITICAL: We must use plugins.analyzers with explicit path, NOT just analyzers:
    // See ANALYZER_SETUP_NOTES.md for details
    const pulumiYamlPath = path.join(process.cwd(), 'Pulumi.yaml');
    if (fs.existsSync(pulumiYamlPath)) {
      core.info(`  Updating Pulumi.yaml at ${pulumiYamlPath}...`);
      core.info(`  Using plugins.analyzers with explicit path: ${pluginDir}`);
      try {
        const yamlContent = fs.readFileSync(pulumiYamlPath, 'utf8');
        const doc = YAML.parseDocument(yamlContent);
        let modified = false;

        // Check if plugins.analyzers already exists
        const plugins = doc.get('plugins');
        const analyzerConfig = {
          name: 'pulumicost',
          path: pluginDir,
        };

        if (!plugins) {
          core.info(`  'plugins' section not found. Creating plugins.analyzers...`);
          doc.set('plugins', {
            analyzers: [analyzerConfig],
          });
          modified = true;
        } else {
          const pluginsJS = doc.toJS().plugins;

          if (!pluginsJS.analyzers) {
            core.info(`  'plugins.analyzers' not found. Creating...`);
            doc.setIn(['plugins', 'analyzers'], [analyzerConfig]);
            modified = true;
          } else if (Array.isArray(pluginsJS.analyzers)) {
            // Check if pulumicost is already configured
            const hasPulumicost = pluginsJS.analyzers.some(
              (a: { name?: string }) => a.name === 'pulumicost',
            );
            if (!hasPulumicost) {
              core.info(`  'pulumicost' not in plugins.analyzers. Adding...`);
              doc.addIn(['plugins', 'analyzers'], analyzerConfig);
              modified = true;
            } else {
              core.info(`  'pulumicost' already configured in plugins.analyzers.`);
            }
          } else {
            core.warning(`  'plugins.analyzers' exists but is not a list. Overwriting...`);
            doc.setIn(['plugins', 'analyzers'], [analyzerConfig]);
            modified = true;
          }
        }

        if (modified) {
          fs.writeFileSync(pulumiYamlPath, doc.toString());
          core.info(`  Pulumi.yaml updated successfully.`);
          core.info(`  New Pulumi.yaml content:\n${doc.toString()}`);
        } else {
          core.info(`  No changes needed for Pulumi.yaml.`);
          core.info(`  Current Pulumi.yaml content:\n${fs.readFileSync(pulumiYamlPath, 'utf8')}`);
        }
      } catch (e) {
        core.warning(
          `  Failed to parse or update Pulumi.yaml: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    } else {
      core.warning(
        `  Pulumi.yaml not found at ${pulumiYamlPath}. Please manually add 'plugins.analyzers' section.`,
      );
    }
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
