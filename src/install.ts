import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import * as exec from '@actions/exec';
import { IInstaller } from './types.js';

const REPO_OWNER = 'rshade';
const REPO_NAME = 'pulumicost-core';

export class Installer implements IInstaller {
  async install(version: string): Promise<string> {
    const platform = this.getPlatform();
    const arch = this.getArch();

    core.info(`=== Installer: Starting installation ===`);
    core.info(`  Requested version: ${version}`);
    core.info(`  Detected OS platform: ${os.platform()}`);
    core.info(`  Detected OS arch: ${os.arch()}`);
    core.info(`  Mapped platform: ${platform}`);
    core.info(`  Mapped arch: ${arch}`);

    const resolvedVersion = await this.resolveVersion(version);
    core.info(`  Resolved version: ${resolvedVersion}`);

    core.info(`=== Checking tool cache ===`);
    const cached = tc.find('pulumicost-core', resolvedVersion, arch);
    if (cached) {
      core.info(`  Cache HIT: Found pulumicost at ${cached}`);
      core.addPath(cached);
      const binaryPath = path.join(cached, this.getBinaryName());
      core.info(`  Binary path: ${binaryPath}`);
      core.info(`  Binary exists: ${fs.existsSync(binaryPath)}`);
      await this.verifyInstallation();
      return binaryPath;
    }
    core.info(`  Cache MISS: Will download`);

    const ext = platform === 'windows' ? 'zip' : 'tar.gz';
    const assetName = `pulumicost-core-v${resolvedVersion}-${platform}-${arch}.${ext}`;
    const downloadUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/v${resolvedVersion}/${assetName}`;

    core.info(`=== Download Details ===`);
    core.info(`  Asset name: ${assetName}`);
    core.info(`  Download URL: ${downloadUrl}`);

    let downloadPath: string;
    try {
      core.info(`  Starting download...`);
      const downloadStart = Date.now();
      downloadPath = await tc.downloadTool(downloadUrl);
      core.info(`  Download completed in ${Date.now() - downloadStart}ms`);
      core.info(`  Downloaded to: ${downloadPath}`);
      
      const downloadStats = fs.statSync(downloadPath);
      core.info(`  Downloaded file size: ${downloadStats.size} bytes`);
    } catch (err) {
      core.error(`  Download FAILED`);
      core.error(`  Error type: ${err instanceof Error ? err.name : typeof err}`);
      core.error(`  Error message: ${err instanceof Error ? err.message : String(err)}`);
      if (err instanceof Error && err.stack) {
        core.error(`  Stack: ${err.stack}`);
      }
      throw new Error(
        `Failed to download pulumicost from ${downloadUrl}. ` +
          `Check if version ${resolvedVersion} exists and has ${assetName} asset. ` +
          `Error: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    let extractPath: string;
    try {
      core.info(`=== Extracting archive ===`);
      core.info(`  Archive type: ${ext}`);
      const extractStart = Date.now();
      
      if (platform === 'windows') {
        extractPath = await tc.extractZip(downloadPath);
      } else {
        extractPath = await tc.extractTar(downloadPath);
      }
      
      core.info(`  Extraction completed in ${Date.now() - extractStart}ms`);
      core.info(`  Extracted to: ${extractPath}`);
      
      const extractedFiles = fs.readdirSync(extractPath);
      core.info(`  Extracted files: ${extractedFiles.join(', ')}`);
    } catch (err) {
      core.error(`  Extraction FAILED`);
      core.error(`  Error: ${err instanceof Error ? err.message : String(err)}`);
      throw new Error(
        `Failed to extract pulumicost archive. Error: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    core.info(`=== Caching binary ===`);
    const cachedPath = await tc.cacheDir(extractPath, 'pulumicost-core', resolvedVersion, arch);
    core.info(`  Cached to: ${cachedPath}`);
    core.addPath(cachedPath);
    core.info(`  Added to PATH`);

    const binaryPath = path.join(cachedPath, this.getBinaryName());
    core.info(`  Binary path: ${binaryPath}`);
    core.info(`  Binary exists: ${fs.existsSync(binaryPath)}`);

    if (platform !== 'windows') {
      core.info(`  Setting executable permission...`);
      await exec.exec('chmod', ['+x', binaryPath]);
      core.info(`  chmod +x completed`);
    }

    await this.verifyInstallation();

    core.info(`=== Installation complete ===`);
    core.info(`  Final binary path: ${binaryPath}`);
    return binaryPath;
  }

  private async verifyInstallation(): Promise<void> {
    core.info(`=== Verifying installation ===`);
    try {
      core.info(`  Running: pulumicost --version`);
      const output = await exec.getExecOutput('pulumicost', ['--version'], {
        silent: false,
        ignoreReturnCode: true,
      });
      core.info(`  Exit code: ${output.exitCode}`);
      core.info(`  Stdout: ${output.stdout.trim()}`);
      if (output.stderr) {
        core.info(`  Stderr: ${output.stderr.trim()}`);
      }
      
      if (output.exitCode !== 0) {
        core.warning(`  pulumicost --version returned non-zero exit code: ${output.exitCode}`);
      } else {
        core.info(`  Verification successful`);
      }
    } catch (err) {
      core.warning(`  Verification FAILED`);
      core.warning(`  Error: ${err instanceof Error ? err.message : String(err)}`);
    }
    
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

  private async resolveVersion(version: string): Promise<string> {
    if (version !== 'latest') {
      const cleaned = version.replace(/^v/, '');
      core.info(`  Using specified version: ${cleaned}`);
      return cleaned;
    }

    core.info(`=== Resolving 'latest' version ===`);
    const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
    core.info(`  API URL: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'finfocus-action',
      },
    });

    core.info(`  Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const body = await response.text();
      core.error(`  API response body: ${body.substring(0, 500)}`);
      throw new Error(`Failed to fetch latest release: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { tag_name: string; name?: string };
    core.info(`  Release tag_name: ${data.tag_name}`);
    core.info(`  Release name: ${data.name || '(unnamed)'}`);

    const cleanedVersion = data.tag_name.replace(/^v/, '');
    core.info(`  Cleaned version: ${cleanedVersion}`);
    return cleanedVersion;
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
