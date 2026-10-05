import * as core from '@actions/core';
import * as fs from 'fs';

import { ActionConfiguration, FinfocusReport, FinfocusResource, isV041Diff } from './types.js';

const CHANGE_OPS = new Set([
  'create',
  'update',
  'delete',
  'replace',
  'create-replacement',
  'delete-replaced',
  'import',
]);

const GROUP_KINDS = new Set(['resource', 'type', 'provider', 'service']);

export interface DisplaySelection {
  shown: FinfocusResource[];
  /** Rows left after change and cost filters, before the display cap. Group totals use this set. */
  grouped: FinfocusResource[];
  hiddenByChange: number;
  hiddenByCost: number;
  hiddenByCap: number;
  missingChangeData: boolean;
}

export function parseResourceFilters(raw: string | undefined): string[] {
  if (!raw || raw.trim() === '') {
    return [];
  }
  const filters = raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  for (const filter of filters) {
    const parts = filter.split('=');
    if (parts.length < 2 || parts[0].trim() === '' || parts.slice(1).join('=').trim() === '') {
      throw new Error(
        `Invalid resource-filter "${filter}". finfocus expects key=value, for example type=ec2 or tag:env=prod.`,
      );
    }
  }
  return filters;
}

export function filterArgs(filters: string[] | undefined): string[] {
  if (!filters || filters.length === 0) {
    return [];
  }
  const args: string[] = [];
  for (const filter of filters) {
    args.push('--filter', filter);
  }
  return args;
}

export function parseGroupBy(raw: string | undefined): string {
  const value = (raw ?? '').trim() || 'provider';
  if (GROUP_KINDS.has(value)) {
    return value;
  }
  if (value.startsWith('tag:')) {
    const key = value.slice('tag:'.length).trim();
    if (key.length === 0 || /\s/.test(key) || key.includes('=')) {
      throw new Error(
        `Invalid group-by "${value}". Use tag:<key>, for example tag:team. One dimension only.`,
      );
    }
    return `tag:${key}`;
  }
  throw new Error(
    `Invalid group-by "${value}". Supported: resource, type, provider, service, tag:<key>.`,
  );
}

export function parseSortBy(raw: string | undefined): 'cost' | 'name' | 'type' | 'change' {
  const value = (raw ?? '').trim() || 'cost';
  if (value === 'cost' || value === 'name' || value === 'type' || value === 'change') {
    return value;
  }
  throw new Error(`Invalid sort-by "${value}". Supported: cost, name, type, change.`);
}

export function parseMinCostThreshold(raw: string | undefined): number {
  const value = (raw ?? '').trim();
  if (value === '') {
    return 0;
  }
  const match = value.match(/^(\d+(?:\.\d+)?)(?:\s*[A-Za-z]+)?$/);
  if (!match) {
    throw new Error(
      `Invalid min-cost-threshold "${value}". Expected a number with an optional currency, for example 1USD.`,
    );
  }
  return Number(match[1]);
}

export function parseMaxResourcesDisplayed(raw: string | undefined): number {
  const value = (raw ?? '').trim();
  if (value === '') {
    return 10;
  }
  if (!/^\d+$/.test(value)) {
    throw new Error(
      `Invalid max-resources-displayed "${value}". Expected a whole number. 0 shows every resource.`,
    );
  }
  return Number(value);
}

export function usesDisplayControls(config?: ActionConfiguration): boolean {
  if (!config) {
    return false;
  }
  if (config.maxResourcesDisplayed !== undefined) {
    return true;
  }
  if (config.showOnlyChanges) {
    return true;
  }
  if ((config.minCostThreshold ?? 0) > 0) {
    return true;
  }
  if (config.sortBy !== undefined && config.sortBy !== 'cost') {
    return true;
  }
  return config.groupBy !== undefined && config.groupBy !== 'provider';
}

export function providerOf(resourceType: string): string {
  const provider = resourceType.split(':')[0];
  return provider || 'other';
}

export function serviceOf(resourceType: string): string {
  const parts = resourceType.split(':');
  if (parts.length < 2 || !parts[1]) {
    return 'other';
  }
  const slash = parts[1].indexOf('/');
  return slash > 0 ? parts[1].slice(0, slash) : parts[1];
}

export function resourceName(resourceId: string): string {
  return resourceId.split('::').pop() || resourceId;
}

export function annotateReportFromPlan(
  report: FinfocusReport,
  planPath: string | undefined,
  needed: boolean,
): FinfocusReport {
  if (!needed) {
    return report;
  }
  if (!planPath || !fs.existsSync(planPath)) {
    core.warning(
      'show-only-changes and tag grouping need a Pulumi plan with steps. No plan file was found, so every priced resource stays in the comment.',
    );
    return report;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  } catch (error) {
    core.warning(
      `Could not read Pulumi plan for change and tag grouping: ${error instanceof Error ? error.message : String(error)}`,
    );
    return report;
  }
  const annotations = planAnnotations(parsed);
  if (annotations.size === 0) {
    core.warning(
      'Pulumi plan has no steps with a urn, so change and tag grouping have nothing to join.',
    );
    return report;
  }
  const resources = (report.resources ?? report.summary?.resources ?? []).map((resource) => {
    const found = annotations.get(resource.resourceId);
    if (!found) {
      return resource;
    }
    return { ...resource, change: found.op, tags: found.tags };
  });
  return { ...report, resources };
}

interface PlanAnnotation {
  op?: string;
  tags?: Record<string, string>;
}

function planAnnotations(plan: unknown): Map<string, PlanAnnotation> {
  const found = new Map<string, PlanAnnotation>();
  const steps = stepsOf(plan);
  for (const step of steps) {
    const resource = step.resource && typeof step.resource === 'object' ? step.resource : undefined;
    const urn = stringField(step, 'urn') ?? (resource ? stringField(resource, 'urn') : undefined);
    if (!urn) {
      continue;
    }
    const op = stringField(step, 'op') ?? (resource ? stringField(resource, 'op') : undefined);
    const tags = readTags(step.inputs) ?? (resource ? readTags(resource.inputs) : undefined);
    found.set(urn, { op, tags });
  }
  return found;
}

interface PlanStep {
  op?: unknown;
  urn?: unknown;
  inputs?: unknown;
  resource?: { op?: unknown; urn?: unknown; inputs?: unknown };
}

function stepsOf(plan: unknown): PlanStep[] {
  if (!plan || typeof plan !== 'object' || !('steps' in plan)) {
    return [];
  }
  const steps = (plan as { steps?: unknown }).steps;
  if (!Array.isArray(steps)) {
    return [];
  }
  return steps.filter((step): step is PlanStep => !!step && typeof step === 'object');
}

function stringField(source: object, key: string): string | undefined {
  const value = (source as Record<string, unknown>)[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readTags(inputs: unknown): Record<string, string> | undefined {
  if (!inputs || typeof inputs !== 'object') {
    return undefined;
  }
  const tags = (inputs as { tags?: unknown }).tags;
  if (!tags || typeof tags !== 'object' || Array.isArray(tags)) {
    return undefined;
  }
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tags as Record<string, unknown>)) {
    if (value === null || value === undefined || value === '') {
      continue;
    }
    out[key] = String(value);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function selectResources(
  resources: FinfocusResource[],
  config: ActionConfiguration,
): DisplaySelection {
  let current = [...resources];
  let hiddenByChange = 0;
  const missingChangeData =
    config.showOnlyChanges === true && !current.some((resource) => resource.change);
  if (config.showOnlyChanges && !missingChangeData) {
    const next = current.filter((resource) => resource.change && CHANGE_OPS.has(resource.change));
    hiddenByChange = current.length - next.length;
    current = next;
  }
  let hiddenByCost = 0;
  const minCost = config.minCostThreshold ?? 0;
  if (minCost > 0) {
    const next = current.filter((resource) => resource.monthly >= minCost);
    hiddenByCost = current.length - next.length;
    current = next;
  }
  current.sort((a, b) => compareResources(a, b, config.sortBy ?? 'cost'));
  const grouped = current;
  const max = config.maxResourcesDisplayed ?? 10;
  let shown = current;
  let hiddenByCap = 0;
  if (max > 0 && current.length > max) {
    hiddenByCap = current.length - max;
    shown = current.slice(0, max);
  }
  return { shown, grouped, hiddenByChange, hiddenByCost, hiddenByCap, missingChangeData };
}

function compareResources(
  a: FinfocusResource,
  b: FinfocusResource,
  sortBy: 'cost' | 'name' | 'type' | 'change',
): number {
  if (sortBy === 'name') {
    return resourceName(a.resourceId).localeCompare(resourceName(b.resourceId));
  }
  if (sortBy === 'type') {
    return a.resourceType.localeCompare(b.resourceType) || b.monthly - a.monthly;
  }
  if (sortBy === 'change') {
    return changeRank(a.change) - changeRank(b.change) || b.monthly - a.monthly;
  }
  return b.monthly - a.monthly;
}

function changeRank(op: string | undefined): number {
  switch (op) {
    case 'create':
      return 0;
    case 'update':
      return 1;
    case 'replace':
    case 'create-replacement':
    case 'delete-replaced':
      return 2;
    case 'delete':
      return 3;
    case 'import':
      return 4;
    default:
      return op ? 8 : 9;
  }
}

export function formatDisplaySections(
  report: FinfocusReport,
  config: ActionConfiguration,
  currency: string,
): { resourceTable: string; groupTable: string } {
  const resources = report.resources ?? report.summary?.resources ?? [];
  const selection = selectResources(resources, config);
  const notes = displayNotes(selection, config, currency);
  return {
    resourceTable: formatResourceTable(selection.shown, config, currency, notes, report),
    groupTable: formatGroupTable(selection, config, currency),
  };
}

function displayNotes(
  selection: DisplaySelection,
  config: ActionConfiguration,
  currency: string,
): string[] {
  const notes: string[] = [];
  if (selection.missingChangeData) {
    notes.push(
      'Change detection needs Pulumi plan steps with op and urn. Showing every priced resource.',
    );
  } else if (selection.hiddenByChange > 0) {
    notes.push(
      `Showing only resources affected by this change. ${selection.hiddenByChange} unchanged resources hidden.`,
    );
  }
  if (selection.hiddenByCost > 0) {
    notes.push(
      `${selection.hiddenByCost} resources under ${(config.minCostThreshold ?? 0).toFixed(2)} ${currency} hidden.`,
    );
  }
  if (selection.hiddenByCap > 0) {
    notes.push(
      `Showing ${selection.shown.length} of ${selection.shown.length + selection.hiddenByCap} resources.`,
    );
  }
  if (selection.hiddenByChange > 0 || selection.hiddenByCost > 0 || selection.hiddenByCap > 0) {
    notes.push('The projected monthly total above still includes hidden resources.');
  }
  return notes;
}

function formatResourceTable(
  shown: FinfocusResource[],
  config: ActionConfiguration,
  currency: string,
  notes: string[],
  report: FinfocusReport,
): string {
  if (shown.length === 0 && notes.length === 0) {
    return '';
  }
  const showChange = config.showOnlyChanges === true || config.sortBy === 'change';
  const detailed = config.detailedComment === true;
  const title = config.showOnlyChanges
    ? 'Cost Impact of Changes'
    : detailed
      ? 'Full Resource Breakdown'
      : 'Top Resources';
  const header = showChange
    ? '| Resource | Type | Change | Monthly Cost |'
    : detailed
      ? '| Resource | Type | Monthly Cost | Notes |'
      : '| Resource | Type | Monthly Cost |';
  const align = showChange
    ? '| :--- | :--- | :---: | ---: |'
    : detailed
      ? '| :--- | :--- | ---: | :--- |'
      : '| :--- | :--- | ---: |';
  const rows = shown
    .map((resource) => {
      const name = cell(resourceName(resource.resourceId));
      const type = cell(resource.resourceType);
      const cost = `${resource.monthly.toFixed(2)} ${currency}`;
      if (showChange) {
        return `| ${name} | ${type} | ${changeLabel(resource.change)} | ${cost} |`;
      }
      if (detailed) {
        const resourceNotes = resource.notes ? cell(resource.notes) : '';
        return `| ${name} | ${type} | ${cost} | ${resourceNotes} |`;
      }
      return `| ${name} | ${type} | ${cost} |`;
    })
    .join('\n');
  const net = config.showOnlyChanges ? netChangeRow(report, currency, showChange) : '';
  const noteBlock = notes.map((note) => `\n\n*${note}*`).join('');
  const body = rows
    ? `${header}\n${align}\n${rows}${net}`
    : '*No resources match the display filters.*';
  return `

<details>
<summary><strong>📊 ${title}</strong> (${shown.length} resources)</summary>

${body}${noteBlock}

</details>
`;
}

function netChangeRow(report: FinfocusReport, currency: string, showChange: boolean): string {
  if (!report.diff) {
    return '';
  }
  const delta = isV041Diff(report.diff) ? report.diff.totalDelta : report.diff.monthly_cost_change;
  const sign = delta > 0 ? '+' : '';
  const amount = `${sign}${delta.toFixed(2)} ${currency}`;
  if (!showChange) {
    return '';
  }
  return `\n| **Net change** | | | ${amount} |`;
}

function formatGroupTable(
  selection: DisplaySelection,
  config: ActionConfiguration,
  currency: string,
): string {
  const groupBy = config.groupBy || 'provider';
  if (groupBy === 'resource') {
    return '';
  }
  const grouped = groupResources(selection, groupBy);
  if (grouped.length === 0) {
    return '';
  }
  const rows = grouped
    .map((row) => `| ${cell(row.key)} | ${row.monthly.toFixed(2)} ${currency} | ${row.count} |`)
    .join('\n');
  const total = grouped.reduce((sum, row) => sum + row.monthly, 0);
  const count = grouped.reduce((sum, row) => sum + row.count, 0);
  return `

<details>
<summary><strong>☁️ ${groupTitle(groupBy)}</strong></summary>

| ${groupColumn(groupBy)} | Monthly Cost | Resources |
| :--- | ---: | ---: |
${rows}
| **Total** | **${total.toFixed(2)} ${currency}** | **${count}** |

</details>
`;
}

interface GroupRow {
  key: string;
  monthly: number;
  count: number;
}

function groupResources(selection: DisplaySelection, groupBy: string): GroupRow[] {
  const buckets = new Map<string, GroupRow>();
  for (const resource of selection.grouped) {
    const key = groupKey(resource, groupBy);
    const existing = buckets.get(key);
    if (existing) {
      existing.monthly += resource.monthly;
      existing.count += 1;
    } else {
      buckets.set(key, { key, monthly: resource.monthly, count: 1 });
    }
  }
  return [...buckets.values()].sort((a, b) => b.monthly - a.monthly || a.key.localeCompare(b.key));
}

function groupKey(resource: FinfocusResource, groupBy: string): string {
  if (groupBy === 'type') {
    return resource.resourceType || 'other';
  }
  if (groupBy === 'service') {
    return serviceOf(resource.resourceType);
  }
  if (groupBy.startsWith('tag:')) {
    return tagValue(resource, groupBy.slice('tag:'.length));
  }
  return providerOf(resource.resourceType);
}

function tagValue(resource: FinfocusResource, key: string): string {
  const tags = resource.tags;
  if (!tags) {
    return '(untagged)';
  }
  if (tags[key]) {
    return tags[key];
  }
  const found = Object.keys(tags).find(
    (candidate) => candidate.toLowerCase() === key.toLowerCase(),
  );
  return found && tags[found] ? tags[found] : '(untagged)';
}

function groupTitle(groupBy: string): string {
  if (groupBy === 'type') {
    return 'Cost by Type';
  }
  if (groupBy === 'service') {
    return 'Cost by Service';
  }
  if (groupBy.startsWith('tag:')) {
    return `Cost by ${groupBy.slice('tag:'.length)}`;
  }
  return 'Cost by Provider';
}

function groupColumn(groupBy: string): string {
  if (groupBy === 'type') {
    return 'Type';
  }
  if (groupBy === 'service') {
    return 'Service';
  }
  if (groupBy.startsWith('tag:')) {
    return groupBy.slice('tag:'.length);
  }
  return 'Provider';
}

function changeLabel(op: string | undefined): string {
  switch (op) {
    case 'create':
      return '✨ Create';
    case 'update':
      return '🔄 Update';
    case 'delete':
      return '🗑️ Delete';
    case 'replace':
    case 'create-replacement':
    case 'delete-replaced':
      return '🔁 Replace';
    default:
      return op ? cell(op) : '';
  }
}

function cell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}
