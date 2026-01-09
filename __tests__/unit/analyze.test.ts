import * as exec from '@actions/exec';
import { Analyzer } from '../../src/analyze';

jest.mock('@actions/exec');
// Removed global fs mock as it breaks @actions/exec internals

describe('Analyzer', () => {
  let analyzer: Analyzer;

  beforeEach(() => {
    analyzer = new Analyzer();
    jest.clearAllMocks();
  });

  it('should run analysis and return report', async () => {
    const mockReport = {
      projected_monthly_cost: 120.50,
      currency: 'USD',
      diff: {
        monthly_cost_change: 10.00,
        percent_change: 8.33
      }
    };

    (exec.getExecOutput as jest.Mock).mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify(mockReport),
      stderr: ''
    });

    const report = await analyzer.runAnalysis('plan.json');

    expect(exec.getExecOutput).toHaveBeenCalledWith('pulumicost', [
      'cost',
      'projected',
      '--pulumi-json',
      'plan.json',
      '--output',
      'json'
    ]);
    expect(report).toEqual(mockReport);
  });

  it('should throw error if exec fails', async () => {
    (exec.getExecOutput as jest.Mock).mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'error'
    });

    await expect(analyzer.runAnalysis('plan.json')).rejects.toThrow('pulumicost analysis failed');
  });
});
