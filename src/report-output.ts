import * as fs from 'fs';
import * as path from 'path';
import { FinfocusReport, FinfocusResource } from './types.js';

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '').replace(/^\.+/, '') || 'cost-report';
}

/** Write the projected report as pretty JSON. Returns the file path. */
export function writeReportJson(report: FinfocusReport, directory: string, name: string): string {
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, `${safeName(name)}.json`);
  fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return file;
}

/** One JSON object per resource, for log aggregators. Returns the file path. */
export function writeReportNdjson(report: FinfocusReport, directory: string, name: string): string {
  const resources = report.resources ?? report.summary?.resources ?? [];
  const body = resources.map((resource) => JSON.stringify(ndjsonResource(resource))).join('\n');
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, `${safeName(name)}.ndjson`);
  fs.writeFileSync(file, body.length > 0 ? `${body}\n` : '', 'utf8');
  return file;
}

function ndjsonResource(resource: FinfocusResource): Record<string, unknown> {
  return {
    resourceId: resource.resourceId,
    resourceType: resource.resourceType,
    monthly: resource.monthly,
    hourly: resource.hourly,
    currency: resource.currency,
  };
}
