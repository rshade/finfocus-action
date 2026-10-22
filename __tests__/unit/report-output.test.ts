import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { writeReportJson } from '../../src/report-output.js';
import { FinfocusReport } from '../../src/types.js';

describe('writeReportJson', () => {
  it('writes the report under a safe file name', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'finfocus-report-'));
    const report: FinfocusReport = {
      summary: { totalMonthly: 7.59, totalHourly: 0.01, currency: 'USD' },
    };

    const file = writeReportJson(report, dir, '../cost report');
    const written = JSON.parse(fs.readFileSync(file, 'utf8')) as FinfocusReport;

    expect(path.basename(file)).toBe('costreport.json');
    expect(written.summary.totalMonthly).toBe(7.59);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
