import * as github from '@actions/github';
import * as core from '@actions/core';
import {
  ICommenter,
  PulumicostReport,
  ActionConfiguration,
  RecommendationsReport,
} from './types.js';
import { formatCommentBody } from './formatter.js';

export class Commenter implements ICommenter {
  private readonly marker = '<!-- pulumicost-action-comment -->';

  async upsertComment(
    report: PulumicostReport,
    token: string,
    config?: ActionConfiguration,
    recommendationsReport?: RecommendationsReport,
  ): Promise<void> {
    const octokit = github.getOctokit(token);
    const context = github.context;

    if (!context.payload.pull_request) {
      core.info('Not a pull request, skipping comment.');
      return;
    }

    const prNumber = context.payload.pull_request.number;
    const body = `${this.marker}
${formatCommentBody(report, config, recommendationsReport)}`;

    const { data: comments } = await octokit.rest.issues.listComments({
      ...context.repo,
      issue_number: prNumber,
    });

    const existingComment = comments.find((c) => c.body?.includes(this.marker));

    if (existingComment) {
      core.info(`Updating existing comment ${existingComment.id}`);
      await octokit.rest.issues.updateComment({
        ...context.repo,
        comment_id: existingComment.id,
        body,
      });
    } else {
      core.info('Creating new comment');
      await octokit.rest.issues.createComment({
        ...context.repo,
        issue_number: prNumber,
        body,
      });
    }
  }
}
