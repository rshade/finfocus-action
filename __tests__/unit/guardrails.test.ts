import { checkThreshold } from '../../src/guardrails.js';
import * as core from '@actions/core';

jest.mock('@actions/core');

describe('Guardrails', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return false if threshold is null', () => {
    expect(checkThreshold(null, 100, 'USD')).toBe(false);
  });

  it('should return true if cost increase exceeds threshold', () => {
    expect(checkThreshold('50USD', 100, 'USD')).toBe(true);
  });

  it('should return false if cost increase is within threshold', () => {
    expect(checkThreshold('150USD', 100, 'USD')).toBe(false);
  });

  it('should warn and return false for malformed threshold', () => {
    expect(checkThreshold('invalid', 100, 'USD')).toBe(false);
    expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('Malformed threshold'));
  });

  it('should warn and return false for currency mismatch', () => {
    expect(checkThreshold('50EUR', 100, 'USD')).toBe(false);
    expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('Currency mismatch'));
  });
});
