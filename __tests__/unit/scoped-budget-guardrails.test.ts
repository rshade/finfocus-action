import { checkScopedBudgetBreach } from '../../src/guardrails.js';
import { ScopedBudgetReport, ScopedBudgetStatus, BudgetHealthStatus } from '../../src/types.js';

describe('checkScopedBudgetBreach', () => {
  const createScope = (
    scope: string,
    spent: number,
    budget: number,
    status: BudgetHealthStatus,
  ): ScopedBudgetStatus => {
    const [scopeType, scopeKey] = scope.split('/');
    return {
      scope,
      scopeType: scopeType as 'provider' | 'type' | 'tag',
      scopeKey,
      spent,
      budget,
      currency: 'USD',
      percentUsed: (spent / budget) * 100,
      status,
      alerts: [],
    };
  };

  describe('when failOnBreach is false', () => {
    it('should return pass when breach check is disabled', () => {
      const report: ScopedBudgetReport = {
        scopes: [createScope('provider/aws', 1200, 1000, 'exceeded')],
        failed: [],
      };

      const result = checkScopedBudgetBreach(report, false);

      expect(result.passed).toBe(true);
      expect(result.severity).toBe('none');
      expect(result.message).toContain('disabled');
    });
  });

  describe('when no breach detected', () => {
    it('should return pass when all scopes are within limits', () => {
      const report: ScopedBudgetReport = {
        scopes: [
          createScope('provider/aws', 500, 1000, 'healthy'),
          createScope('provider/gcp', 150, 500, 'healthy'),
        ],
        failed: [],
      };

      const result = checkScopedBudgetBreach(report, true);

      expect(result.passed).toBe(true);
      expect(result.severity).toBe('none');
      expect(result.message).toContain('All 2 scoped budgets within limits');
    });

    it('should return pass when scope is at warning level but not breached', () => {
      const report: ScopedBudgetReport = {
        scopes: [createScope('provider/aws', 850, 1000, 'warning')],
        failed: [],
      };

      const result = checkScopedBudgetBreach(report, true);

      expect(result.passed).toBe(true);
      expect(result.severity).toBe('none');
    });
  });

  describe('when breach detected', () => {
    it('should fail when scope percentUsed >= 100', () => {
      const report: ScopedBudgetReport = {
        scopes: [createScope('provider/aws', 1000, 1000, 'critical')],
        failed: [],
      };

      const result = checkScopedBudgetBreach(report, true);

      expect(result.passed).toBe(false);
      expect(result.message).toContain('Budget exceeded for scopes: provider/aws');
    });

    it('should fail when scope status is exceeded', () => {
      const report: ScopedBudgetReport = {
        scopes: [createScope('provider/aws', 1200, 1000, 'exceeded')],
        failed: [],
      };

      const result = checkScopedBudgetBreach(report, true);

      expect(result.passed).toBe(false);
      expect(result.severity).toBe('exceeded');
      expect(result.message).toContain('provider/aws');
    });

    it('should fail when scope status is critical', () => {
      const report: ScopedBudgetReport = {
        scopes: [createScope('provider/aws', 1050, 1000, 'critical')],
        failed: [],
      };

      const result = checkScopedBudgetBreach(report, true);

      expect(result.passed).toBe(false);
      expect(result.severity).toBe('critical');
    });

    it('should include all breached scope names in message', () => {
      const report: ScopedBudgetReport = {
        scopes: [
          createScope('provider/aws', 1100, 1000, 'exceeded'),
          createScope('provider/gcp', 600, 500, 'critical'),
          createScope('type/compute', 500, 1000, 'healthy'),
        ],
        failed: [],
      };

      const result = checkScopedBudgetBreach(report, true);

      expect(result.passed).toBe(false);
      expect(result.message).toContain('provider/aws');
      expect(result.message).toContain('provider/gcp');
      expect(result.message).not.toContain('type/compute');
    });

    it('should use exceeded severity when any scope is exceeded', () => {
      const report: ScopedBudgetReport = {
        scopes: [
          createScope('provider/aws', 1100, 1000, 'exceeded'),
          createScope('provider/gcp', 550, 500, 'critical'),
        ],
        failed: [],
      };

      const result = checkScopedBudgetBreach(report, true);

      expect(result.severity).toBe('exceeded');
    });

    it('should use critical severity when worst is critical', () => {
      const report: ScopedBudgetReport = {
        scopes: [
          createScope('provider/aws', 1050, 1000, 'critical'),
          createScope('provider/gcp', 400, 500, 'healthy'),
        ],
        failed: [],
      };

      const result = checkScopedBudgetBreach(report, true);

      expect(result.severity).toBe('critical');
    });
  });

  describe('with undefined or empty report', () => {
    it('should return pass for undefined report', () => {
      const result = checkScopedBudgetBreach(undefined, true);

      expect(result.passed).toBe(true);
      expect(result.message).toContain('No scoped budget data available');
    });

    it('should return pass for empty scopes array', () => {
      const report: ScopedBudgetReport = {
        scopes: [],
        failed: [],
      };

      const result = checkScopedBudgetBreach(report, true);

      expect(result.passed).toBe(true);
      expect(result.message).toContain('All 0 scoped budgets within limits');
    });
  });

  describe('with failed scopes', () => {
    it('should exclude failed scopes from breach evaluation', () => {
      const report: ScopedBudgetReport = {
        scopes: [createScope('provider/aws', 500, 1000, 'healthy')],
        failed: [{ scope: 'tag/invalid:scope', error: 'No resources found' }],
      };

      const result = checkScopedBudgetBreach(report, true);

      expect(result.passed).toBe(true);
      // Failed scopes should not be counted in breach evaluation
    });

    it('should still detect breach in non-failed scopes', () => {
      const report: ScopedBudgetReport = {
        scopes: [createScope('provider/aws', 1200, 1000, 'exceeded')],
        failed: [{ scope: 'tag/invalid:scope', error: 'No resources found' }],
      };

      const result = checkScopedBudgetBreach(report, true);

      expect(result.passed).toBe(false);
      expect(result.message).toContain('provider/aws');
    });
  });

  describe('type scope breach', () => {
    it('should detect breach in type scopes', () => {
      const report: ScopedBudgetReport = {
        scopes: [createScope('type/compute', 250, 200, 'exceeded')],
        failed: [],
      };

      const result = checkScopedBudgetBreach(report, true);

      expect(result.passed).toBe(false);
      expect(result.message).toContain('type/compute');
    });
  });

  describe('tag scope breach', () => {
    it('should detect breach in tag scopes', () => {
      const report: ScopedBudgetReport = {
        scopes: [createScope('tag/env:prod', 1100, 1000, 'exceeded')],
        failed: [],
      };

      const result = checkScopedBudgetBreach(report, true);

      expect(result.passed).toBe(false);
      expect(result.message).toContain('tag/env:prod');
    });
  });
});
