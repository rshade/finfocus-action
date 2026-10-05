import { ActionConfiguration, FinfocusReport, FinfocusResource } from './types.js';
export interface DisplaySelection {
    shown: FinfocusResource[];
    /** Rows left after change and cost filters, before the display cap. Group totals use this set. */
    grouped: FinfocusResource[];
    hiddenByChange: number;
    hiddenByCost: number;
    hiddenByCap: number;
    missingChangeData: boolean;
}
export declare function parseResourceFilters(raw: string | undefined): string[];
export declare function filterArgs(filters: string[] | undefined): string[];
export declare function parseGroupBy(raw: string | undefined): string;
export declare function parseSortBy(raw: string | undefined): 'cost' | 'name' | 'type' | 'change';
export declare function parseMinCostThreshold(raw: string | undefined): number;
export declare function parseMaxResourcesDisplayed(raw: string | undefined): number;
export declare function usesDisplayControls(config?: ActionConfiguration): boolean;
export declare function providerOf(resourceType: string): string;
export declare function serviceOf(resourceType: string): string;
export declare function resourceName(resourceId: string): string;
export declare function annotateReportFromPlan(report: FinfocusReport, planPath: string | undefined, needed: boolean): FinfocusReport;
export declare function selectResources(resources: FinfocusResource[], config: ActionConfiguration): DisplaySelection;
export declare function formatDisplaySections(report: FinfocusReport, config: ActionConfiguration, currency: string): {
    resourceTable: string;
    groupTable: string;
};
