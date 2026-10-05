import {
  annotateReportFromPlan,
  filterArgs,
  formatDisplaySections,
  parseGroupBy,
  parseMaxResourcesDisplayed,
  parseMinCostThreshold,
  parseResourceFilters,
  parseSortBy,
  providerOf,
  selectResources,
  serviceOf,
} from '../../src/display.js';
import { ActionConfiguration, FinfocusReport, FinfocusResource } from '../../src/types.js';

function resource(
  partial: Partial<FinfocusResource> & Pick<FinfocusResource, 'resourceId'>,
): FinfocusResource {
  return {
    resourceType: 'aws:ec2/instance:Instance',
    resourceId: partial.resourceId,
    adapter: 'aws-public',
    currency: 'USD',
    monthly: 10,
    hourly: 0.01,
    ...partial,
  };
}

function config(partial: Partial<ActionConfiguration> = {}): ActionConfiguration {
  return {
    pulumiPlanJsonPath: 'plan.json',
    githubToken: '',
    finfocusVersion: 'latest',
    installPlugins: [],
    behaviorOnError: 'fail',
    postComment: false,
    threshold: null,
    analyzerMode: false,
    detailedComment: false,
    includeRecommendations: true,
    logLevel: 'error',
    debug: false,
    includeActualCosts: false,
    actualCostsPeriod: '7d',
    pulumiStateJsonPath: '',
    actualCostsGroupBy: 'provider',
    includeSustainability: true,
    utilizationRate: '1.0',
    sustainabilityEquivalents: true,
    failOnCarbonIncrease: null,
    groupBy: 'provider',
    minCostThreshold: 0,
    maxResourcesDisplayed: 10,
    showOnlyChanges: false,
    sortBy: 'cost',
    ...partial,
  };
}

describe('resource filters', () => {
  it('splits comma-separated finfocus filters', () => {
    expect(parseResourceFilters(' type=ec2, tag:Environment=dev ')).toEqual([
      'type=ec2',
      'tag:Environment=dev',
    ]);
    expect(filterArgs(['type=ec2', 'tag:env=prod'])).toEqual([
      '--filter',
      'type=ec2',
      '--filter',
      'tag:env=prod',
    ]);
  });

  it('rejects a filter without an equals sign', () => {
    expect(() => parseResourceFilters('ec2')).toThrow('key=value');
  });

  it('rejects unknown group-by and accepts one tag key', () => {
    expect(parseGroupBy('')).toBe('provider');
    expect(parseGroupBy('tag:team')).toBe('tag:team');
    expect(() => parseGroupBy('provider,type')).toThrow('Supported');
    expect(() => parseGroupBy('tag:')).toThrow('tag:<key>');
  });

  it('parses cost, sort, and display cap', () => {
    expect(parseMinCostThreshold('1USD')).toBe(1);
    expect(parseMinCostThreshold('1.5 USD')).toBe(1.5);
    expect(parseMinCostThreshold('')).toBe(0);
    expect(() => parseMinCostThreshold('cheap')).toThrow('min-cost-threshold');
    expect(parseSortBy('name')).toBe('name');
    expect(() => parseSortBy('date')).toThrow('sort-by');
    expect(parseMaxResourcesDisplayed('0')).toBe(0);
    expect(parseMaxResourcesDisplayed('')).toBe(10);
    expect(() => parseMaxResourcesDisplayed('1.5')).toThrow('max-resources-displayed');
  });
});

describe('selectResources', () => {
  const resources = [
    resource({
      resourceId: 'urn::web',
      resourceType: 'aws:ec2/instance:Instance',
      monthly: 80,
      change: 'create',
    }),
    resource({
      resourceId: 'urn::db',
      resourceType: 'aws:rds/instance:Instance',
      monthly: 40,
      change: 'same',
    }),
    resource({
      resourceId: 'urn::bucket',
      resourceType: 'aws:s3/bucket:Bucket',
      monthly: 0.4,
      change: 'update',
    }),
    resource({
      resourceId: 'urn::cache',
      resourceType: 'aws:elasticache/cluster:Cluster',
      monthly: 20,
      change: 'update',
    }),
  ];

  it('hides unchanged rows, cheap rows, and rows past the cap', () => {
    const selected = selectResources(
      resources,
      config({ showOnlyChanges: true, minCostThreshold: 1, maxResourcesDisplayed: 1 }),
    );
    expect(selected.hiddenByChange).toBe(1);
    expect(selected.hiddenByCost).toBe(1);
    expect(selected.hiddenByCap).toBe(1);
    expect(selected.shown.map((row) => row.resourceId)).toEqual(['urn::web']);
    expect(selected.grouped.map((row) => row.resourceId)).toEqual(['urn::web', 'urn::cache']);
  });

  it('keeps every row when the plan has no change annotations', () => {
    const plain = resources.map(({ change: _change, ...row }) => row);
    const selected = selectResources(plain, config({ showOnlyChanges: true }));
    expect(selected.missingChangeData).toBe(true);
    expect(selected.shown).toHaveLength(4);
  });

  it('sorts by name', () => {
    const selected = selectResources(
      resources,
      config({ sortBy: 'name', maxResourcesDisplayed: 0 }),
    );
    expect(selected.shown.map((row) => row.resourceId)).toEqual([
      'urn::bucket',
      'urn::cache',
      'urn::db',
      'urn::web',
    ]);
  });
});

describe('formatDisplaySections', () => {
  it('groups by service, labels untagged resources, and caps the resource table', () => {
    const report: FinfocusReport = {
      summary: { totalMonthly: 120, totalHourly: 0.1, currency: 'USD' },
      resources: [
        resource({
          resourceId: 'urn::web',
          monthly: 80,
          tags: { team: 'platform' },
        }),
        resource({
          resourceId: 'urn::db',
          resourceType: 'aws:rds/instance:Instance',
          monthly: 40,
          tags: { team: 'data' },
        }),
        resource({
          resourceId: 'urn::logs',
          resourceType: 'aws:s3/bucket:Bucket',
          monthly: 5,
        }),
      ],
    };

    const service = formatDisplaySections(
      report,
      config({ groupBy: 'service', maxResourcesDisplayed: 2 }),
      'USD',
    );
    expect(service.groupTable).toContain('Cost by Service');
    expect(service.groupTable).toContain('ec2');
    expect(service.groupTable).toContain('rds');
    expect(service.groupTable).toContain('s3');
    expect(service.resourceTable).toContain('Showing 2 of 3 resources.');

    const tags = formatDisplaySections(
      report,
      config({ groupBy: 'tag:team', maxResourcesDisplayed: 0 }),
      'USD',
    );
    expect(tags.groupTable).toContain('Cost by team');
    expect(tags.groupTable).toContain('(untagged)');
    expect(tags.groupTable).toContain('platform');
  });

  it('shows the plan diff as the net change', () => {
    const report: FinfocusReport = {
      summary: { totalMonthly: 80, totalHourly: 0.1, currency: 'USD' },
      diff: {
        totalBefore: 0,
        totalAfter: 80,
        totalDelta: 12.5,
        currency: 'USD',
        creates: 1,
        updates: 0,
        deletes: 0,
        unchanged: 2,
      },
      resources: [resource({ resourceId: 'urn::web', monthly: 80, change: 'create' })],
    };
    const body = formatDisplaySections(report, config({ showOnlyChanges: true }), 'USD');
    expect(body.resourceTable).toContain('✨ Create');
    expect(body.resourceTable).toContain('Net change');
    expect(body.resourceTable).toContain('+12.50 USD');
  });
});

describe('plan annotations', () => {
  it('joins op and tags from plan steps by urn', () => {
    const plan = {
      steps: [
        {
          op: 'create',
          urn: 'urn::web',
          type: 'aws:ec2/instance:Instance',
          inputs: { tags: { Environment: 'dev' } },
        },
      ],
    };
    const fs = jest.requireActual('fs') as typeof import('fs');
    const path = jest.requireActual('path') as typeof import('path');
    const os = jest.requireActual('os') as typeof import('os');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'finfocus-plan-'));
    const planPath = path.join(dir, 'plan.json');
    fs.writeFileSync(planPath, JSON.stringify(plan));
    const report: FinfocusReport = {
      summary: { totalMonthly: 10, totalHourly: 0.01, currency: 'USD' },
      resources: [resource({ resourceId: 'urn::web' })],
    };
    const annotated = annotateReportFromPlan(report, planPath, true);
    expect(annotated.resources?.[0].change).toBe('create');
    expect(annotated.resources?.[0].tags).toEqual({ Environment: 'dev' });
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('type helpers', () => {
  it('reads provider and service the way finfocus does', () => {
    expect(providerOf('aws:ec2/instance:Instance')).toBe('aws');
    expect(serviceOf('aws:ec2/instance:Instance')).toBe('ec2');
    expect(serviceOf('custom')).toBe('other');
  });
});
