import { checkThreshold, checkCarbonThreshold } from '../../src/guardrails.js';
import * as core from '@actions/core';

jest.mock('@actions/core');

describe('Guardrails', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkThreshold', () => {
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

  describe('checkCarbonThreshold', () => {
    it('should return false if threshold is null', () => {
      expect(checkCarbonThreshold(null, 10, 100)).toBe(false);
    });

    it('should return true if absolute carbon increase exceeds threshold', () => {
      expect(checkCarbonThreshold('5kg', 10, 100)).toBe(true);
      expect(checkCarbonThreshold('5kgCO2e', 10, 100)).toBe(true);
    });

    it('should return false if absolute carbon increase is within threshold', () => {
      expect(checkCarbonThreshold('15kg', 10, 100)).toBe(false);
    });

    it('should return true if percent carbon increase exceeds threshold', () => {
      expect(checkCarbonThreshold('5%', 10, 100)).toBe(true);
    });

    it('should return false if percent carbon increase is within threshold', () => {
      expect(checkCarbonThreshold('15%', 10, 100)).toBe(false);
    });

    it('should warn and return false for malformed carbon threshold', () => {
      expect(checkCarbonThreshold('invalid', 10, 100)).toBe(false);
      expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('Malformed carbon threshold'));
    });

    it('should handle zero base total for percent threshold', () => {
      expect(checkCarbonThreshold('10%', 10, 0)).toBe(false);
    });
  });
});
