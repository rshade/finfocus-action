import * as os from 'os';
import * as tc from '@actions/tool-cache';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import { Installer, getFinfocusVersion, supportsExitCodes } from '../../src/install.js';

jest.mock('os');
jest.mock('@actions/tool-cache');
jest.mock('@actions/core');
jest.mock('@actions/exec');
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  statSync: jest.fn(),
  readdirSync: jest.fn(),
  existsSync: jest.fn(),
}));

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
    
    // Mock fs calls
    (fs.statSync as jest.Mock).mockReturnValue({ size: 1000 });
    (fs.readdirSync as jest.Mock).mockReturnValue(['finfocus']);
    (fs.existsSync as jest.Mock).mockReturnValue(true);
  });

  it('should detect linux x64 correctly', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    (os.arch as jest.Mock).mockReturnValue('x64');
    (tc.downloadTool as jest.Mock).mockResolvedValue('download-path');
    (tc.extractTar as jest.Mock).mockResolvedValue('extract-path');
    (tc.cacheDir as jest.Mock).mockResolvedValue('cached-path');

    await installer.install('1.0.0');

    expect(core.addPath).toHaveBeenCalledWith('cached-path');
    expect(tc.extractTar).toHaveBeenCalledWith('download-path');
    expect(exec.exec).toHaveBeenCalledWith('chmod', ['+x', 'cached-path/finfocus'], { silent: true });
  });

  it('should detect win32 arm64 correctly and use zip', async () => {
    (os.platform as jest.Mock).mockReturnValue('win32');
    (os.arch as jest.Mock).mockReturnValue('arm64');
    (tc.downloadTool as jest.Mock).mockResolvedValue('download-path');
    (tc.extractZip as jest.Mock).mockResolvedValue('extract-path');
    (tc.cacheDir as jest.Mock).mockResolvedValue('cached-path');

    await installer.install('1.1.0');

    expect(tc.downloadTool).toHaveBeenCalledWith(
      'https://github.com/rshade/finfocus/releases/download/v1.1.0/finfocus-v1.1.0-windows-arm64.zip'
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
      'https://github.com/rshade/finfocus/releases/download/v1.2.0/finfocus-v1.2.0-macos-amd64.tar.gz'
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
      'https://api.github.com/repos/rshade/finfocus/releases/latest',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/vnd.github.v3+json',
        }),
      })
    );
    expect(tc.downloadTool).toHaveBeenCalledWith(
      'https://github.com/rshade/finfocus/releases/download/v0.1.3/finfocus-v0.1.3-linux-amd64.tar.gz'
    );
  });

  it('should use cached version if available', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    (os.arch as jest.Mock).mockReturnValue('x64');
    (tc.find as jest.Mock).mockReturnValue('/cached/finfocus');

    const result = await installer.install('1.0.0');

    expect(tc.downloadTool).not.toHaveBeenCalled();
    expect(core.addPath).toHaveBeenCalledWith('/cached/finfocus');
    expect(result).toBe('/cached/finfocus/finfocus');
  });
});

describe('getFinfocusVersion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should parse version from "finfocus v0.2.5" format', async () => {
    (exec.getExecOutput as jest.Mock).mockResolvedValue({
      exitCode: 0,
      stdout: 'finfocus v0.2.5',
      stderr: '',
    });

    const version = await getFinfocusVersion();
    expect(version).toBe('0.2.5');
  });

  it('should parse version from "finfocus 0.2.5" format (no v prefix)', async () => {
    (exec.getExecOutput as jest.Mock).mockResolvedValue({
      exitCode: 0,
      stdout: 'finfocus 0.2.5',
      stderr: '',
    });

    const version = await getFinfocusVersion();
    expect(version).toBe('0.2.5');
  });

  it('should return 0.0.0 when version cannot be parsed', async () => {
    (exec.getExecOutput as jest.Mock).mockResolvedValue({
      exitCode: 0,
      stdout: 'finfocus unknown version',
      stderr: '',
    });

    const version = await getFinfocusVersion();
    expect(version).toBe('0.0.0');
  });

  it('should return 0.0.0 when command fails', async () => {
    (exec.getExecOutput as jest.Mock).mockRejectedValue(new Error('Command not found'));

    const version = await getFinfocusVersion();
    expect(version).toBe('0.0.0');
  });

  it('should handle multi-line output', async () => {
    (exec.getExecOutput as jest.Mock).mockResolvedValue({
      exitCode: 0,
      stdout: 'finfocus version 0.3.0\nbuilt at 2026-02-02',
      stderr: '',
    });

    const version = await getFinfocusVersion();
    expect(version).toBe('0.3.0');
  });
});

describe('supportsExitCodes', () => {
  it('should return true for version 0.2.5', () => {
    expect(supportsExitCodes('0.2.5')).toBe(true);
  });

  it('should return true for version 0.2.6 (newer patch)', () => {
    expect(supportsExitCodes('0.2.6')).toBe(true);
  });

  it('should return true for version 0.3.0 (newer minor)', () => {
    expect(supportsExitCodes('0.3.0')).toBe(true);
  });

  it('should return true for version 1.0.0 (newer major)', () => {
    expect(supportsExitCodes('1.0.0')).toBe(true);
  });

  it('should return false for version 0.2.4 (older patch)', () => {
    expect(supportsExitCodes('0.2.4')).toBe(false);
  });

  it('should return false for version 0.1.9 (older minor)', () => {
    expect(supportsExitCodes('0.1.9')).toBe(false);
  });

  it('should return false for version 0.0.0 (fallback version)', () => {
    expect(supportsExitCodes('0.0.0')).toBe(false);
  });
});