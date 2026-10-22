import { projectMonthlyCost } from '../../src/forecast.js';

describe('projectMonthlyCost', () => {
  it('holds the current total when the growth rate is 0', () => {
    expect(projectMonthlyCost(7.59, 0, 3, 'linear')).toBeCloseTo(7.59, 5);
    expect(projectMonthlyCost(7.59, 0, 3, 'exponential')).toBeCloseTo(7.59, 5);
    expect(projectMonthlyCost(7.59, 0, 3, 'average')).toBeCloseTo(7.59, 5);
  });

  it('applies linear, exponential, and average growth', () => {
    expect(projectMonthlyCost(100, 0.1, 3, 'linear')).toBeCloseTo(130, 5);
    expect(projectMonthlyCost(100, 0.1, 3, 'exponential')).toBeCloseTo(133.1, 5);
    expect(projectMonthlyCost(100, 0.1, 6, 'average')).toBeCloseTo(110, 5);
  });
});
