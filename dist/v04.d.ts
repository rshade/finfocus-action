import { ActionConfiguration, ClusterReport, FinfocusReport, RecommendationsReport, StateOnlyReport } from './types.js';
export declare const DISMISSAL_REASONS: readonly ["not-applicable", "already-implemented", "business-constraint", "technical-constraint", "deferred", "inaccurate", "other"];
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
export declare function assertClusterGroupBy(groupBy: string): void;
export declare function parseClusterSelectors(raw: string | undefined): string[];
export declare function clusterArgs(config: ActionConfiguration): string[];
export declare function recommendationArgs(planPath: string, config?: ActionConfiguration): string[];
export declare function parseDismissals(raw: string | undefined): DismissalRequest[];
export declare function parseSnoozes(raw: string | undefined): SnoozeRequest[];
export declare function dismissArgs(planPath: string | undefined, item: DismissalRequest): string[];
export declare function snoozeArgs(planPath: string | undefined, item: SnoozeRequest): string[];
export declare function stateOnlyArgs(statePath: string): string[];
/**
 * Drop dismissed and snoozed recommendations unless the caller opted into
 * `--include-dismissed`. Also drop ids the action just dismissed or snoozed,
 * so a PR comment does not repeat them when the CLI still returns them.
 */
export declare function hideDismissedRecommendations(report: RecommendationsReport, config?: ActionConfiguration): RecommendationsReport;
/** Supports() decline reasons are appended to resource notes as "(declined by ...)". */
export declare function collectDeclineNotes(report: FinfocusReport): DeclineNote[];
export declare function reportFromStateOnly(overview: StateOnlyReport): FinfocusReport;
export declare function executeCluster(config: ActionConfiguration): Promise<ClusterReport>;
export declare function executeStateOnly(config: ActionConfiguration): Promise<StateOnlyReport>;
export declare function executeRecommendationLifecycle(planPath: string | undefined, config: ActionConfiguration): Promise<void>;
