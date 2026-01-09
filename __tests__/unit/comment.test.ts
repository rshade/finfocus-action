import * as github from '@actions/github';
import { Commenter } from '../../src/comment.js';

jest.mock('@actions/github');

describe('Commenter', () => {
  let commenter: Commenter;

  beforeEach(() => {
    commenter = new Commenter();
    (github as any).context = {
      repo: {
        owner: 'owner',
        repo: 'repo'
      },
      payload: {
        pull_request: {
          number: 123
        }
      }
    };
  });

  it('should create new comment if none exists', async () => {
    const octokit = {
      rest: {
        issues: {
          listComments: jest.fn().mockResolvedValue({ data: [] }),
          createComment: jest.fn().mockResolvedValue({})
        }
      }
    };
    (github.getOctokit as jest.Mock).mockReturnValue(octokit);

    await commenter.upsertComment({ projected_monthly_cost: 100, currency: 'USD' }, 'token');

    expect(octokit.rest.issues.createComment).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.stringContaining('<!-- pulumicost-action-comment -->')
    }));
  });

  it('should update existing comment if found', async () => {
    const octokit = {
      rest: {
        issues: {
          listComments: jest.fn().mockResolvedValue({
            data: [
              { id: 1, body: 'other comment' },
              { id: 2, body: '<!-- pulumicost-action-comment --> existing table' }
            ]
          }),
          updateComment: jest.fn().mockResolvedValue({})
        }
      }
    };
    (github.getOctokit as jest.Mock).mockReturnValue(octokit);

    await commenter.upsertComment({ projected_monthly_cost: 100, currency: 'USD' }, 'token');

    expect(octokit.rest.issues.updateComment).toHaveBeenCalledWith(expect.objectContaining({
      comment_id: 2
    }));
  });
});
