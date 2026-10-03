import * as github from '@actions/github';
import { Commenter } from '../../src/comment.js';

jest.mock('@actions/github');
jest.mock('@actions/core');

const mockedGithub = github as jest.Mocked<typeof github>;

describe('Commenter', () => {
  let commenter: Commenter;

  beforeEach(() => {
    jest.clearAllMocks();
    commenter = new Commenter();
    // Set up the mocked context
    Object.assign(mockedGithub.context, {
      repo: {
        owner: 'owner',
        repo: 'repo',
      },
      payload: {
        pull_request: {
          number: 123,
        },
      },
    });
  });

  it('should create new comment if none exists', async () => {
    const octokit = {
      rest: {
        issues: {
          listComments: jest.fn().mockResolvedValue({ data: [] }),
          createComment: jest.fn().mockResolvedValue({}),
        },
      },
    };
    mockedGithub.getOctokit.mockReturnValue(octokit as any);

    await commenter.upsertComment({ projected_monthly_cost: 100, currency: 'USD' }, 'token');

    expect(octokit.rest.issues.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('<!-- finfocus-action-comment -->'),
      }),
    );
  });

  it('should update existing comment if found', async () => {
    const octokit = {
      rest: {
        issues: {
          listComments: jest.fn().mockResolvedValue({
            data: [
              { id: 1, body: 'other comment' },
              { id: 2, body: '<!-- finfocus-action-comment --> existing table' },
            ],
          }),
          updateComment: jest.fn().mockResolvedValue({}),
        },
      },
    };
    mockedGithub.getOctokit.mockReturnValue(octokit as any);

    await commenter.upsertComment({ projected_monthly_cost: 100, currency: 'USD' }, 'token');

    expect(octokit.rest.issues.updateComment).toHaveBeenCalledWith(
      expect.objectContaining({
        comment_id: 2,
      }),
    );
  });

  it('should include the what-if estimate section when an estimate report is provided', async () => {
    const octokit = {
      rest: {
        issues: {
          listComments: jest.fn().mockResolvedValue({ data: [] }),
          createComment: jest.fn().mockResolvedValue({}),
        },
      },
    };
    mockedGithub.getOctokit.mockReturnValue(octokit as any);

    const estimateReport = {
      resource: {
        type: 'aws:ec2/instance:Instance',
        id: 'estimate-resource',
        provider: 'aws',
        properties: { region: 'us-east-1' },
      },
      baseline: {
        resourceType: 'aws:ec2/instance:Instance',
        resourceId: 'estimate-resource',
        adapter: '',
        currency: 'USD',
        monthly: 0,
        hourly: 0,
      },
      modified: {
        resourceType: 'aws:ec2/instance:Instance',
        resourceId: 'estimate-resource',
        adapter: '',
        currency: 'USD',
        monthly: 70.08,
        hourly: 0.096,
      },
      totalChange: 70.08,
      deltas: [
        { property: 'instanceType', originalValue: '', newValue: 'm5.large', costChange: 70.08 },
      ],
    };

    await commenter.upsertComment(
      { projected_monthly_cost: 100, currency: 'USD' },
      'token',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      estimateReport,
    );

    expect(octokit.rest.issues.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('What-If Cost Estimate'),
      }),
    );
  });
});
