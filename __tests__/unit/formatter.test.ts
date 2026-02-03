import { formatCommentBody } from '../../src/formatter.js';
import { FinfocusReport, ActionConfiguration, ActualCostReport, BudgetHealthReport } from '../../src/types.js';

describe('formatCommentBody', () => {
  const mockReport: FinfocusReport = {
    summary: {
      totalMonthly: 100.5,
      currency: 'USD',
      byProvider: { aws: 75.25, gcp: 25.25 },
    },
  };

  it('should format basic cost estimate without actual costs', () => {
    const result = formatCommentBody(mockReport);

    expect(result).toContain('## 💰 Cloud Cost Estimate');
    expect(result).toContain('Projected Monthly');
    expect(result).toContain('100.50 USD');
    expect(result).toContain('Cost by Provider');
    expect(result).toContain('aws');
    expect(result).toContain('gcp');
  });

  it('should include actual costs when provided', () => {
    const actualReport: ActualCostReport = {
      total: 85.3,
      currency: 'USD',
      startDate: '2025-01-01',
      endDate: '2025-01-08',
      items: [
        { name: 'aws', cost: 65.1, currency: 'USD' },
        { name: 'gcp', cost: 20.2, currency: 'USD' },
      ],
    };

    const config: ActionConfiguration = {
      actualCostsPeriod: '7d',
      actualCostsGroupBy: 'provider',
    } as ActionConfiguration;

    const result = formatCommentBody(mockReport, config, undefined, actualReport);

    expect(result).toContain('Actual (7d)');
    expect(result).toContain('85.30 USD');
    expect(result).toContain('Actual Costs by provider');
    expect(result).toContain('2025-01-01 to 2025-01-08');
  });

  it('should not show actual costs section when total is 0', () => {
    const actualReport: ActualCostReport = {
      total: 0,
      currency: 'USD',
      startDate: '2025-01-01',
      endDate: '2025-01-08',
      items: [],
    };

    const result = formatCommentBody(mockReport, undefined, undefined, actualReport);

    expect(result).not.toContain('Actual');
    expect(result).not.toContain('Actual Costs by');
  });

  it('should handle cost differences correctly', () => {
    const reportWithDiff: FinfocusReport = {
      ...mockReport,
      diff: {
        monthly_cost_change: 15.25,
        percent_change: 15.0,
      },
    };

    const result = formatCommentBody(reportWithDiff);

    expect(result).toContain('📈 +15.25 USD');
    expect(result).toContain('15.00%');
  });

  it('should include resource breakdown when available', () => {
    const reportWithResources: FinfocusReport = {
      ...mockReport,
      resources: [
        {
          resourceType: 'aws:ec2/instance',
          resourceId: 'urn:pulumi:dev::infra::aws:ec2/instance:Instance$i-12345',
          currency: 'USD',
          monthly: 50.0,
          hourly: 0.07,
        },
        {
          resourceType: 'aws:s3/bucket',
          resourceId: 'urn:pulumi:dev::infra::aws:s3/bucket:Bucket$my-bucket',
          currency: 'USD',
          monthly: 25.25,
          hourly: 0.035,
        },
      ],
    };

    const result = formatCommentBody(reportWithResources);

    expect(result).toContain('Top Resources by Cost');
    expect(result).toContain('Instance');
    expect(result).toContain('Bucket');
    expect(result).toContain('50.00 USD');
    expect(result).toContain('25.25 USD');
  });

  it('should include sustainability impact section when enabled', () => {
    const sustainabilityReport = {
      totalCO2e: 125.5,
      totalCO2eDiff: 15.2,
      carbonIntensity: 2.95
    };

    const config: ActionConfiguration = {
      includeSustainability: true,
      sustainabilityEquivalents: true
    } as ActionConfiguration;

    const result = formatCommentBody(mockReport, config, undefined, undefined, sustainabilityReport);

    expect(result).toContain('🌱 Sustainability Impact');
    expect(result).toContain('Carbon Footprint');
    expect(result).toContain('125.50 kgCO₂e/month');
    expect(result).toContain('Carbon Change');
    expect(result).toContain('+15.20 kgCO₂e/month');
    expect(result).toContain('Carbon Intensity');
    expect(result).toContain('2.95 gCO₂e/USD');
    expect(result).toContain('Environmental Equivalents');
    expect(result).toContain('68.45 trees');
    expect(result).toContain('313.75 miles');
  });

  describe('TUI Budget Display', () => {
    it('should include TUI-style budget box when budget is configured', () => {
      const budgetStatus = {
        configured: true,
        amount: 1000.0,
        currency: 'USD',
        period: 'monthly',
        spent: 850.0,
        remaining: 150.0,
        percentUsed: 85.0,
        alerts: [],
      };

      const result = formatCommentBody(mockReport, undefined, undefined, undefined, undefined, budgetStatus);

      // Check for TUI box structure
      expect(result).toContain('```');
      expect(result).toContain('╭');
      expect(result).toContain('╮');
      expect(result).toContain('╰');
      expect(result).toContain('╯');
      expect(result).toContain('│');
      expect(result).toContain('BUDGET STATUS');
      expect(result).toContain('Budget: $1000.00/monthly');
      expect(result).toContain('Current Spend: $850.00 (85.0%)');
    });

    it('should show progress bar with block characters', () => {
      const budgetStatus = {
        configured: true,
        amount: 1000.0,
        currency: 'USD',
        period: 'monthly',
        spent: 850.0,
        remaining: 150.0,
        percentUsed: 85.0,
        alerts: [],
      };

      const result = formatCommentBody(mockReport, undefined, undefined, undefined, undefined, budgetStatus);

      // Check for block characters in progress bar
      expect(result).toContain('█'); // Filled blocks
      expect(result).toContain('░'); // Empty blocks
      expect(result).toContain('85%');
    });

    it('should show WARNING message when budget usage exceeds 80%', () => {
      const budgetStatus = {
        configured: true,
        amount: 1000.0,
        currency: 'USD',
        period: 'monthly',
        spent: 850.0,
        remaining: 150.0,
        percentUsed: 85.0,
        alerts: [],
      };

      const result = formatCommentBody(mockReport, undefined, undefined, undefined, undefined, budgetStatus);

      expect(result).toContain('⚠ WARNING - spend exceeds 80% threshold');
    });

    it('should show CRITICAL message when budget is exceeded', () => {
      const budgetStatus = {
        configured: true,
        amount: 1000.0,
        currency: 'USD',
        period: 'monthly',
        spent: 1050.0,
        remaining: -50.0,
        percentUsed: 105.0,
        alerts: [],
      };

      const result = formatCommentBody(mockReport, undefined, undefined, undefined, undefined, budgetStatus);

      expect(result).toContain('⚠ CRITICAL - budget exceeded');
    });

    it('should not show warning message when budget usage is below 80%', () => {
      const budgetStatus = {
        configured: true,
        amount: 1000.0,
        currency: 'USD',
        period: 'monthly',
        spent: 500.0,
        remaining: 500.0,
        percentUsed: 50.0,
        alerts: [],
      };

      const result = formatCommentBody(mockReport, undefined, undefined, undefined, undefined, budgetStatus);

      expect(result).not.toContain('⚠ WARNING');
      expect(result).not.toContain('⚠ CRITICAL');
    });

    it('should not include budget section when budget is not configured', () => {
      const budgetStatus = {
        configured: false,
      };

      const result = formatCommentBody(mockReport, undefined, undefined, undefined, undefined, budgetStatus);

      expect(result).not.toContain('BUDGET STATUS');
      expect(result).not.toContain('╭');
      expect(result).not.toContain('╮');
    });

    it('should not include budget section when budgetStatus is undefined', () => {
      const result = formatCommentBody(mockReport);

      expect(result).not.toContain('BUDGET STATUS');
      expect(result).not.toContain('╭');
    });

    it('should include alerts when triggered', () => {
      const budgetStatus = {
        configured: true,
        amount: 1000.0,
        currency: 'USD',
        period: 'monthly',
        spent: 850.0,
        remaining: 150.0,
        percentUsed: 85.0,
        alerts: [
          { threshold: 80, type: 'actual', triggered: true },
          { threshold: 50, type: 'projected', triggered: false },
        ],
      };

      const result = formatCommentBody(mockReport, undefined, undefined, undefined, undefined, budgetStatus);

      expect(result).toContain('💰 80% actual threshold exceeded');
      expect(result).not.toContain('50% projected threshold exceeded');
    });

    it('should not show alerts when none are triggered', () => {
      const budgetStatus = {
        configured: true,
        amount: 1000.0,
        currency: 'USD',
        period: 'monthly',
        spent: 400.0,
        remaining: 600.0,
        percentUsed: 40.0,
        alerts: [
          { threshold: 80, type: 'actual', triggered: false },
          { threshold: 50, type: 'projected', triggered: false },
        ],
      };

      const result = formatCommentBody(mockReport, undefined, undefined, undefined, undefined, budgetStatus);

      expect(result).not.toContain('threshold exceeded');
    });
  });

  describe('Budget Health Display (FR-010)', () => {
    const baseBudgetHealth: BudgetHealthReport = {
      configured: true,
      amount: 2000,
      currency: 'USD',
      period: 'monthly',
      spent: 1234.56,
      remaining: 765.44,
      percentUsed: 61.7,
      healthScore: 85,
      forecast: '$1,890.00',
      forecastAmount: 1890,
      runwayDays: 12,
      healthStatus: 'healthy',
    };

    it('should display health score with healthy status icon (green)', () => {
      const result = formatCommentBody(mockReport, undefined, undefined, undefined, undefined, undefined, baseBudgetHealth);

      expect(result).toContain('BUDGET HEALTH');
      expect(result).toContain('🟢');
      expect(result).toContain('85/100');
    });

    it('should display health score with warning status icon (yellow)', () => {
      const warningHealth: BudgetHealthReport = {
        ...baseBudgetHealth,
        healthScore: 65,
        healthStatus: 'warning',
      };

      const result = formatCommentBody(mockReport, undefined, undefined, undefined, undefined, undefined, warningHealth);

      expect(result).toContain('🟡');
      expect(result).toContain('65/100');
    });

    it('should display health score with critical status icon (red)', () => {
      const criticalHealth: BudgetHealthReport = {
        ...baseBudgetHealth,
        healthScore: 35,
        healthStatus: 'critical',
      };

      const result = formatCommentBody(mockReport, undefined, undefined, undefined, undefined, undefined, criticalHealth);

      expect(result).toContain('🔴');
      expect(result).toContain('35/100');
    });

    it('should display health score with exceeded status icon', () => {
      const exceededHealth: BudgetHealthReport = {
        ...baseBudgetHealth,
        healthScore: 0,
        healthStatus: 'exceeded',
        spent: 2200,
        remaining: -200,
        percentUsed: 110,
      };

      const result = formatCommentBody(mockReport, undefined, undefined, undefined, undefined, undefined, exceededHealth);

      expect(result).toContain('⛔');
      expect(result).toContain('exceeded');
    });

    it('should display forecast when showBudgetForecast is true (default)', () => {
      const config: ActionConfiguration = {
        showBudgetForecast: true,
      } as ActionConfiguration;

      const result = formatCommentBody(mockReport, config, undefined, undefined, undefined, undefined, baseBudgetHealth);

      expect(result).toContain('Forecast: $1,890.00');
      expect(result).toContain('end of period');
    });

    it('should hide forecast when showBudgetForecast is false', () => {
      const config: ActionConfiguration = {
        showBudgetForecast: false,
      } as ActionConfiguration;

      const result = formatCommentBody(mockReport, config, undefined, undefined, undefined, undefined, baseBudgetHealth);

      expect(result).not.toContain('Forecast');
    });

    it('should display runway days', () => {
      const result = formatCommentBody(mockReport, undefined, undefined, undefined, undefined, undefined, baseBudgetHealth);

      expect(result).toContain('Runway: 12 days remaining');
    });

    it('should display TUI box with progress bar', () => {
      const result = formatCommentBody(mockReport, undefined, undefined, undefined, undefined, undefined, baseBudgetHealth);

      expect(result).toContain('```');
      expect(result).toContain('╭');
      expect(result).toContain('╮');
      expect(result).toContain('╰');
      expect(result).toContain('╯');
      expect(result).toContain('█');
      expect(result).toContain('░');
    });

    it('should show alert when percentUsed exceeds budgetAlertThreshold', () => {
      const config: ActionConfiguration = {
        budgetAlertThreshold: 60,
      } as ActionConfiguration;

      const result = formatCommentBody(mockReport, config, undefined, undefined, undefined, undefined, baseBudgetHealth);

      expect(result).toContain('⚠ WARNING');
      expect(result).toContain('60%');
    });

    it('should not show alert when percentUsed is below budgetAlertThreshold', () => {
      const config: ActionConfiguration = {
        budgetAlertThreshold: 80,
      } as ActionConfiguration;

      const lowUsageHealth: BudgetHealthReport = {
        ...baseBudgetHealth,
        percentUsed: 50,
        healthStatus: 'healthy',
      };

      const result = formatCommentBody(mockReport, config, undefined, undefined, undefined, undefined, lowUsageHealth);

      expect(result).not.toContain('⚠ WARNING');
    });

    it('should prefer BudgetHealthReport over BudgetStatus when both provided', () => {
      const budgetStatus = {
        configured: true,
        amount: 1000,
        currency: 'USD',
        period: 'monthly',
        spent: 500,
        remaining: 500,
        percentUsed: 50,
      };

      const result = formatCommentBody(mockReport, undefined, undefined, undefined, undefined, budgetStatus, baseBudgetHealth);

      // Should show BUDGET HEALTH (from BudgetHealthReport), not BUDGET STATUS (from BudgetStatus)
      expect(result).toContain('BUDGET HEALTH');
      expect(result).toContain('85/100');
    });
  });
});
