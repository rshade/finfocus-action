import { formatCommentBody, calculateAchievableSavings } from '../../src/formatter.js';
import { FinfocusReport, ActionConfiguration, ActualCostReport, BudgetHealthReport, Recommendation } from '../../src/types.js';

describe('formatCommentBody', () => {
  const mockReport: FinfocusReport = {
    summary: {
      totalMonthly: 100.5,
      currency: 'USD',
      byProvider: { aws: 75.25, gcp: 25.25 },
    },
  };

  describe('Dashboard Summary', () => {
    it('should display 3-column dashboard summary table', () => {
      const result = formatCommentBody(mockReport);

      expect(result).toContain('💰 Monthly Cost');
      expect(result).toContain('📊 Budget Status');
      expect(result).toContain('💡 Potential Savings');
      expect(result).toContain('**$100.50** USD');
    });

    it('should show budget percentage in dashboard when budget configured', () => {
      const budgetStatus = {
        configured: true,
        amount: 200.0,
        currency: 'USD',
        period: 'monthly',
        spent: 100.5,
        remaining: 99.5,
        percentUsed: 50.25,
        alerts: [],
      };

      const result = formatCommentBody(mockReport, undefined, undefined, undefined, undefined, budgetStatus);

      expect(result).toContain('**50%** used');
      expect(result).toContain('🟡'); // 50% shows yellow
    });

    it('should show green status when budget usage below 50%', () => {
      const budgetStatus = {
        configured: true,
        amount: 500.0,
        currency: 'USD',
        period: 'monthly',
        spent: 100.5,
        remaining: 399.5,
        percentUsed: 20.1,
        alerts: [],
      };

      const result = formatCommentBody(mockReport, undefined, undefined, undefined, undefined, budgetStatus);

      expect(result).toContain('🟢');
      expect(result).toContain('**20%** used');
    });

    it('should show red status when budget usage 80-99%', () => {
      const budgetStatus = {
        configured: true,
        amount: 120.0,
        currency: 'USD',
        period: 'monthly',
        spent: 100.5,
        remaining: 19.5,
        percentUsed: 83.75,
        alerts: [],
      };

      const result = formatCommentBody(mockReport, undefined, undefined, undefined, undefined, budgetStatus);

      expect(result).toContain('🔴');
      expect(result).toContain('**84%** used');
    });

    it('should show stop sign when budget exceeded', () => {
      const budgetStatus = {
        configured: true,
        amount: 80.0,
        currency: 'USD',
        period: 'monthly',
        spent: 100.5,
        remaining: -20.5,
        percentUsed: 125.625,
        alerts: [],
      };

      const result = formatCommentBody(mockReport, undefined, undefined, undefined, undefined, budgetStatus);

      expect(result).toContain('⛔');
      expect(result).toContain('**126%** used');
    });

    it('should show potential savings in dashboard when recommendations available', () => {
      const recommendations = {
        summary: {
          total_savings: 23.21,
          currency: 'USD',
        },
        recommendations: [
          {
            resource_id: 'test-resource',
            description: 'Resize instance',
            estimated_savings: 23.21,
            currency: 'USD',
          },
        ],
      };

      const result = formatCommentBody(mockReport, undefined, recommendations);

      expect(result).toContain('**$23.21**/mo');
    });

    it('should show dash when no budget or savings data', () => {
      const result = formatCommentBody(mockReport);

      // Budget column should show dash
      expect(result).toMatch(/📊 Budget Status.*\n.*\n.*—/);
      // Savings column should show dash
      expect(result).toMatch(/💡 Potential Savings.*\n.*\n.*—/);
    });
  });

  it('should format basic cost estimate without actual costs', () => {
    const result = formatCommentBody(mockReport);

    expect(result).toContain('## Cloud Cost Estimate');
    expect(result).toContain('Projected Monthly');
    expect(result).toContain('100.50 USD');
    // Multiple providers should show Cost by Provider section
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
    expect(result).toContain('Actual Costs');
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
    expect(result).not.toContain('Actual Costs');
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

    expect(result).toContain('Top Resources');
    expect(result).toContain('Instance');
    expect(result).toContain('Bucket');
    expect(result).toContain('50.00 USD');
    expect(result).toContain('25.25 USD');
  });

  it('should include sustainability impact section when enabled', () => {
    const sustainabilityReport = {
      totalCO2e: 125.5,
      totalCO2eDiff: 15.2,
      carbonIntensity: 2.95,
    };

    const config: ActionConfiguration = {
      includeSustainability: true,
      sustainabilityEquivalents: true,
    } as ActionConfiguration;

    const result = formatCommentBody(mockReport, config, undefined, undefined, sustainabilityReport);

    expect(result).toContain('Sustainability');
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

  describe('Budget Status Display', () => {
    it('should use GitHub alert syntax when budget is configured', () => {
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

      // Should use GitHub alert syntax
      expect(result).toContain('[!');
      expect(result).toContain('Budget');
      expect(result).toContain('$1000.00/monthly');
      expect(result).toContain('$850.00');
      expect(result).toContain('85%');
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
      expect(result).toContain('▓'); // Filled blocks
      expect(result).toContain('░'); // Empty blocks
      expect(result).toContain('85%');
    });

    it('should show WARNING alert type when budget usage exceeds 80%', () => {
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

      expect(result).toContain('[!WARNING]');
      expect(result).toContain('Budget Warning');
    });

    it('should show CAUTION alert type when budget is exceeded', () => {
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

      expect(result).toContain('[!CAUTION]');
      expect(result).toContain('Budget Exceeded');
    });

    it('should show NOTE alert type when budget usage is below 80%', () => {
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

      expect(result).toContain('[!NOTE]');
      expect(result).not.toContain('Budget Warning');
      expect(result).not.toContain('Budget Exceeded');
    });

    it('should not include budget alert section when budget is not configured', () => {
      const budgetStatus = {
        configured: false,
      };

      const result = formatCommentBody(mockReport, undefined, undefined, undefined, undefined, budgetStatus);

      // Dashboard header "📊 Budget Status" will always be present, but no alert block
      expect(result).not.toContain('[!NOTE]');
      expect(result).not.toContain('[!WARNING]');
      expect(result).not.toContain('[!CAUTION]');
      // Dashboard should show dash for budget
      expect(result).toMatch(/📊 Budget Status.*\n.*\n.*—/);
    });

    it('should not include budget section when budgetStatus is undefined', () => {
      const result = formatCommentBody(mockReport);

      // No budget-related alert blocks
      expect(result).not.toMatch(/>\s*\[!/);
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

      expect(result).toContain('80% actual threshold exceeded');
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

      expect(result).toContain('Budget Health');
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
      expect(result).toContain('Exceeded');
    });

    it('should display forecast when showBudgetForecast is true (default)', () => {
      const config: ActionConfiguration = {
        showBudgetForecast: true,
      } as ActionConfiguration;

      const result = formatCommentBody(mockReport, config, undefined, undefined, undefined, undefined, baseBudgetHealth);

      expect(result).toContain('Forecast');
      expect(result).toContain('$1,890.00');
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

      expect(result).toContain('Runway');
      expect(result).toContain('12 days');
    });

    it('should use GitHub alert syntax with progress bar', () => {
      const result = formatCommentBody(mockReport, undefined, undefined, undefined, undefined, undefined, baseBudgetHealth);

      // Should use GitHub alert syntax
      expect(result).toContain('[!NOTE]');
      expect(result).toContain('▓'); // Filled blocks
      expect(result).toContain('░'); // Empty blocks
    });

    it('should use WARNING alert type when health status is warning', () => {
      const warningHealth: BudgetHealthReport = {
        ...baseBudgetHealth,
        healthStatus: 'warning',
      };

      const result = formatCommentBody(mockReport, undefined, undefined, undefined, undefined, undefined, warningHealth);

      expect(result).toContain('[!WARNING]');
    });

    it('should not show warning when health status is healthy', () => {
      const result = formatCommentBody(mockReport, undefined, undefined, undefined, undefined, undefined, baseBudgetHealth);

      expect(result).not.toContain('[!WARNING]');
      expect(result).not.toContain('[!CAUTION]');
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

      // Should show Budget Health (from BudgetHealthReport), not Budget Status (from BudgetStatus)
      expect(result).toContain('Budget Health');
      expect(result).toContain('85/100');
    });
  });
});

describe('calculateAchievableSavings', () => {
  it('should return 0 for empty recommendations array', () => {
    expect(calculateAchievableSavings([])).toBe(0);
  });

  it('should return 0 for undefined recommendations', () => {
    expect(calculateAchievableSavings(undefined as unknown as Recommendation[])).toBe(0);
  });

  it('should sum savings when all recommendations are for different resources', () => {
    const recommendations: Recommendation[] = [
      { resource_id: 'ec2-instance-1', action_type: 'RIGHTSIZING', description: 'Resize', estimated_savings: 50, currency: 'USD' },
      { resource_id: 'ebs-volume-1', action_type: 'DELETE', description: 'Delete unused', estimated_savings: 20, currency: 'USD' },
    ];

    expect(calculateAchievableSavings(recommendations)).toBe(70);
  });

  it('should take max savings when multiple options exist for same resource+action_type', () => {
    // Same resource, same action type = mutually exclusive options
    const recommendations: Recommendation[] = [
      { resource_id: 'ec2-instance-1', action_type: 'RIGHTSIZING', description: 'Resize to medium', estimated_savings: 50, currency: 'USD' },
      { resource_id: 'ec2-instance-1', action_type: 'RIGHTSIZING', description: 'Resize to small', estimated_savings: 80, currency: 'USD' },
    ];

    // Should be max(50, 80) = 80, not 50 + 80 = 130
    expect(calculateAchievableSavings(recommendations)).toBe(80);
  });

  it('should handle mixed scenarios correctly (issue example)', () => {
    // Example from the GitHub issue:
    // EC2 has two RIGHTSIZING options (mutually exclusive): $50 and $80
    // EBS has one DELETE option: $20
    // Wrong calculation: $50 + $80 + $20 = $150
    // Correct calculation: max($50, $80) + $20 = $100
    const recommendations: Recommendation[] = [
      { resource_id: 'ec2-instance-1', action_type: 'RIGHTSIZING', description: 'Resize large → medium', estimated_savings: 50, currency: 'USD' },
      { resource_id: 'ec2-instance-1', action_type: 'RIGHTSIZING', description: 'Resize large → small', estimated_savings: 80, currency: 'USD' },
      { resource_id: 'ebs-volume-unused', action_type: 'DELETE', description: 'Remove unused EBS volume', estimated_savings: 20, currency: 'USD' },
    ];

    expect(calculateAchievableSavings(recommendations)).toBe(100);
  });

  it('should allow same resource with different action types to sum', () => {
    // Same resource, different action types = NOT mutually exclusive
    const recommendations: Recommendation[] = [
      { resource_id: 'ec2-instance-1', action_type: 'RIGHTSIZING', description: 'Resize to small', estimated_savings: 50, currency: 'USD' },
      { resource_id: 'ec2-instance-1', action_type: 'SCHEDULING', description: 'Stop during off-hours', estimated_savings: 30, currency: 'USD' },
    ];

    // Different action types should sum: 50 + 30 = 80
    expect(calculateAchievableSavings(recommendations)).toBe(80);
  });

  it('should handle multiple groups with multiple options each', () => {
    const recommendations: Recommendation[] = [
      // Group 1: ec2-1 + RIGHTSIZING (3 options)
      { resource_id: 'ec2-1', action_type: 'RIGHTSIZING', description: 'Option A', estimated_savings: 10, currency: 'USD' },
      { resource_id: 'ec2-1', action_type: 'RIGHTSIZING', description: 'Option B', estimated_savings: 25, currency: 'USD' },
      { resource_id: 'ec2-1', action_type: 'RIGHTSIZING', description: 'Option C', estimated_savings: 15, currency: 'USD' },
      // Group 2: rds-1 + RIGHTSIZING (2 options)
      { resource_id: 'rds-1', action_type: 'RIGHTSIZING', description: 'Option A', estimated_savings: 100, currency: 'USD' },
      { resource_id: 'rds-1', action_type: 'RIGHTSIZING', description: 'Option B', estimated_savings: 75, currency: 'USD' },
      // Group 3: ebs-1 + DELETE (1 option)
      { resource_id: 'ebs-1', action_type: 'DELETE', description: 'Delete', estimated_savings: 5, currency: 'USD' },
    ];

    // max(10,25,15) + max(100,75) + 5 = 25 + 100 + 5 = 130
    expect(calculateAchievableSavings(recommendations)).toBe(130);
  });
});

describe('Dashboard Achievable Savings', () => {
  const mockReport: FinfocusReport = {
    summary: {
      totalMonthly: 100.5,
      totalHourly: 0.14,
      currency: 'USD',
    },
  };

  it('should show achievable savings (max per group) in dashboard, not raw total', () => {
    // Issue example: raw total would be $150, achievable is $100
    const recommendations = {
      summary: {
        total_count: 3,
        total_savings: 150, // Raw sum: 50 + 80 + 20
        currency: 'USD',
        count_by_action_type: { RIGHTSIZING: 2, DELETE: 1 },
      },
      recommendations: [
        { resource_id: 'ec2-instance-1', action_type: 'RIGHTSIZING', description: 'Resize to medium', estimated_savings: 50, currency: 'USD' },
        { resource_id: 'ec2-instance-1', action_type: 'RIGHTSIZING', description: 'Resize to small', estimated_savings: 80, currency: 'USD' },
        { resource_id: 'ebs-volume-unused', action_type: 'DELETE', description: 'Remove unused', estimated_savings: 20, currency: 'USD' },
      ],
    };

    const result = formatCommentBody(mockReport, undefined, recommendations);

    // Dashboard should show achievable savings ($100), not raw total ($150)
    expect(result).toContain('**$100.00**/mo');
    // But recommendations section should still show "up to" raw total
    expect(result).toContain('Save up to <strong>150.00 USD/mo</strong>');
  });

  it('should show same value when no mutually exclusive options exist', () => {
    const recommendations = {
      summary: {
        total_count: 2,
        total_savings: 70, // 50 + 20, no mutually exclusive options
        currency: 'USD',
        count_by_action_type: { RIGHTSIZING: 1, DELETE: 1 },
      },
      recommendations: [
        { resource_id: 'ec2-instance-1', action_type: 'RIGHTSIZING', description: 'Resize', estimated_savings: 50, currency: 'USD' },
        { resource_id: 'ebs-volume-unused', action_type: 'DELETE', description: 'Remove unused', estimated_savings: 20, currency: 'USD' },
      ],
    };

    const result = formatCommentBody(mockReport, undefined, recommendations);

    // Both dashboard and recommendations section should show $70
    expect(result).toContain('**$70.00**/mo');
    expect(result).toContain('Save up to <strong>70.00 USD/mo</strong>');
  });
});
