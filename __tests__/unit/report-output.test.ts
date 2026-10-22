import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { writeReportJson, writeReportNdjson } from '../../src/report-output.js';
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

  it('writes one JSON object per resource', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'finfocus-ndjson-'));
    const report: FinfocusReport = {
      summary: { totalMonthly: 3, totalHourly: 0, currency: 'USD' },
      resources: [
        {
          resourceId: 'a',
          resourceType: 'aws:ec2/instance:Instance',
          adapter: 'aws',
          currency: 'USD',
          monthly: 1,
          hourly: 0,
        },
        {
          resourceId: 'b',
          resourceType: 'aws:s3/bucket:Bucket',
          adapter: 'aws',
          currency: 'USD',
          monthly: 2,
          hourly: 0,
        },
      ],
    };

    const file = writeReportNdjson(report, dir, 'cost-report');
    const lines = fs.readFileSync(file, 'utf8').trim().split('\n');

    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).resourceType).toBe('aws:ec2/instance:Instance');
    expect(JSON.parse(lines[1]).monthly).toBe(2);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
