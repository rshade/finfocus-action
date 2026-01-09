import * as os from 'os';
import * as tc from '@actions/tool-cache';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { Installer } from '../../src/install.js';

jest.mock('os');
jest.mock('@actions/tool-cache');
jest.mock('@actions/core');
jest.mock('@actions/exec');

global.fetch = jest.fn();

describe('Installer', () => {
  let installer: Installer;

  beforeEach(() => {
    installer = new Installer();
    jest.clearAllMocks();
    (tc.find as jest.Mock).mockReturnValue('');
    (exec.exec as jest.Mock).mockResolvedValue(0);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ tag_name: 'v0.1.3' }),
    });
  });

  it('should detect linux x64 correctly', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    (os.arch as jest.Mock).mockReturnValue('x64');
    (tc.downloadTool as jest.Mock).mockResolvedValue('download-path');
    (tc.extractTar as jest.Mock).mockResolvedValue('extract-path');
    (tc.cacheDir as jest.Mock).mockResolvedValue('cached-path');

    await installer.install('1.0.0');

    expect(tc.downloadTool).toHaveBeenCalledWith(
      'https://github.com/rshade/pulumicost-core/releases/download/v1.0.0/pulumicost-core-v1.0.0-linux-amd64.tar.gz'
    );
    expect(tc.extractTar).toHaveBeenCalledWith('download-path');
    expect(exec.exec).toHaveBeenCalledWith('chmod', ['+x', 'cached-path/pulumicost']);
  });

  it('should detect win32 arm64 correctly and use zip', async () => {
    (os.platform as jest.Mock).mockReturnValue('win32');
    (os.arch as jest.Mock).mockReturnValue('arm64');
    (tc.downloadTool as jest.Mock).mockResolvedValue('download-path');
    (tc.extractZip as jest.Mock).mockResolvedValue('extract-path');
    (tc.cacheDir as jest.Mock).mockResolvedValue('cached-path');

    await installer.install('1.1.0');

    expect(tc.downloadTool).toHaveBeenCalledWith(
      'https://github.com/rshade/pulumicost-core/releases/download/v1.1.0/pulumicost-core-v1.1.0-windows-arm64.zip'
    );
    expect(tc.extractZip).toHaveBeenCalledWith('download-path');
    expect(exec.exec).not.toHaveBeenCalled();
  });

  it('should detect darwin x64 correctly', async () => {
    (os.platform as jest.Mock).mockReturnValue('darwin');
    (os.arch as jest.Mock).mockReturnValue('x64');
    (tc.downloadTool as jest.Mock).mockResolvedValue('download-path');
    (tc.extractTar as jest.Mock).mockResolvedValue('extract-path');
    (tc.cacheDir as jest.Mock).mockResolvedValue('cached-path');

    await installer.install('1.2.0');

    expect(tc.downloadTool).toHaveBeenCalledWith(
      'https://github.com/rshade/pulumicost-core/releases/download/v1.2.0/pulumicost-core-v1.2.0-macos-amd64.tar.gz'
    );
  });

  it('should resolve latest version from GitHub API', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    (os.arch as jest.Mock).mockReturnValue('x64');
    (tc.downloadTool as jest.Mock).mockResolvedValue('download-path');
    (tc.extractTar as jest.Mock).mockResolvedValue('extract-path');
    (tc.cacheDir as jest.Mock).mockResolvedValue('cached-path');

    await installer.install('latest');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/rshade/pulumicost-core/releases/latest',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/vnd.github.v3+json',
        }),
      })
    );
    expect(tc.downloadTool).toHaveBeenCalledWith(
      'https://github.com/rshade/pulumicost-core/releases/download/v0.1.3/pulumicost-core-v0.1.3-linux-amd64.tar.gz'
    );
  });

  it('should use cached version if available', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    (os.arch as jest.Mock).mockReturnValue('x64');
    (tc.find as jest.Mock).mockReturnValue('/cached/pulumicost-core');

    const result = await installer.install('1.0.0');

    expect(tc.downloadTool).not.toHaveBeenCalled();
    expect(core.addPath).toHaveBeenCalledWith('/cached/pulumicost-core');
    expect(result).toBe('/cached/pulumicost-core/pulumicost');
  });
});
