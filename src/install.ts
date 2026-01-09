import * as os from 'os';
import * as path from 'path';
import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import { IInstaller } from './types';

export class Installer implements IInstaller {
  async install(version: string): Promise<string> {
    const platform = this.getPlatform();
    const arch = this.getArch();
    
    core.info(`Installing pulumicost version ${version} for ${platform}/${arch}`);

    // If version is latest, we might need to resolve it. 
    // For now, assume the user provides a version or we use a hardcoded default if 'latest'
    const resolvedVersion = version === 'latest' ? '1.0.0' : version; 

    const downloadUrl = `https://github.com/rshade/finfocus-action/releases/download/v${resolvedVersion}/pulumicost-v${resolvedVersion}-${platform}-${arch}.tar.gz`;

    core.info(`Downloading from ${downloadUrl}`);
    
    const downloadPath = await tc.downloadTool(downloadUrl);
    const extractPath = await tc.extractTar(downloadPath);
    
    const cachedPath = await tc.cacheDir(extractPath, 'pulumicost', resolvedVersion);
    core.addPath(cachedPath);
    
    return path.join(cachedPath, 'pulumicost');
  }

  private getPlatform(): string {
    const p = os.platform();
    if (p === 'win32') return 'windows';
    return p;
  }

  private getArch(): string {
    const a = os.arch();
    if (a === 'x64') return 'amd64';
    return a;
  }
}
