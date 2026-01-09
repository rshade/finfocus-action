import { IAnalyzer, PulumicostReport } from './types.js';
export declare class Analyzer implements IAnalyzer {
    runAnalysis(planPath: string): Promise<PulumicostReport>;
    setupAnalyzerMode(): Promise<void>;
    private findBinary;
}
