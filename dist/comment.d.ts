import { ICommenter, PulumicostReport } from './types.js';
export declare class Commenter implements ICommenter {
    private readonly marker;
    upsertComment(report: PulumicostReport, token: string): Promise<void>;
}
