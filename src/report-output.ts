import * as fs from 'fs';
import * as path from 'path';
import { FinfocusReport } from './types.js';

/** Write the projected report as pretty JSON. Returns the file path. */
export function writeReportJson(report: FinfocusReport, directory: string, name: string): string {
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, '').replace(/^\.+/, '') || 'cost-report';
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, `${safe}.json`);
  fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return file;
}
