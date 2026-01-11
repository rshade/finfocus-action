import { IAnalyzer, PulumicostReport, ActionConfiguration } from './types.js';
export declare class Analyzer implements IAnalyzer {
    runAnalysis(planPath: string): Promise<PulumicostReport>;
    setupAnalyzerMode(config?: ActionConfiguration): Promise<void>;
    private findBinary;
}
