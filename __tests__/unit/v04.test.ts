import * as exec from '@actions/exec';
import * as fs from 'fs';
import { Analyzer } from '../../src/analyze.js';
import { formatCommentBody } from '../../src/formatter.js';
import {
  clusterArgs,
  collectDeclineNotes,
  dismissArgs,
  hideDismissedRecommendations,
  parseDismissals,
  parseSnoozes,
  recommendationArgs,
  reportFromStateOnly,
  snoozeArgs,
  stateOnlyArgs,
} from '../../src/v04.js';
import { FinfocusReport, RecommendationsReport } from '../../src/types.js';

jest.mock('@actions/exec');
jest.mock('@actions/core');
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  statSync: jest.fn(),
  readFileSync: jest.fn(),
}));

const baseSummary = {
  total_count: 2,
  total_savings: 30,
  currency: 'USD',
  count_by_action_type: { RIGHTSIZE: 2 },
};

describe('finfocus v0.4 command shapes', () => {
  it('builds cost cluster args from the flags in --help', () => {
    expect(
      clusterArgs({
        clusterGroupBy: 'label:team',
        clusterNamespace: 'payments',
        clusterContext: 'prod',
        clusterSelector: 'app=api,tier=front',
      }),
    ).toEqual([
      'cost',
      'cluster',
      '--output',
      'json',
      '--group-by',
      'label:team',
      '--namespace',
      'payments',
      '--context',
      'prod',
      '--selector',
      'app=api',
      '--selector',
      'tier=front',
    ]);
  });

  it('rejects a cluster group-by the CLI does not list', () => {
    expect(() => clusterArgs({ clusterGroupBy: 'service' })).toThrow('Invalid cluster-group-by');
  });

  it('passes --no-scoring unless Jev scoring is enabled, and hides dismissals by default', () => {
    expect(recommendationArgs('plan.json', {})).toEqual([
      'cost',
      'recommendations',
      '--pulumi-json',
      'plan.json',
      '--output',
      'json',
      '--no-scoring',
    ]);
    expect(recommendationArgs('plan.json', { enableJevScoring: true })).not.toContain(
      '--no-scoring',
    );
    expect(recommendationArgs('plan.json', { includeDismissedRecommendations: true })).toContain(
      '--include-dismissed',
    );
  });

  it('builds dismiss and snooze commands with --force', () => {
    expect(
      dismissArgs('plan.json', { id: 'rec-1', reason: 'business-constraint', note: 'keep it' }),
    ).toEqual([
      'cost',
      'recommendations',
      'dismiss',
      'rec-1',
      '--reason',
      'business-constraint',
      '--force',
      '--note',
      'keep it',
      '--pulumi-json',
      'plan.json',
    ]);
    expect(snoozeArgs(undefined, { id: 'rec-2', until: '2026-04-01' })).toEqual([
      'cost',
      'recommendations',
      'snooze',
      'rec-2',
      '--until',
      '2026-04-01',
      '--force',
    ]);
  });

  it('rejects an other dismissal without a note', () => {
    expect(() => parseDismissals('[{"id":"rec-1","reason":"other"}]')).toThrow('requires a note');
    expect(() => parseSnoozes('[{"id":"rec-2","until":"next week"}]')).toThrow('YYYY-MM-DD');
  });

  it('drops dismissed and snoozed recommendations from the comment set', () => {
    const report: RecommendationsReport = {
      summary: baseSummary,
      recommendations: [
        {
          id: 'rec-1',
          resource_id: 'aws:ec2:web',
          action_type: 'RIGHTSIZE',
          description: 'smaller',
          estimated_savings: 10,
          currency: 'USD',
          status: 'Dismissed',
        },
        {
          id: 'rec-2',
          resource_id: 'aws:ec2:db',
          action_type: 'RIGHTSIZE',
          description: 'snoozed',
          estimated_savings: 20,
          currency: 'USD',
          status: 'Active',
        },
      ],
    };

    const hidden = hideDismissedRecommendations(report, {
      snoozeRecommendations: '[{"id":"rec-2","until":"2026-04-01"}]',
    });
    expect(hidden.recommendations).toHaveLength(0);
    expect(hidden.summary.total_count).toBe(0);
    expect(hidden.summary.total_savings).toBe(0);

    const shown = hideDismissedRecommendations(report, { includeDismissedRecommendations: true });
    expect(shown.recommendations).toHaveLength(2);
  });

  it('reads Supports() decline reasons from resource notes', () => {
    const report: FinfocusReport = {
      summary: { totalMonthly: 0, totalHourly: 0, currency: 'USD' },
      resources: [
        {
          resourceType: 'kubernetes:core/v1:Pod',
          resourceId: 'urn:pulumi:stack::pod',
          adapter: 'kubernetes',
          currency: 'USD',
          monthly: 0,
          hourly: 0,
          notes: 'no cost (declined by kubernetes: type not served)',
        },
        {
          resourceType: 'aws:ec2/instance:Instance',
          resourceId: 'web',
          adapter: 'aws-public',
          currency: 'USD',
          monthly: 7.59,
          hourly: 0.01,
        },
      ],
    };
    expect(collectDeclineNotes(report)).toEqual([
      {
        resourceType: 'kubernetes:core/v1:Pod',
        resourceId: 'urn:pulumi:stack::pod',
        note: 'no cost (declined by kubernetes: type not served)',
      },
    ]);
  });

  it('runs overview --state-only and does not pass that flag to cost projected', () => {
    expect(stateOnlyArgs('state.json')).toEqual([
      'overview',
      '--state-only',
      '--pulumi-state',
      'state.json',
      '--output',
      'json',
      '--plain',
      '--yes',
    ]);
    expect(stateOnlyArgs('state.json').join(' ')).not.toContain('cost projected');
    const overview = reportFromStateOnly({
      summary: {
        totalActualMTD: 1,
        projectedMonthly: 12.5,
        projectedDelta: 0,
        potentialSavings: 2,
        currency: 'USD',
      },
    });
    expect(overview.summary.totalMonthly).toBe(12.5);
  });
});

describe('Analyzer v0.4 calls', () => {
  const analyzer = new Analyzer();

  beforeEach(() => {
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.statSync as jest.Mock).mockReturnValue({ size: 10 });
    (fs.readFileSync as jest.Mock).mockReturnValue('{}');
  });

  it('parses cost cluster JSON', async () => {
    (exec.getExecOutput as jest.Mock).mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify({
        mode: 'run-rate',
        period: 'monthly',
        currency: 'USD',
        group_by: 'namespace',
        total: 40,
        idle: 5,
        namespace_scoped: false,
        incomplete: false,
        groups: [{ key: 'payments', cpu_cost: 10, mem_cost: 30, total_cost: 40, rows: 2 }],
      }),
      stderr: '',
    });

    const report = await analyzer.runCluster({ includeClusterCosts: true });
    expect(exec.getExecOutput).toHaveBeenCalledWith(
      'finfocus',
      ['cost', 'cluster', '--output', 'json', '--group-by', 'namespace'],
      expect.objectContaining({ ignoreReturnCode: true }),
    );
    expect(report.total).toBe(40);
    expect(report.groups[0].key).toBe('payments');
  });

  it('filters a dismissed recommendation returned by the CLI', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (exec.getExecOutput as jest.Mock).mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify({
        summary: baseSummary,
        recommendations: [
          {
            id: 'rec-9',
            resource_id: 'web',
            action_type: 'TERMINATE',
            description: 'unused',
            estimated_savings: 8,
            currency: 'USD',
            status: 'Snoozed',
          },
        ],
      }),
      stderr: '',
    });

    const report = await analyzer.runRecommendations('plan.json', {});
    expect(report.recommendations).toHaveLength(0);
    const args = (exec.getExecOutput as jest.Mock).mock.calls[0][1] as string[];
    expect(args).toContain('--no-scoring');
    expect(args).not.toContain('--include-dismissed');
  });
});

describe('comment sections for v0.4 features', () => {
  const report: FinfocusReport = {
    summary: { totalMonthly: 10, totalHourly: 0.01, currency: 'USD' },
    resources: [
      {
        resourceType: 'kubernetes:apps/v1:Deployment',
        resourceId: 'urn::api',
        adapter: 'kubernetes',
        currency: 'USD',
        monthly: 0,
        hourly: 0,
        notes: '(declined by kubernetes: no metrics)',
      },
    ],
  };

  it('shows decline reasons, cluster rows, scores, and the state-only summary', () => {
    const body = formatCommentBody(
      report,
      undefined,
      {
        summary: { total_count: 1, total_savings: 4, currency: 'USD', count_by_action_type: {} },
        scoring: { scorer: 'jev', requested: 1, scored: 1 },
        recommendations: [
          {
            resource_id: 'web',
            action_type: 'RIGHTSIZE',
            description: 'smaller',
            estimated_savings: 4,
            currency: 'USD',
            scores: { risk: 0.2, worth_acting: 0.8, needs_review: false },
          },
        ],
      },
      undefined,
      undefined,
      undefined,
      undefined,
      {
        mode: 'run-rate',
        period: 'monthly',
        currency: 'USD',
        group_by: 'namespace',
        total: 40,
        idle: 5,
        namespace_scoped: false,
        incomplete: false,
        groups: [{ key: 'payments', cpu_cost: 10, mem_cost: 30, total_cost: 40, rows: 2 }],
      },
      {
        summary: {
          totalActualMTD: 3,
          projectedMonthly: 12,
          projectedDelta: 1,
          potentialSavings: 2,
          currency: 'USD',
        },
      },
    );

    expect(body).toContain('Plugin declines');
    expect(body).toContain('declined by kubernetes: no metrics');
    expect(body).toContain('Cluster costs');
    expect(body).toContain('payments');
    expect(body).toContain('Worth acting');
    expect(body).toContain('0.80');
    expect(body).toContain('Scoring (jev)');
    expect(body).toContain('State-only overview');
    expect(body).toContain('pulumi preview was not run');
  });

  it('parses a dismissal list used by the comment filter', () => {
    expect(parseDismissals('[{"id":"rec-1","reason":"inaccurate"}]')).toEqual([
      { id: 'rec-1', reason: 'inaccurate', note: undefined },
    ]);
  });
});
