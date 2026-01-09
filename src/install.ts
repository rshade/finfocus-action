import * as os from 'os';
import * as path from 'path';
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

    core.info(`Installing pulumicost version ${version} for ${platform}/${arch}`);
    core.debug(`Detected platform: ${os.platform()}, arch: ${os.arch()}`);
    core.debug(`Mapped to: ${platform}/${arch}`);

    const resolvedVersion = await this.resolveVersion(version);
    core.info(`Resolved version: ${resolvedVersion}`);

    const cached = tc.find('pulumicost-core', resolvedVersion, arch);
    if (cached) {
      core.info(`Cache hit: Found pulumicost at ${cached}`);
      core.addPath(cached);
      return path.join(cached, this.getBinaryName());
    }
    core.debug('Cache miss, downloading...');

    const ext = platform === 'windows' ? 'zip' : 'tar.gz';
    const assetName = `pulumicost-core-v${resolvedVersion}-${platform}-${arch}.${ext}`;
    const downloadUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/v${resolvedVersion}/${assetName}`;

    core.info(`Downloading from ${downloadUrl}`);

    let downloadPath: string;
    try {
      downloadPath = await tc.downloadTool(downloadUrl);
      core.debug(`Downloaded to: ${downloadPath}`);
    } catch (err) {
      throw new Error(
        `Failed to download pulumicost from ${downloadUrl}. ` +
          `Check if version ${resolvedVersion} exists and has ${assetName} asset. ` +
          `Error: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    let extractPath: string;
    try {
      if (platform === 'windows') {
        extractPath = await tc.extractZip(downloadPath);
      } else {
        extractPath = await tc.extractTar(downloadPath);
      }
      core.debug(`Extracted to: ${extractPath}`);
    } catch (err) {
      throw new Error(
        `Failed to extract pulumicost archive. Error: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    const cachedPath = await tc.cacheDir(extractPath, 'pulumicost-core', resolvedVersion, arch);
    core.debug(`Cached to: ${cachedPath}`);
    core.addPath(cachedPath);

    const binaryPath = path.join(cachedPath, this.getBinaryName());
    core.debug(`Binary path: ${binaryPath}`);

    if (platform !== 'windows') {
      await exec.exec('chmod', ['+x', binaryPath]);
    }

    await this.verifyInstallation();

    core.info(`Successfully installed pulumicost to ${binaryPath}`);
    return binaryPath;
  }

  private async verifyInstallation(): Promise<void> {
    try {
      const output = await exec.getExecOutput('pulumicost', ['--version'], {
        silent: true,
      });
      core.debug(`pulumicost --version output: ${output.stdout.trim()}`);
    } catch (err) {
      core.warning(
        `Could not verify pulumicost installation: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  private async resolveVersion(version: string): Promise<string> {
    if (version !== 'latest') {
      return version.replace(/^v/, '');
    }

    core.info('Fetching latest release version...');

    const response = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
      {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'finfocus-action',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch latest release: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { tag_name: string };
    const tagName = data.tag_name;

    return tagName.replace(/^v/, '');
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
