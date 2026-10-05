import * as exec from '@actions/exec';
import * as core from '@actions/core';
import * as fs from 'fs';

import {
  ActionConfiguration,
  ClusterReport,
  FinfocusReport,
  RecommendationsReport,
  Recommendation,
  StateOnlyReport,
} from './types.js';
import { formatEnvelopeError, parseErrorEnvelope } from './errors.js';

const CLUSTER_GROUP_BY = new Set(['namespace', 'controller', 'pod', 'node', 'pulumi-stack']);

export const DISMISSAL_REASONS = [
  'not-applicable',
  'already-implemented',
  'business-constraint',
  'technical-constraint',
  'deferred',
  'inaccurate',
  'other',
] as const;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const REC_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

export interface DismissalRequest {
  id: string;
  reason: string;
  note?: string;
}

export interface SnoozeRequest {
  id: string;
  until: string;
  reason?: string;
  note?: string;
}

export interface DeclineNote {
  resourceType: string;
  resourceId: string;
  note: string;
}

export function assertClusterGroupBy(groupBy: string): void {
  if (CLUSTER_GROUP_BY.has(groupBy)) {
    return;
  }
  if (groupBy.startsWith('label:') && groupBy.length > 'label:'.length && !/\s/.test(groupBy)) {
    return;
  }
  throw new Error(
    `Invalid cluster-group-by "${groupBy}". ` +
      `Use namespace, controller, pod, node, pulumi-stack, or label:<key> ` +
      `(finfocus cost cluster --group-by).`,
  );
}

export function parseClusterSelectors(raw: string | undefined): string[] {
  if (!raw || raw.trim() === '') {
    return [];
  }
  return raw.split(',').map((part) => {
    const selector = part.trim();
    const eq = selector.indexOf('=');
    if (eq <= 0 || eq === selector.length - 1 || /\s/.test(selector)) {
      throw new Error(
        `Invalid cluster-selector "${selector}". Use key=value pairs separated by commas.`,
      );
    }
    return selector;
  });
}

export function clusterArgs(config: ActionConfiguration): string[] {
  const groupBy = config.clusterGroupBy || 'namespace';
  assertClusterGroupBy(groupBy);
  const args = ['cost', 'cluster', '--output', 'json', '--group-by', groupBy];
  if (config.clusterNamespace) {
    args.push('--namespace', config.clusterNamespace);
  }
  if (config.clusterContext) {
    args.push('--context', config.clusterContext);
  }
  for (const selector of parseClusterSelectors(config.clusterSelector)) {
    args.push('--selector', selector);
  }
  return args;
}

export function recommendationArgs(planPath: string, config?: ActionConfiguration): string[] {
  const args = ['cost', 'recommendations', '--pulumi-json', planPath, '--output', 'json'];
  if (config?.includeDismissedRecommendations) {
    args.push('--include-dismissed');
  }
  if (config && !config.enableJevScoring) {
    args.push('--no-scoring');
  }
  return args;
}

export function parseDismissals(raw: string | undefined): DismissalRequest[] {
  return parseJsonList(raw, 'dismiss-recommendations', (item, index) => {
    const id = requireId(item, index, 'dismiss-recommendations');
    const reason = typeof item.reason === 'string' ? item.reason.trim() : '';
    if (!(DISMISSAL_REASONS as readonly string[]).includes(reason)) {
      throw new Error(
        `dismiss-recommendations[${index}].reason "${reason}" is invalid. ` +
          `Use ${DISMISSAL_REASONS.join(', ')}.`,
      );
    }
    const note = optionalNote(item, index, 'dismiss-recommendations');
    if (reason === 'other' && !note) {
      throw new Error(
        `dismiss-recommendations[${index}] uses reason "other", which requires a note.`,
      );
    }
    return { id, reason, note };
  });
}

export function parseSnoozes(raw: string | undefined): SnoozeRequest[] {
  return parseJsonList(raw, 'snooze-recommendations', (item, index) => {
    const id = requireId(item, index, 'snooze-recommendations');
    const until = typeof item.until === 'string' ? item.until.trim() : '';
    if (!DATE.test(until) && !RFC3339.test(until)) {
      throw new Error(
        `snooze-recommendations[${index}].until "${until}" must be YYYY-MM-DD or RFC3339.`,
      );
    }
    const reason = typeof item.reason === 'string' ? item.reason.trim() : '';
    if (reason && !(DISMISSAL_REASONS as readonly string[]).includes(reason)) {
      throw new Error(
        `snooze-recommendations[${index}].reason "${reason}" is invalid. ` +
          `Use ${DISMISSAL_REASONS.join(', ')}.`,
      );
    }
    const note = optionalNote(item, index, 'snooze-recommendations');
    if (reason === 'other' && !note) {
      throw new Error(
        `snooze-recommendations[${index}] uses reason "other", which requires a note.`,
      );
    }
    return { id, until, reason: reason || undefined, note };
  });
}

export function dismissArgs(planPath: string | undefined, item: DismissalRequest): string[] {
  const args = ['cost', 'recommendations', 'dismiss', item.id, '--reason', item.reason, '--force'];
  if (item.note) {
    args.push('--note', item.note);
  }
  if (planPath) {
    args.push('--pulumi-json', planPath);
  }
  return args;
}

export function snoozeArgs(planPath: string | undefined, item: SnoozeRequest): string[] {
  const args = ['cost', 'recommendations', 'snooze', item.id, '--until', item.until, '--force'];
  if (item.reason) {
    args.push('--reason', item.reason);
  }
  if (item.note) {
    args.push('--note', item.note);
  }
  if (planPath) {
    args.push('--pulumi-json', planPath);
  }
  return args;
}

export function stateOnlyArgs(statePath: string): string[] {
  return [
    'overview',
    '--state-only',
    '--pulumi-state',
    statePath,
    '--output',
    'json',
    '--plain',
    '--yes',
  ];
}

/**
 * Drop dismissed and snoozed recommendations unless the caller opted into
 * `--include-dismissed`. Also drop ids the action just dismissed or snoozed,
 * so a PR comment does not repeat them when the CLI still returns them.
 */
export function hideDismissedRecommendations(
  report: RecommendationsReport,
  config?: ActionConfiguration,
): RecommendationsReport {
  if (config?.includeDismissedRecommendations) {
    return report;
  }
  const hidden = new Set<string>();
  for (const item of parseDismissals(config?.dismissRecommendations)) {
    hidden.add(item.id);
  }
  for (const item of parseSnoozes(config?.snoozeRecommendations)) {
    hidden.add(item.id);
  }

  const recommendations = (report.recommendations ?? []).filter((rec) => {
    const status = (rec.status ?? '').toLowerCase();
    if (status === 'dismissed' || status === 'snoozed') {
      return false;
    }
    return !(rec.id && hidden.has(rec.id));
  });
  if (recommendations.length === (report.recommendations ?? []).length) {
    return report;
  }
  return {
    ...report,
    recommendations,
    summary: {
      ...report.summary,
      total_count: recommendations.length,
      total_savings: recommendations.reduce((sum, rec) => sum + rec.estimated_savings, 0),
      count_by_action_type: countByAction(recommendations),
    },
  };
}

/** Supports() decline reasons are appended to resource notes as "(declined by ...)". */
export function collectDeclineNotes(report: FinfocusReport): DeclineNote[] {
  const resources = report.resources ?? report.summary?.resources ?? [];
  const notes: DeclineNote[] = [];
  for (const resource of resources) {
    if (!resource.notes || !/declined by /i.test(resource.notes)) {
      continue;
    }
    notes.push({
      resourceType: resource.resourceType,
      resourceId: resource.resourceId,
      note: resource.notes,
    });
  }
  return notes;
}

export function reportFromStateOnly(overview: StateOnlyReport): FinfocusReport {
  const monthly = overview.summary?.projectedMonthly ?? 0;
  const currency = overview.summary?.currency || 'USD';
  return {
    summary: {
      totalMonthly: monthly,
      totalHourly: monthly / 730,
      currency,
    },
    projected_monthly_cost: monthly,
    currency,
  };
}

export async function executeCluster(config: ActionConfiguration): Promise<ClusterReport> {
  const args = clusterArgs(config);
  const stdout = await runFinFocus(args, config.debug === true);
  const report = unwrapJson<ClusterReport>(stdout);
  if (!report || !Array.isArray(report.groups) || typeof report.total !== 'number') {
    throw new Error('finfocus cost cluster JSON is missing groups or total.');
  }
  return report;
}

export async function executeStateOnly(config: ActionConfiguration): Promise<StateOnlyReport> {
  const statePath = config.pulumiStateJsonPath;
  if (!statePath) {
    throw new Error(
      'state-only requires pulumi-state-json. ' +
        'finfocus overview --state-only skips pulumi preview and reads the state file.',
    );
  }
  if (!fs.existsSync(statePath)) {
    throw new Error(`Pulumi state file not found: ${statePath}`);
  }
  const stdout = await runFinFocus(stateOnlyArgs(statePath), config.debug === true);
  const report = unwrapJson<StateOnlyReport>(stdout);
  if (!report?.summary || typeof report.summary.projectedMonthly !== 'number') {
    throw new Error('finfocus overview JSON is missing summary.projectedMonthly.');
  }
  return report;
}

export async function executeRecommendationLifecycle(
  planPath: string | undefined,
  config: ActionConfiguration,
): Promise<void> {
  const plan = planPath && fs.existsSync(planPath) ? planPath : undefined;
  for (const item of parseDismissals(config.dismissRecommendations)) {
    core.info(`Dismissing recommendation ${item.id} (${item.reason})`);
    await runFinFocus(dismissArgs(plan, item), config.debug === true);
  }
  for (const item of parseSnoozes(config.snoozeRecommendations)) {
    core.info(`Snoozing recommendation ${item.id} until ${item.until}`);
    await runFinFocus(snoozeArgs(plan, item), config.debug === true);
  }
}

async function runFinFocus(args: string[], debug: boolean): Promise<string> {
  if (debug) {
    core.info(`  Command: finfocus ${args.join(' ')}`);
  }
  const output = await exec.getExecOutput('finfocus', args, {
    silent: !debug,
    ignoreReturnCode: true,
  });
  if (output.exitCode !== 0) {
    const envelope = parseErrorEnvelope(output.stderr);
    if (envelope) {
      throw new Error(formatEnvelopeError(envelope, output.exitCode));
    }
    throw new Error(
      `finfocus ${args.join(' ')} failed with exit code ${output.exitCode}.\n` +
        `Stderr: ${output.stderr}\n` +
        `Stdout: ${output.stdout}`,
    );
  }
  return output.stdout;
}

function unwrapJson<T>(stdout: string): T {
  const parsed = JSON.parse(stdout) as T & { finfocus?: T };
  if (parsed && typeof parsed === 'object' && parsed.finfocus) {
    return parsed.finfocus;
  }
  return parsed;
}

function countByAction(recommendations: Recommendation[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const rec of recommendations) {
    counts[rec.action_type] = (counts[rec.action_type] ?? 0) + 1;
  }
  return counts;
}

function parseJsonList<T>(
  raw: string | undefined,
  inputName: string,
  mapItem: (item: Record<string, unknown>, index: number) => T,
): T[] {
  if (!raw || raw.trim() === '') {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `${inputName} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`${inputName} must be a JSON array.`);
  }
  return parsed.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`${inputName}[${index}] must be an object.`);
    }
    return mapItem(item as Record<string, unknown>, index);
  });
}

function requireId(item: Record<string, unknown>, index: number, inputName: string): string {
  const id = typeof item.id === 'string' ? item.id.trim() : '';
  if (!REC_ID.test(id)) {
    throw new Error(
      `${inputName}[${index}].id "${id}" is empty or contains characters finfocus would treat as a flag.`,
    );
  }
  return id;
}

function optionalNote(
  item: Record<string, unknown>,
  index: number,
  inputName: string,
): string | undefined {
  if (item.note === undefined || item.note === '') {
    return undefined;
  }
  if (typeof item.note !== 'string') {
    throw new Error(`${inputName}[${index}].note must be a string.`);
  }
  return item.note;
}
