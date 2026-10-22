import * as fs from 'fs';
import * as github from '@actions/github';
import * as core from '@actions/core';
import {
  ICommenter,
  FinfocusReport,
  ActionConfiguration,
  RecommendationsReport,
  ActualCostReport,
  SustainabilityReport,
  BudgetStatus,
  EstimateReport,
  ClusterReport,
  StateOnlyReport,
} from './types.js';
import { formatCommentBody } from './formatter.js';

export class Commenter implements ICommenter {
  private readonly marker = '<!-- finfocus-action-comment -->';

  /**
   * Write the PR comment body without calling GitHub.
   * The contract job sets FINFOCUS_COMMENT_PATH so CI can assert the comment.
   */
  writeCommentFile(
    filePath: string,
    report: FinfocusReport,
    config?: ActionConfiguration,
    recommendationsReport?: RecommendationsReport,
    actualCostReport?: ActualCostReport,
    sustainabilityReport?: SustainabilityReport,
    budgetStatus?: BudgetStatus,
    estimateReport?: EstimateReport,
    clusterReport?: ClusterReport,
    stateOnlyReport?: StateOnlyReport,
  ): void {
    fs.writeFileSync(
      filePath,
      this.commentBody(
        report,
        config,
        recommendationsReport,
        actualCostReport,
        sustainabilityReport,
        budgetStatus,
        estimateReport,
        clusterReport,
        stateOnlyReport,
      ),
      'utf8',
    );
  }

  async upsertComment(
    report: FinfocusReport,
    token: string,
    config?: ActionConfiguration,
    recommendationsReport?: RecommendationsReport,
    actualCostReport?: ActualCostReport,
    sustainabilityReport?: SustainabilityReport,
    budgetStatus?: BudgetStatus,
    estimateReport?: EstimateReport,
    clusterReport?: ClusterReport,
    stateOnlyReport?: StateOnlyReport,
  ): Promise<void> {
    const octokit = github.getOctokit(token);
    const context = github.context;

    if (!context.payload.pull_request) {
      core.info('Not a pull request, skipping comment.');
      return;
    }

    const prNumber = context.payload.pull_request.number;
    const body = this.commentBody(
      report,
      config,
      recommendationsReport,
      actualCostReport,
      sustainabilityReport,
      budgetStatus,
      estimateReport,
      clusterReport,
      stateOnlyReport,
    );

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

  private commentBody(
    report: FinfocusReport,
    config?: ActionConfiguration,
    recommendationsReport?: RecommendationsReport,
    actualCostReport?: ActualCostReport,
    sustainabilityReport?: SustainabilityReport,
    budgetStatus?: BudgetStatus,
    estimateReport?: EstimateReport,
    clusterReport?: ClusterReport,
    stateOnlyReport?: StateOnlyReport,
  ): string {
    return `${this.marker}
${formatCommentBody(report, config, recommendationsReport, actualCostReport, sustainabilityReport, budgetStatus, estimateReport, clusterReport, stateOnlyReport)}`;
  }
}
