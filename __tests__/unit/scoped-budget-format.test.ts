import { formatScopedBudgetSection, getScopeStatusIcon } from '../../src/formatter.js';
import { ScopedBudgetReport, ScopedBudgetStatus, BudgetHealthStatus } from '../../src/types.js';

describe('getScopeStatusIcon', () => {
  it('should return green circle for healthy status', () => {
    expect(getScopeStatusIcon('healthy')).toBe('🟢');
  });

  it('should return yellow circle for warning status', () => {
    expect(getScopeStatusIcon('warning')).toBe('🟡');
  });

  it('should return red circle for critical status', () => {
    expect(getScopeStatusIcon('critical')).toBe('🔴');
  });

  it('should return stop sign for exceeded status', () => {
    expect(getScopeStatusIcon('exceeded')).toBe('⛔');
  });
});

describe('formatScopedBudgetSection', () => {
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

  describe('provider scopes', () => {
    it('should format provider scope correctly', () => {
      const report: ScopedBudgetReport = {
        scopes: [createScope('provider/aws', 500, 1000, 'healthy')],
        failed: [],
      };

      const result = formatScopedBudgetSection(report, 'USD');

      expect(result).toContain('Budget Status by Scope');
      expect(result).toContain('provider/aws');
      expect(result).toContain('$500.00');
      expect(result).toContain('$1000.00');
      expect(result).toContain('🟢');
      expect(result).toContain('50%');
    });

    it('should format multiple provider scopes', () => {
      const report: ScopedBudgetReport = {
        scopes: [
          createScope('provider/aws', 900, 1000, 'warning'),
          createScope('provider/gcp', 150, 500, 'healthy'),
        ],
        failed: [],
      };

      const result = formatScopedBudgetSection(report, 'USD');

      expect(result).toContain('provider/aws');
      expect(result).toContain('provider/gcp');
      expect(result).toContain('🟡');
      expect(result).toContain('🟢');
    });
  });

  describe('type scopes', () => {
    it('should format type scope correctly', () => {
      const report: ScopedBudgetReport = {
        scopes: [createScope('type/compute', 600, 1200, 'healthy')],
        failed: [],
      };

      const result = formatScopedBudgetSection(report, 'USD');

      expect(result).toContain('type/compute');
      expect(result).toContain('$600.00');
      expect(result).toContain('50%');
    });
  });

  describe('tag scopes', () => {
    it('should format tag scope correctly', () => {
      const report: ScopedBudgetReport = {
        scopes: [createScope('tag/env:prod', 800, 800, 'critical')],
        failed: [],
      };

      const result = formatScopedBudgetSection(report, 'USD');

      expect(result).toContain('tag/env:prod');
      expect(result).toContain('🔴');
      expect(result).toContain('100%');
    });

    it('should handle tag with complex key (tag/k8s:app:nginx)', () => {
      const scope: ScopedBudgetStatus = {
        scope: 'tag/k8s:app:nginx',
        scopeType: 'tag',
        scopeKey: 'k8s:app:nginx',
        spent: 500,
        budget: 1000,
        currency: 'USD',
        percentUsed: 50,
        status: 'healthy',
        alerts: [],
      };

      const report: ScopedBudgetReport = {
        scopes: [scope],
        failed: [],
      };

      const result = formatScopedBudgetSection(report, 'USD');

      expect(result).toContain('tag/k8s:app:nginx');
    });
  });

  describe('status indicators', () => {
    it('should show healthy status for percentUsed < 80', () => {
      const report: ScopedBudgetReport = {
        scopes: [createScope('provider/aws', 500, 1000, 'healthy')],
        failed: [],
      };

      const result = formatScopedBudgetSection(report, 'USD');
      expect(result).toContain('🟢');
    });

    it('should show warning status for percentUsed >= 80 and < 100', () => {
      const report: ScopedBudgetReport = {
        scopes: [createScope('provider/aws', 850, 1000, 'warning')],
        failed: [],
      };

      const result = formatScopedBudgetSection(report, 'USD');
      expect(result).toContain('🟡');
    });

    it('should show critical status for percentUsed >= 100 and < 110', () => {
      const report: ScopedBudgetReport = {
        scopes: [createScope('provider/aws', 1050, 1000, 'critical')],
        failed: [],
      };

      const result = formatScopedBudgetSection(report, 'USD');
      expect(result).toContain('🔴');
    });

    it('should show exceeded status for percentUsed >= 110', () => {
      const report: ScopedBudgetReport = {
        scopes: [createScope('provider/aws', 1200, 1000, 'exceeded')],
        failed: [],
      };

      const result = formatScopedBudgetSection(report, 'USD');
      expect(result).toContain('⛔');
    });
  });

  describe('sorting', () => {
    it('should sort scopes by percentUsed descending', () => {
      const report: ScopedBudgetReport = {
        scopes: [
          createScope('provider/gcp', 150, 500, 'healthy'), // 30%
          createScope('provider/aws', 900, 1000, 'warning'), // 90%
          createScope('type/compute', 600, 1200, 'healthy'), // 50%
        ],
        failed: [],
      };

      const result = formatScopedBudgetSection(report, 'USD');

      // AWS (90%) should appear before compute (50%) and GCP (30%)
      const awsPos = result.indexOf('provider/aws');
      const computePos = result.indexOf('type/compute');
      const gcpPos = result.indexOf('provider/gcp');

      expect(awsPos).toBeLessThan(computePos);
      expect(computePos).toBeLessThan(gcpPos);
    });
  });

  describe('combined scope types', () => {
    it('should display all scope types in single table', () => {
      const report: ScopedBudgetReport = {
        scopes: [
          createScope('provider/aws', 900, 1000, 'warning'),
          createScope('type/compute', 600, 1200, 'healthy'),
          createScope('tag/env:prod', 800, 800, 'critical'),
        ],
        failed: [],
      };

      const result = formatScopedBudgetSection(report, 'USD');

      expect(result).toContain('provider/aws');
      expect(result).toContain('type/compute');
      expect(result).toContain('tag/env:prod');

      // Should be a single table
      const tableHeaderCount = (result.match(/\| Scope \| Spent \| Budget \| Status \|/g) || [])
        .length;
      expect(tableHeaderCount).toBe(1);
    });
  });

  describe('empty and undefined', () => {
    it('should return empty string for undefined report', () => {
      const result = formatScopedBudgetSection(undefined, 'USD');
      expect(result).toBe('');
    });

    it('should return empty string for empty scopes array', () => {
      const report: ScopedBudgetReport = {
        scopes: [],
        failed: [],
      };

      const result = formatScopedBudgetSection(report, 'USD');
      expect(result).toBe('');
    });
  });

  describe('failed scopes', () => {
    it('should show warning for failed scopes', () => {
      const report: ScopedBudgetReport = {
        scopes: [createScope('provider/aws', 500, 1000, 'healthy')],
        failed: [{ scope: 'tag/nonexistent:value', error: 'No resources found' }],
      };

      const result = formatScopedBudgetSection(report, 'USD');

      expect(result).toContain('1 scope(s) failed to process');
      expect(result).toContain('tag/nonexistent:value');
      expect(result).toContain('No resources found');
    });
  });

  describe('currency formatting', () => {
    it('should use USD symbol by default', () => {
      const report: ScopedBudgetReport = {
        scopes: [createScope('provider/aws', 500, 1000, 'healthy')],
        failed: [],
      };

      const result = formatScopedBudgetSection(report);
      expect(result).toContain('$500.00');
    });

    it('should format EUR correctly', () => {
      const scope: ScopedBudgetStatus = {
        ...createScope('provider/aws', 500, 1000, 'healthy'),
        currency: 'EUR',
      };
      const report: ScopedBudgetReport = {
        scopes: [scope],
        failed: [],
      };

      const result = formatScopedBudgetSection(report, 'EUR');
      expect(result).toContain('€500.00');
    });
  });

  describe('no resources found display', () => {
    it('should display $0.00 spent for scope with no resources', () => {
      const scope: ScopedBudgetStatus = {
        scope: 'provider/azure',
        scopeType: 'provider',
        scopeKey: 'azure',
        spent: 0,
        budget: 500,
        currency: 'USD',
        percentUsed: 0,
        status: 'healthy',
        alerts: [],
      };

      const report: ScopedBudgetReport = {
        scopes: [scope],
        failed: [],
      };

      const result = formatScopedBudgetSection(report, 'USD');

      expect(result).toContain('$0.00');
      expect(result).toContain('0%');
    });
  });
});
