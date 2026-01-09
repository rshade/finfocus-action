import * as os from 'os';
import * as tc from '@actions/tool-cache';
import * as core from '@actions/core';
import { Installer } from '../../src/install';

jest.mock('os');
jest.mock('@actions/tool-cache');
jest.mock('@actions/core');

describe('Installer', () => {
  let installer: Installer;

  beforeEach(() => {
    installer = new Installer();
    jest.clearAllMocks();
  });

  it('should detect linux x64 correctly', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    (os.arch as jest.Mock).mockReturnValue('x64');
    (tc.downloadTool as jest.Mock).mockResolvedValue('download-path');
    (tc.extractTar as jest.Mock).mockResolvedValue('extract-path');
    (tc.cacheDir as jest.Mock).mockResolvedValue('cached-path');

    await installer.install('1.0.0');

    expect(tc.downloadTool).toHaveBeenCalledWith(
      expect.stringContaining('pulumicost-v1.0.0-linux-amd64.tar.gz')
    );
  });

  it('should detect win32 arm64 correctly', async () => {
    (os.platform as jest.Mock).mockReturnValue('win32');
    (os.arch as jest.Mock).mockReturnValue('arm64');
    (tc.downloadTool as jest.Mock).mockResolvedValue('download-path');
    (tc.extractTar as jest.Mock).mockResolvedValue('extract-path');
    (tc.cacheDir as jest.Mock).mockResolvedValue('cached-path');

    await installer.install('1.1.0');

    expect(tc.downloadTool).toHaveBeenCalledWith(
      expect.stringContaining('pulumicost-v1.1.0-windows-arm64.tar.gz')
    );
  });

  it('should detect darwin x64 correctly', async () => {
    (os.platform as jest.Mock).mockReturnValue('darwin');
    (os.arch as jest.Mock).mockReturnValue('x64');
    (tc.downloadTool as jest.Mock).mockResolvedValue('download-path');
    (tc.extractTar as jest.Mock).mockResolvedValue('extract-path');
    (tc.cacheDir as jest.Mock).mockResolvedValue('cached-path');

    await installer.install('latest');

    expect(tc.downloadTool).toHaveBeenCalledWith(
      expect.stringContaining('pulumicost-v1.0.0-darwin-amd64.tar.gz')
    );
  });
});
