import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import * as exec from '@actions/exec';
import { IInstaller, ActionConfiguration } from './types.js';

const REPO_OWNER = 'rshade';
const REPO_NAME = 'pulumicost-core';

export class Installer implements IInstaller {
  async install(version: string, config?: ActionConfiguration): Promise<string> {
    const debug = config?.debug === true;
    const platform = this.getPlatform();
    const arch = this.getArch();

    if (debug) {
      core.info(`=== Installer: Starting installation ===`);
      core.info(`  Requested version: ${version}`);
      core.info(`  Detected OS platform: ${os.platform()}`);
      core.info(`  Detected OS arch: ${os.arch()}`);
      core.info(`  Mapped platform: ${platform}`);
      core.info(`  Mapped arch: ${arch}`);
    } else {
      core.info(`Installing pulumicost (${version})...`);
    }

    const resolvedVersion = await this.resolveVersion(version, debug);
    if (debug) core.info(`  Resolved version: ${resolvedVersion}`);

    if (debug) core.info(`=== Checking tool cache ===`);
    const cached = tc.find('pulumicost-core', resolvedVersion, arch);
    if (cached) {
      if (debug) {
        core.info(`  Cache HIT: Found pulumicost at ${cached}`);
        core.info(`  Binary path: ${path.join(cached, this.getBinaryName())}`);
      }
      core.addPath(cached);
      await this.verifyInstallation(debug);
      return path.join(cached, this.getBinaryName());
    }
    if (debug) core.info(`  Cache MISS: Will download`);

    const ext = platform === 'windows' ? 'zip' : 'tar.gz';
    const assetName = `pulumicost-core-v${resolvedVersion}-${platform}-${arch}.${ext}`;
    const downloadUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/v${resolvedVersion}/${assetName}`;

    if (debug) {
      core.info(`=== Download Details ===`);
      core.info(`  Asset name: ${assetName}`);
      core.info(`  Download URL: ${downloadUrl}`);
    }

    let downloadPath: string;
    try {
      if (debug) core.info(`  Starting download...`);
      const downloadStart = Date.now();
      downloadPath = await tc.downloadTool(downloadUrl);
      if (debug) {
        core.info(`  Download completed in ${Date.now() - downloadStart}ms`);
        core.info(`  Downloaded to: ${downloadPath}`);
        const downloadStats = fs.statSync(downloadPath);
        core.info(`  Downloaded file size: ${downloadStats.size} bytes`);
      }
    } catch (err) {
      core.error(`  Download FAILED`);
      throw new Error(
        `Failed to download pulumicost from ${downloadUrl}. ` +
          `Check if version ${resolvedVersion} exists and has ${assetName} asset. ` +
          `Error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    let extractPath: string;
    try {
      if (debug) {
        core.info(`=== Extracting archive ===`);
        core.info(`  Archive type: ${ext}`);
      }
      const extractStart = Date.now();

      if (platform === 'windows') {
        extractPath = await tc.extractZip(downloadPath);
      } else {
        extractPath = await tc.extractTar(downloadPath);
      }

      if (debug) {
        core.info(`  Extraction completed in ${Date.now() - extractStart}ms`);
        core.info(`  Extracted to: ${extractPath}`);
        const extractedFiles = fs.readdirSync(extractPath);
        core.info(`  Extracted files: ${extractedFiles.join(', ')}`);
      }
    } catch (err) {
      core.error(`  Extraction FAILED`);
      throw new Error(
        `Failed to extract pulumicost archive. Error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (debug) core.info(`=== Caching binary ===`);
    const cachedPath = await tc.cacheDir(extractPath, 'pulumicost-core', resolvedVersion, arch);
    core.addPath(cachedPath);

    const binaryPath = path.join(cachedPath, this.getBinaryName());

    if (platform !== 'windows') {
      await exec.exec('chmod', ['+x', binaryPath], { silent: !debug });
    }

    await this.verifyInstallation(debug);

    if (debug) {
      core.info(`=== Installation complete ===`);
      core.info(`  Final binary path: ${binaryPath}`);
    }
    return binaryPath;
  }

  private async verifyInstallation(debug: boolean): Promise<void> {
    if (debug) core.info(`=== Verifying installation ===`);
    try {
      if (debug) core.info(`  Running: pulumicost --version`);
      const output = await exec.getExecOutput('pulumicost', ['--version'], {
        silent: !debug,
        ignoreReturnCode: true,
      });
      if (debug) {
        core.info(`  Exit code: ${output.exitCode}`);
        core.info(`  Stdout: ${output.stdout.trim()}`);
      }

      if (output.exitCode !== 0) {
        core.warning(`  pulumicost --version returned non-zero exit code: ${output.exitCode}`);
      } else if (debug) {
        core.info(`  Verification successful`);
      }
    } catch (err) {
      if (debug)
        core.warning(`  Verification FAILED: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (debug) {
      core.info(`  Checking PATH for pulumicost...`);
      try {
        const whichOutput = await exec.getExecOutput('which', ['pulumicost'], {
          silent: true,
          ignoreReturnCode: true,
        });
        core.info(`  which pulumicost: ${whichOutput.stdout.trim() || '(not found)'}`);
      } catch {
        core.info(`  which command failed`);
      }
    }
  }

  private async resolveVersion(version: string, debug: boolean): Promise<string> {
    if (version !== 'latest') {
      return version.replace(/^v/, '');
    }

    if (debug) core.info(`=== Resolving 'latest' version ===`);
    const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;

    const response = await fetch(apiUrl, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'finfocus-action',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch latest release: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { tag_name: string; name?: string };
    if (debug) {
      core.info(`  Release tag_name: ${data.tag_name}`);
    }

    return data.tag_name.replace(/^v/, '');
  }

  private getPlatform(): string {
    const p = os.platform();
    if (p === 'win32') return 'windows';
    if (p === 'darwin') return 'macos';
    return p;
  }

  private getArch(): string {
    const a = os.arch();
    if (a === 'x64') return 'amd64';
    if (a === 'arm64') return 'arm64';
    return a;
  }

  private getBinaryName(): string {
    return os.platform() === 'win32' ? 'pulumicost.exe' : 'pulumicost';
  }
}
