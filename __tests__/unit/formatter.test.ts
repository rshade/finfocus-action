import { formatCommentBody } from '../../src/formatter.js';
import { PulumicostReport, ActionConfiguration, ActualCostReport } from '../../src/types.js';

describe('formatCommentBody', () => {
  const mockReport: PulumicostReport = {
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
    const reportWithDiff: PulumicostReport = {
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
    const reportWithResources: PulumicostReport = {
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
      carbonIntensity: 2.95,
      equivalents: {
        trees: 2.5,
        milesDriven: 312,
        homeElectricityDays: 42
      }
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
});
