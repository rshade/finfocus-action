import { ICommenter, PulumicostReport, ActionConfiguration } from './types.js';
export declare class Commenter implements ICommenter {
    private readonly marker;
    upsertComment(report: PulumicostReport, token: string, config?: ActionConfiguration): Promise<void>;
}
