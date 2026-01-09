import * as fs from 'fs';
import * as os from 'os';
import * as core from '@actions/core';
import { Analyzer } from '../../src/analyze.js';

const actualFs = jest.requireActual('fs');
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));
jest.mock('os');
jest.mock('@actions/core');

describe('Analyzer Mode', () => {
  let analyzer: Analyzer;

  beforeEach(() => {
    analyzer = new Analyzer();
    jest.clearAllMocks();
    (os.homedir as jest.Mock).mockReturnValue('/home/user');
  });

  it('should setup analyzer mode correctly', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    await analyzer.setupAnalyzerMode();

    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('.pulumicost/analyzer'), { recursive: true });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('PulumiPolicy.yaml'),
      expect.stringContaining('runtime: pulumicost')
    );
    expect(core.exportVariable).toHaveBeenCalledWith('PULUMI_POLICY_PACK_PATH', expect.any(String));
  });
});
