import { FinfocusReport } from './types.js';
/** Write the projected report as pretty JSON. Returns the file path. */
export declare function writeReportJson(report: FinfocusReport, directory: string, name: string): string;
/** One JSON object per resource, for log aggregators. Returns the file path. */
export declare function writeReportNdjson(report: FinfocusReport, directory: string, name: string): string;
